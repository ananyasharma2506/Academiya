import express from 'express';
import { query } from '../db/index.js';
import { requireAuth, requireTeacher, requireStudent } from '../middleware/auth.js';
import { generateDiagnostic } from '../ai/modelAdapter.js';
import { evaluateMCQ } from '../lib/evaluator.js';

const router = express.Router();

// POST /api/diagnostics - Teacher initiates diagnostic on gap
router.post('/', requireAuth, requireTeacher, async (req, res) => {
  try {
    const { gap_id } = req.body;
    if (!gap_id) {
      return res.status(400).json({ error: 'gap_id is required' });
    }

    const gapRes = await query('SELECT * FROM learning_gaps WHERE id = $1', [gap_id]);
    if (gapRes.rows.length === 0) {
      return res.status(404).json({ error: 'Learning gap not found' });
    }
    const gap = gapRes.rows[0];

    // Call AI model adapter for diagnostic blueprint
    const diagnosis = await generateDiagnostic(gap);

    // Save diagnostic
    const diagInsert = await query(
      `INSERT INTO diagnostics (gap_id, blueprint)
       VALUES ($1, $2)
       RETURNING *`,
      [gap_id, JSON.stringify(diagnosis)]
    );
    const diagnostic = diagInsert.rows[0];

    // Persist diagnostic questions into questions table
    const targetedQuestions = diagnosis.blueprint?.targeted_questions || [];
    const persistedQuestions = [];

    for (const tq of targetedQuestions) {
      const qRes = await query(
        `INSERT INTO questions 
         (concept, subconcept, type, statement, options, correct_option_ids, bloom_level, difficulty, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'medium', 'ai')
         RETURNING *`,
        [
          gap.concept,
          gap.subconcept,
          tq.type || 'mcq_single',
          tq.statement,
          JSON.stringify(tq.options),
          JSON.stringify(tq.correct_option_ids),
          tq.bloom_level || 'analyze'
        ]
      );
      persistedQuestions.push(qRes.rows[0]);
    }

    // Update gap status to 'confirmed' since diagnostic is running
    await query(
      `UPDATE learning_gaps
       SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [gap_id]
    );

    return res.status(201).json({
      diagnostic,
      misconception: diagnosis.misconception,
      questions: persistedQuestions
    });
  } catch (err) {
    console.error('Create diagnostic error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/diagnostics/gap/:gap_id
router.get('/gap/:gap_id', requireAuth, async (req, res) => {
  try {
    const diagRes = await query(
      `SELECT d.*, lg.concept, lg.subconcept, lg.status as gap_status
       FROM diagnostics d
       JOIN learning_gaps lg ON d.gap_id = lg.id
       WHERE d.gap_id = $1
       ORDER BY d.created_at DESC LIMIT 1`,
      [req.params.gap_id]
    );

    if (diagRes.rows.length === 0) {
      return res.status(404).json({ error: 'Diagnostic not found for this gap' });
    }

    return res.json({ diagnostic: diagRes.rows[0] });
  } catch (err) {
    console.error('Get diagnostic error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/diagnostics/:id/attempt - Student submits diagnostic attempt
router.post('/:id/attempt', requireAuth, async (req, res) => {
  try {
    const diagnosticId = req.params.id;
    const studentId = req.user.id;
    const { question_id, selected_option_ids } = req.body;

    const diagRes = await query('SELECT * FROM diagnostics WHERE id = $1', [diagnosticId]);
    if (diagRes.rows.length === 0) {
      return res.status(404).json({ error: 'Diagnostic not found' });
    }
    const diagnostic = diagRes.rows[0];

    const qRes = await query('SELECT * FROM questions WHERE id = $1', [question_id]);
    if (qRes.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    const question = qRes.rows[0];

    // Evaluate
    let correctOptionIds = [];
    try {
      correctOptionIds = typeof question.correct_option_ids === 'string'
        ? JSON.parse(question.correct_option_ids)
        : question.correct_option_ids;
    } catch {
      correctOptionIds = [];
    }

    const evalResult = evaluateMCQ(question.type, selected_option_ids, correctOptionIds, 1);

    // 1. Insert into diagnostic_attempts
    const diagAttempt = await query(
      `INSERT INTO diagnostic_attempts (diagnostic_id, student_id, question_id, is_correct)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [diagnosticId, studentId, question_id, evalResult.is_correct]
    );

    // 2. Insert into general attempts with source = 'diagnostic'
    const attemptInsert = await query(
      `INSERT INTO attempts 
       (student_id, question_id, source, selected_option_ids, is_correct, marks_awarded)
       VALUES ($1, $2, 'diagnostic', $3, $4, $5)
       RETURNING *`,
      [
        studentId,
        question_id,
        JSON.stringify(selected_option_ids),
        evalResult.is_correct,
        evalResult.marks_awarded
      ]
    );

    // 3. Feed back into learning_evidence so gap evidence sharpens
    const evidenceInsert = await query(
      `INSERT INTO learning_evidence 
       (student_id, concept, subconcept, attempt_id, result)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        studentId,
        question.concept,
        question.subconcept,
        attemptInsert.rows[0].id,
        evalResult.is_correct ? 'correct' : 'incorrect'
      ]
    );

    return res.status(201).json({
      diagnostic_attempt: diagAttempt.rows[0],
      evaluation: evalResult,
      evidence: evidenceInsert.rows[0]
    });
  } catch (err) {
    console.error('Diagnostic attempt error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
