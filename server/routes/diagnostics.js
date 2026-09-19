import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { generateDiagnostic, generateQuestion } from '../ai/modelAdapter.js';
import { evaluateMCQ } from '../lib/evaluator.js';

const router = express.Router();

// POST /api/diagnostics
// Teacher selects a gap_id -> build diagnostic blueprint from gap's concept/subconcept
// -> call modelAdapter.generateDiagnostic() -> insert into diagnostics ->
// generate its targeted questions reusing the question generation pipeline.
router.post('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can launch diagnostics' });
    }

    const { gap_id } = req.body;
    if (!gap_id) {
      return res.status(400).json({ error: 'gap_id is required' });
    }

    // 1. Fetch gap
    const gapRes = await query('SELECT * FROM learning_gaps WHERE id = $1', [gap_id]);
    if (gapRes.rows.length === 0) {
      return res.status(404).json({ error: 'Learning gap not found' });
    }
    const gap = gapRes.rows[0];

    // 2. Call modelAdapter.generateDiagnostic()
    const diagnosticBlueprint = await generateDiagnostic(gap);

    // 3. Generate probe questions reusing modelAdapter / Phase 4 pipeline shape
    const probeQuestions = [];
    const probeList = diagnosticBlueprint.probe_questions || [
      {
        concept: gap.concept,
        subconcept: gap.subconcept,
        type: 'mcq_single',
        statement: `Diagnostic Probe: Which edge condition isolates errors in ${gap.subconcept || gap.concept}?`,
        options: [
          { id: 'opt_diag_1', text: 'Evaluation without boundary checks' },
          { id: 'opt_diag_2', text: 'Properly terminating base recursion' },
        ],
        correct_option_ids: ['opt_diag_2'],
        bloom_level: 'analyze',
        difficulty: 'medium',
      },
    ];

    for (const pq of probeList) {
      const generated = await generateQuestion({
        concept: gap.concept,
        subconcept: gap.subconcept,
        type: pq.type || 'mcq_single',
        bloom_level: pq.bloom_level || 'analyze',
        difficulty: pq.difficulty || 'medium',
      });

      // Insert question with source = 'ai'
      const qRes = await query(
        `INSERT INTO questions (
          concept, subconcept, type, statement, options,
          correct_option_ids, bloom_level, difficulty, source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ai')
        RETURNING *`,
        [
          generated.concept,
          generated.subconcept,
          generated.type,
          generated.statement,
          JSON.stringify(generated.options),
          JSON.stringify(generated.correct_option_ids),
          generated.bloom_level,
          generated.difficulty,
        ]
      );
      probeQuestions.push(qRes.rows[0]);
    }

    const fullBlueprint = {
      ...diagnosticBlueprint,
      question_ids: probeQuestions.map((q) => q.id),
      created_at: new Date().toISOString(),
    };

    // 4. Insert into diagnostics
    const diagRes = await query(
      `INSERT INTO diagnostics (gap_id, blueprint)
       VALUES ($1, $2)
       RETURNING *`,
      [gap_id, JSON.stringify(fullBlueprint)]
    );

    res.status(201).json({
      diagnostic: diagRes.rows[0],
      questions: probeQuestions,
    });
  } catch (err) {
    console.error('Create diagnostic error:', err);
    res.status(500).json({ error: 'Failed to create diagnostic' });
  }
});

// GET /api/diagnostics/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const diagRes = await query('SELECT * FROM diagnostics WHERE id = $1', [req.params.id]);
    if (diagRes.rows.length === 0) {
      return res.status(404).json({ error: 'Diagnostic not found' });
    }

    const diagnostic = diagRes.rows[0];
    const blueprint = typeof diagnostic.blueprint === 'string'
      ? JSON.parse(diagnostic.blueprint)
      : diagnostic.blueprint;

    const questionIds = blueprint.question_ids || [];
    let questions = [];
    if (questionIds.length > 0) {
      const qRes = await query('SELECT * FROM questions WHERE id = ANY($1::uuid[])', [questionIds]);
      questions = qRes.rows.map((q) => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
      }));
    }

    res.json({
      diagnostic: {
        ...diagnostic,
        blueprint,
      },
      questions,
    });
  } catch (err) {
    console.error('Get diagnostic error:', err);
    res.status(500).json({ error: 'Failed to fetch diagnostic' });
  }
});

// POST /api/diagnostics/:id/attempt
// Student-facing diagnostic attempt flow -> diagnostic_attempts rows ->
// also feeds back into learning_evidence (tagged with diagnostic source)
// so the gap's evidence sharpens rather than creating a disconnected trail.
router.post('/:id/attempt', requireAuth, async (req, res) => {
  try {
    const diagnosticId = req.params.id;
    const studentId = req.user.id;
    const { question_id, selected_option_ids } = req.body;

    if (!question_id || !selected_option_ids) {
      return res.status(400).json({ error: 'question_id and selected_option_ids are required' });
    }

    // 1. Fetch question
    const qRes = await query('SELECT * FROM questions WHERE id = $1', [question_id]);
    if (qRes.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    const question = qRes.rows[0];

    const options = typeof question.options === 'string' ? JSON.parse(question.options) : question.options;
    const correctOptionIds = typeof question.correct_option_ids === 'string'
      ? JSON.parse(question.correct_option_ids)
      : question.correct_option_ids;

    const evaluatorCorrectOptions = options.map((opt) => ({
      id: opt.id,
      is_correct: correctOptionIds.includes(opt.id),
    }));

    // 2. Evaluate answer
    const evaluation = evaluateMCQ(
      question.type,
      selected_option_ids,
      evaluatorCorrectOptions,
      1.0
    );

    const isCorrect = Boolean(evaluation.is_correct);

    // 3. Insert into diagnostic_attempts
    const diagAttemptRes = await query(
      `INSERT INTO diagnostic_attempts (diagnostic_id, student_id, question_id, is_correct)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [diagnosticId, studentId, question_id, isCorrect]
    );

    // 4. Also insert standard attempt row with source = 'diagnostic'
    const attemptRes = await query(
      `INSERT INTO attempts (student_id, question_id, source, selected_option_ids, is_correct, marks_awarded)
       VALUES ($1, $2, 'diagnostic', $3, $4, $5)
       RETURNING *`,
      [studentId, question_id, JSON.stringify(selected_option_ids), isCorrect, evaluation.marks_awarded]
    );

    // 5. Feed into learning_evidence (sharpening the evidence trail)
    const evidenceResult = isCorrect ? 'correct' : 'incorrect';
    const evidenceRes = await query(
      `INSERT INTO learning_evidence (student_id, concept, subconcept, attempt_id, result)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [studentId, question.concept, question.subconcept, attemptRes.rows[0].id, evidenceResult]
    );

    // Append new evidence ID to the gap's evidence_ids
    const diagRes = await query('SELECT gap_id FROM diagnostics WHERE id = $1', [diagnosticId]);
    if (diagRes.rows.length > 0) {
      const gapId = diagRes.rows[0].gap_id;
      await query(
        `UPDATE learning_gaps
         SET evidence_ids = evidence_ids || $1::jsonb, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify([evidenceRes.rows[0].id]), gapId]
      );
    }

    res.status(201).json({
      diagnostic_attempt: diagAttemptRes.rows[0],
      evidence: evidenceRes.rows[0],
      evaluation,
    });
  } catch (err) {
    console.error('Diagnostic attempt error:', err);
    res.status(500).json({ error: 'Failed to record diagnostic attempt' });
  }
});

export default router;
