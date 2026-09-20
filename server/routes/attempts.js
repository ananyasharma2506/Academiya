import express from 'express';
import { query } from '../db/index.js';
import { requireAuth, requireStudent } from '../middleware/auth.js';
import { evaluateMCQ, evaluateDebugging } from '../lib/evaluator.js';
import { detectGap } from '../services/evidenceService.js';
import { grade_descriptive_answer, generateEmbedding } from '../ai/modelAdapter.js';
import { checkAttendance } from '../services/attendanceService.js';

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const studentId = req.user.id;
    const {
      question_id,
      selected_option_ids = null,
      code = null,
      answer = null, // student descriptive text answer
      source = 'practice'
    } = req.body;

    if (!question_id) {
      return res.status(400).json({ error: 'question_id is required' });
    }

    // 1. Fetch question
    const qResult = await query('SELECT * FROM questions WHERE id = $1', [question_id]);
    if (qResult.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    const question = qResult.rows[0];

    // 2. Evaluation
    let evaluation;
    let evidenceSource = 'deterministic';
    let gradingDetails = null;

    if (question.type === 'mcq_single' || question.type === 'mcq_multi') {
      let correctOptionIds = [];
      try {
        correctOptionIds = typeof question.correct_option_ids === 'string'
          ? JSON.parse(question.correct_option_ids)
          : question.correct_option_ids;
      } catch {
        correctOptionIds = [];
      }
      evaluation = evaluateMCQ(question.type, selected_option_ids, correctOptionIds, 1);
    } else if (question.type === 'coding') {
      let testCases = [];
      try {
        testCases = typeof question.options === 'string' ? JSON.parse(question.options) : (question.options || []);
      } catch {
        testCases = [];
      }
      evaluation = await evaluateDebugging(code, 'python', testCases, 1);
    } else if (question.type === 'descriptive') {
      const studentAnswer = (answer || code || '').trim();
      if (!studentAnswer) {
        return res.status(400).json({ error: 'Answer text is required for descriptive question' });
      }

      const referenceAnswer = question.reference_answer || question.statement;

      // Fast First Pass: Embedding Cosine Similarity
      let similarity = 0.5;
      try {
        const studentEmbed = await generateEmbedding(studentAnswer);
        let refEmbed = question.reference_answer_embedding;
        if (!refEmbed) {
          refEmbed = await generateEmbedding(referenceAnswer);
        } else if (typeof refEmbed === 'string') {
          // parse string format if needed '[0.1, ...]'
          refEmbed = JSON.parse(refEmbed.replace('[', '[').replace(']', ']'));
        }

        // Compute cosine similarity between vectors
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < studentEmbed.length; i++) {
          dot += studentEmbed[i] * refEmbed[i];
          normA += studentEmbed[i] * studentEmbed[i];
          normB += refEmbed[i] * refEmbed[i];
        }
        similarity = normA > 0 && normB > 0 ? (dot / (Math.sqrt(normA) * Math.sqrt(normB))) : 0.5;
      } catch (embErr) {
        console.warn('[Attempt] Fast embedding similarity pass warning:', embErr.message);
      }

      // Second Pass: Call grade_descriptive_answer with rubric & coverage breakdown
      const gradeResult = await grade_descriptive_answer(question.statement, referenceAnswer, studentAnswer);
      const isCorrect = gradeResult.verdict === 'correct';
      const marksAwarded = gradeResult.verdict === 'correct' ? 1 : gradeResult.verdict === 'partial' ? 0.5 : 0;

      gradingDetails = {
        similarity_score: parseFloat(similarity.toFixed(4)),
        verdict: gradeResult.verdict,
        covered: gradeResult.covered || [],
        missed: gradeResult.missed || []
      };

      evaluation = {
        is_correct: isCorrect,
        marks_awarded: marksAwarded,
        verdict: gradeResult.verdict,
        grading_details: gradingDetails
      };
      evidenceSource = 'ai_graded_descriptive';
    } else {
      return res.status(400).json({ error: `Unsupported question type: ${question.type}` });
    }

    // 3. Insert into attempts table
    const attemptInsert = await query(
      `INSERT INTO attempts 
       (student_id, question_id, source, selected_option_ids, code, is_correct, marks_awarded, grading_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        studentId,
        question_id,
        source,
        selected_option_ids ? JSON.stringify(selected_option_ids) : null,
        code || answer || null,
        evaluation.is_correct,
        evaluation.marks_awarded,
        gradingDetails ? JSON.stringify(gradingDetails) : null
      ]
    );
    const attempt = attemptInsert.rows[0];

    // 4. Insert into learning_evidence table
    const resultStatus = evaluation.is_correct ? 'correct' : 'incorrect';
    const evidenceInsert = await query(
      `INSERT INTO learning_evidence 
       (student_id, concept, subconcept, attempt_id, result, source)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        studentId,
        question.concept,
        question.subconcept,
        attempt.id,
        resultStatus,
        evidenceSource
      ]
    );
    const evidence = evidenceInsert.rows[0];

    // 5. Trigger gap detection hook
    const gapResult = await detectGap(studentId, question.concept, question.subconcept);

    // 6. Phase 11: Auto attendance hook on assignment / practice completion
    const attendanceRecords = await checkAttendance(studentId, new Date(), 'assignment_completion');

    return res.status(201).json({
      attempt,
      evaluation,
      evidence,
      gap_detected: gapResult,
      auto_attendance: attendanceRecords
    });
  } catch (err) {
    console.error('Attempt error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/student/:student_id', requireAuth, async (req, res) => {
  try {
    const studentId = req.params.student_id;
    const result = await query(
      `SELECT a.*, q.concept, q.subconcept, q.statement, q.type as question_type
       FROM attempts a
       JOIN questions q ON a.question_id = q.id
       WHERE a.student_id = $1
       ORDER BY a.created_at DESC`,
      [studentId]
    );
    return res.json({ attempts: result.rows });
  } catch (err) {
    console.error('Get attempts error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
