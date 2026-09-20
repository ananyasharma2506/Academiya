import { query } from '../db/index.js';
import { generateQuestion, generateEmbedding } from '../ai/modelAdapter.js';
import { broadcastJobEvent } from '../ws.js';
import { consume as consumeSessionBudget, getRemaining as getRemainingSessionBudget } from '../lib/sessionGenerationLimiter.js';

// In-process bounded queue
class GenerationQueue {
  constructor() {
    this.queue = [];
    this.running = false;
  }

  enqueue(job) {
    this.queue.push(job);
    this.processNext();
  }

  async processNext() {
    if (this.running || this.queue.length === 0) return;
    this.running = true;

    const job = this.queue.shift();
    try {
      await this.runJob(job);
    } catch (err) {
      console.error(`Error processing job ${job.id}:`, err);
    } finally {
      this.running = false;
      this.processNext();
    }
  }

  async runJob(job) {
    const {
      id: jobId,
      requested_count,
      itemBlueprints,
      assessment_id = null,
      generated_for_student_id = null,
      sessionId = null
    } = job;

    broadcastJobEvent(jobId, 'generation.started', { requested_count });

    let generatedCount = 0;
    const MAX_RETRIES = 3;

    for (let i = 1; i <= requested_count; i++) {
      // 1. Check for cancellation before processing item
      const statusCheck = await query('SELECT status FROM generation_jobs WHERE id = $1', [jobId]);
      if (statusCheck.rows.length === 0 || statusCheck.rows[0].status === 'cancelled') {
        console.log(`[Queue] Job ${jobId} was cancelled by user.`);
        if (generated_for_student_id && sessionId) consumeSessionBudget(sessionId, 'practice-generate', generatedCount);
        broadcastJobEvent(jobId, 'generation.cancelled', { generated_count: generatedCount });
        return;
      }

      const itemBlueprint = itemBlueprints[i - 1];

      let attemptNo = 0;
      let questionObj = null;
      let isValid = false;

      // 2. Bounded retry loop (max 3 tries per item)
      while (attemptNo < MAX_RETRIES && !isValid) {
        attemptNo++;
        try {
          const generated = await generateQuestion(itemBlueprint);
          isValid = itemBlueprint.type === 'descriptive'
            ? !!(generated && generated.statement && generated.reference_answer)
            : !!(
              generated &&
              generated.statement &&
              Array.isArray(generated.options) &&
              generated.options.length >= 2 &&
              Array.isArray(generated.correct_option_ids) &&
              (generated.type !== 'mcq_single' || generated.correct_option_ids.length === 1)
            );
          if (isValid) questionObj = generated;
        } catch (err) {
          console.warn(`[Queue] Attempt ${attemptNo} failed for item ${i}:`, err.message);
        }
      }

      if (!isValid || !questionObj) {
        // Mark failed item
        await query(
          `INSERT INTO generated_questions (job_id, status, attempt_no)
           VALUES ($1, 'failed', $2)`,
          [jobId, attemptNo]
        );
        broadcastJobEvent(jobId, 'question.failed', { index: i, attempt_no: attemptNo });
        continue;
      }

      const isDescriptive = questionObj.type === 'descriptive';

      // 3. Embeddings for Phase 9 semantic layer (question text, and reference
      // answer for descriptive so attempts.js can compare it against student answers)
      let embedding = null;
      let referenceAnswerEmbedding = null;
      try {
        const textToEmbed = `${questionObj.concept} ${questionObj.subconcept} ${questionObj.statement}`;
        embedding = await generateEmbedding(textToEmbed);
        if (isDescriptive) {
          referenceAnswerEmbedding = await generateEmbedding(questionObj.reference_answer);
        }
      } catch (err) {
        console.warn('Embedding generation error:', err.message);
      }

      // 4. Insert into questions table (source = 'ai')
      const qRes = await query(
        `INSERT INTO questions
         (assessment_id, concept, subconcept, type, statement, options, correct_option_ids,
          reference_answer, reference_answer_embedding, bloom_level, difficulty, source, embedding,
          generated_for_student_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ai', $12, $13)
         RETURNING *`,
        [
          assessment_id,
          questionObj.concept,
          questionObj.subconcept,
          questionObj.type,
          questionObj.statement,
          isDescriptive ? null : JSON.stringify(questionObj.options),
          isDescriptive ? null : JSON.stringify(questionObj.correct_option_ids),
          isDescriptive ? questionObj.reference_answer : null,
          referenceAnswerEmbedding ? `[${referenceAnswerEmbedding.join(',')}]` : null,
          questionObj.bloom_level,
          questionObj.difficulty,
          embedding ? `[${embedding.join(',')}]` : null,
          generated_for_student_id
        ]
      );
      const insertedQuestion = qRes.rows[0];


      // 5. Link in generated_questions
      await query(
        `INSERT INTO generated_questions (job_id, question_id, status, attempt_no)
         VALUES ($1, $2, 'validated', $3)`,
        [jobId, insertedQuestion.id, attemptNo]
      );

      generatedCount++;

      // 6. Update generation_jobs count
      await query(
        `UPDATE generation_jobs
         SET generated_count = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [generatedCount, jobId]
      );

      // 7. Emit WebSocket streaming progress events
      broadcastJobEvent(jobId, 'question.generated', {
        index: i,
        question: insertedQuestion
      });
      broadcastJobEvent(jobId, 'generation.progress', {
        current: generatedCount,
        total: requested_count
      });

      // Small tick delay to allow observable streaming UI experience
      await new Promise(r => setTimeout(r, 200));
    }

    // Mark completed
    await query(
      `UPDATE generation_jobs
       SET status = 'completed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status != 'cancelled'`,
      [jobId]
    );

    let sessionRemaining = null;
    if (generated_for_student_id && sessionId) {
      consumeSessionBudget(sessionId, 'practice-generate', generatedCount);
      sessionRemaining = getRemainingSessionBudget(sessionId, 'practice-generate');
    }

    broadcastJobEvent(jobId, 'generation.completed', {
      total_generated: generatedCount,
      requested_count,
      session_remaining: sessionRemaining
    });
  }
}

export const queue = new GenerationQueue();
