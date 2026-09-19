/**
 * In-Process Bounded Generation Queue & Worker Loop
 *
 * Runs inside the single Express process.
 * Pulls pending generation items, calls modelAdapter.generateQuestion(),
 * validates schema, persists successful questions (source = 'ai'),
 * increments counts, handles retries up to 3 times, checks cancellation,
 * and broadcasts streaming events over WebSocket.
 */

import { query } from '../db/index.js';
import { generateQuestion } from '../ai/modelAdapter.js';
import { broadcastJobEvent } from './jobBroadcaster.js';
import { generateEmbedding, detectDuplicateQuestion } from './semanticService.js';

const MAX_RETRIES_PER_ITEM = 3;

class GenerationQueue {
  constructor() {
    this.jobs = []; // queue of active job configs
    this.isProcessing = false;
  }

  enqueue(job) {
    this.jobs.push(job);
    this.processNext();
  }

  async processNext() {
    if (this.isProcessing || this.jobs.length === 0) return;
    this.isProcessing = true;

    const currentJob = this.jobs.shift();
    try {
      await this.runJob(currentJob);
    } catch (err) {
      console.error(`Error processing job ${currentJob?.id}:`, err);
    } finally {
      this.isProcessing = false;
      if (this.jobs.length > 0) {
        setImmediate(() => this.processNext());
      }
    }
  }

  async runJob({ jobId, blueprint, requestedCount }) {
    broadcastJobEvent(jobId, 'generation.started', {
      requested_count: requestedCount,
      blueprint,
    });

    for (let itemIndex = 0; itemIndex < requestedCount; itemIndex++) {
      // 1. Check if cancelled before processing item
      const statusCheck = await query('SELECT status FROM generation_jobs WHERE id = $1', [jobId]);
      if (statusCheck.rows.length === 0 || statusCheck.rows[0].status === 'cancelled') {
        broadcastJobEvent(jobId, 'generation.cancelled', {
          message: 'Job was cancelled by user',
        });
        return;
      }

      let succeeded = false;
      let lastError = null;

      // Retry loop up to MAX_RETRIES_PER_ITEM
      for (let attemptNo = 1; attemptNo <= MAX_RETRIES_PER_ITEM; attemptNo++) {
        // Record pending generated_question attempt
        const genQRes = await query(
          `INSERT INTO generated_questions (job_id, status, attempt_no)
           VALUES ($1, 'pending', $2)
           RETURNING id`,
          [jobId, attemptNo]
        );
        const genQId = genQRes.rows[0].id;

        try {
          // Pass structured blueprint object, never a raw free-text prompt
          const questionData = await generateQuestion({
            ...blueprint,
            constraints: { itemIndex, attemptNo },
          });

          // Duplicate detection using semanticSearch before persisting
          const dupCheck = await detectDuplicateQuestion(questionData.statement, questionData.concept);
          if (dupCheck.is_duplicate) {
            throw new Error(`Near-duplicate detected (similarity: ${dupCheck.similarity})`);
          }

          const embeddingVector = generateEmbedding(`${questionData.statement} ${questionData.concept} ${questionData.subconcept}`);
          const embeddingStr = `[${embeddingVector.join(',')}]`;

          // Insert into questions table with source = 'ai' and embedding vector
          const insertQuestionRes = await query(
            `INSERT INTO questions (
              concept, subconcept, type, statement, options,
              correct_option_ids, bloom_level, difficulty, source, embedding
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ai', $9::vector)
            RETURNING *`,
            [
              questionData.concept,
              questionData.subconcept,
              questionData.type,
              questionData.statement,
              JSON.stringify(questionData.options),
              JSON.stringify(questionData.correct_option_ids),
              questionData.bloom_level,
              questionData.difficulty,
              embeddingStr,
            ]
          );
          const persistedQuestion = insertQuestionRes.rows[0];

          // Update generated_questions linking question_id and marking validated
          await query(
            `UPDATE generated_questions
             SET question_id = $1, status = 'validated'
             WHERE id = $2`,
            [persistedQuestion.id, genQId]
          );

          // Increment generated_count on generation_jobs
          const jobUpdateRes = await query(
            `UPDATE generation_jobs
             SET generated_count = generated_count + 1, updated_at = NOW()
             WHERE id = $1
             RETURNING generated_count`,
            [jobId]
          );
          const currentCount = jobUpdateRes.rows[0]?.generated_count || (itemIndex + 1);

          broadcastJobEvent(jobId, 'question.generated', {
            question: persistedQuestion,
            generated_count: currentCount,
            total_requested: requestedCount,
          });

          broadcastJobEvent(jobId, 'generation.progress', {
            progress: Math.round((currentCount / requestedCount) * 100),
            generated_count: currentCount,
            total_requested: requestedCount,
          });

          succeeded = true;
          break; // move on to next item
        } catch (err) {
          lastError = err;
          // Record failed attempt
          await query(
            `UPDATE generated_questions
             SET status = 'failed'
             WHERE id = $1`,
            [genQId]
          );
          // Increment retry budget used
          await query(
            `UPDATE generation_jobs
             SET retry_budget_used = retry_budget_used + 1, updated_at = NOW()
             WHERE id = $1`,
            [jobId]
          );
        }
      }

      if (!succeeded) {
        broadcastJobEvent(jobId, 'question.failed', {
          itemIndex,
          error: lastError?.message || 'Failed after maximum retries',
        });
      }

      // Small tick between generations so WebSocket delivery streams incrementally
      await new Promise((r) => setTimeout(r, 40));
    }

    // Check final job status
    const finalJobRes = await query('SELECT status, generated_count FROM generation_jobs WHERE id = $1', [jobId]);
    if (finalJobRes.rows[0]?.status !== 'cancelled') {
      await query(
        `UPDATE generation_jobs
         SET status = 'completed', updated_at = NOW()
         WHERE id = $1`,
        [jobId]
      );

      broadcastJobEvent(jobId, 'generation.completed', {
        generated_count: finalJobRes.rows[0]?.generated_count,
        requested_count: requestedCount,
      });
    }
  }
}

export const generationQueue = new GenerationQueue();
