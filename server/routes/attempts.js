import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { evaluateMCQ } from '../lib/evaluator.js';
import { detectGap } from '../services/gapService.js';

const router = express.Router();

// POST /api/attempts
// Student submits an answer to a question_id -> call evaluator.js ->
// insert into attempts -> then insert one row into learning_evidence
// (result = 'correct' or 'incorrect', copying concept/subconcept from question)
// -> then trigger detectGap(student_id, concept)
router.post('/', requireAuth, async (req, res) => {
  try {
    const studentId = req.user.id;
    const {
      question_id,
      selected_option_ids,
      code = null,
      source = 'practice',
    } = req.body;

    if (!question_id) {
      return res.status(400).json({ error: 'question_id is required' });
    }

    // 1. Fetch question
    const qRes = await query('SELECT * FROM questions WHERE id = $1', [question_id]);
    if (qRes.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    const question = qRes.rows[0];

    // 2. Evaluate deterministically using evaluator.js
    let evaluation = { is_correct: false, marks_awarded: 0 };
    if (question.type === 'mcq_single' || question.type === 'mcq_multi') {
      const options = Array.isArray(question.options)
        ? question.options
        : JSON.parse(question.options || '[]');
      const correctOptionIds = Array.isArray(question.correct_option_ids)
        ? question.correct_option_ids
        : JSON.parse(question.correct_option_ids || '[]');

      const evaluatorCorrectOptions = options.map((opt) => ({
        id: opt.id,
        is_correct: correctOptionIds.includes(opt.id),
      }));

      evaluation = evaluateMCQ(
        question.type,
        selected_option_ids,
        evaluatorCorrectOptions,
        1.0
      );
    }

    const isCorrect = Boolean(evaluation.is_correct);
    const marksAwarded = evaluation.marks_awarded || 0;

    // 3. Insert into attempts
    const attemptRes = await query(
      `INSERT INTO attempts (
        student_id, question_id, source, selected_option_ids, code, is_correct, marks_awarded
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        studentId,
        question_id,
        source,
        selected_option_ids ? JSON.stringify(selected_option_ids) : null,
        code,
        isCorrect,
        marksAwarded,
      ]
    );
    const attempt = attemptRes.rows[0];

    // 4. Insert into learning_evidence
    const evidenceResult = isCorrect ? 'correct' : 'incorrect';
    const evidenceRes = await query(
      `INSERT INTO learning_evidence (
        student_id, concept, subconcept, attempt_id, result
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [studentId, question.concept, question.subconcept, attempt.id, evidenceResult]
    );
    const evidence = evidenceRes.rows[0];

    // 5. Trigger gap detection hook
    const detectedGap = await detectGap(studentId, question.concept);

    res.status(201).json({
      attempt,
      evidence,
      evaluation,
      gap_detected: detectedGap || null,
    });
  } catch (err) {
    console.error('Attempt submission error:', err);
    res.status(500).json({ error: 'Failed to process attempt' });
  }
});

export default router;
