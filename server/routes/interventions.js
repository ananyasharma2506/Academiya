import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { generatePlan, generateQuestion } from '../ai/modelAdapter.js';
import { evaluateMCQ } from '../lib/evaluator.js';

const router = express.Router();

// POST /api/interventions
// Teacher selects a gap_id -> call modelAdapter.generatePlan()
// -> insert into interventions with plan and status = 'active'
router.post('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can create interventions' });
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

    // 2. Fetch any diagnostic results associated with this gap to inform the plan
    const diagRes = await query(
      'SELECT * FROM diagnostics WHERE gap_id = $1 ORDER BY created_at DESC LIMIT 1',
      [gap_id]
    );
    const diagnostic = diagRes.rows[0] || null;

    // 3. Generate plan via modelAdapter
    const generatedPlan = await generatePlan(gap, diagnostic);

    // 4. Generate targeted practice questions for this intervention
    const practiceCount = generatedPlan.practice_count || 3;
    const interventionQuestions = [];

    for (let i = 0; i < practiceCount; i++) {
      const qData = await generateQuestion({
        concept: gap.concept,
        subconcept: gap.subconcept,
        type: 'mcq_single',
        bloom_level: 'apply',
        difficulty: 'medium',
      });

      const qRes = await query(
        `INSERT INTO questions (
          concept, subconcept, type, statement, options,
          correct_option_ids, bloom_level, difficulty, source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ai')
        RETURNING *`,
        [
          qData.concept,
          qData.subconcept,
          qData.type,
          qData.statement,
          JSON.stringify(qData.options),
          JSON.stringify(qData.correct_option_ids),
          qData.bloom_level,
          qData.difficulty,
        ]
      );
      interventionQuestions.push(qRes.rows[0]);
    }

    const fullPlan = {
      ...generatedPlan,
      question_ids: interventionQuestions.map((q) => q.id),
      created_at: new Date().toISOString(),
    };

    // 5. Insert into interventions with status = 'active'
    const insertRes = await query(
      `INSERT INTO interventions (gap_id, plan, target_concept, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING *`,
      [gap_id, JSON.stringify(fullPlan), gap.concept]
    );

    res.status(201).json({
      intervention: insertRes.rows[0],
      questions: interventionQuestions,
    });
  } catch (err) {
    console.error('Create intervention error:', err);
    res.status(500).json({ error: 'Failed to create intervention' });
  }
});

// GET /api/interventions/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const intRes = await query('SELECT * FROM interventions WHERE id = $1', [req.params.id]);
    if (intRes.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention not found' });
    }

    const intervention = intRes.rows[0];
    const plan = typeof intervention.plan === 'string'
      ? JSON.parse(intervention.plan)
      : intervention.plan;

    const questionIds = plan.question_ids || [];
    let questions = [];
    if (questionIds.length > 0) {
      const qRes = await query('SELECT * FROM questions WHERE id = ANY($1::uuid[])', [questionIds]);
      questions = qRes.rows.map((q) => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
      }));
    }

    res.json({
      intervention: {
        ...intervention,
        plan,
      },
      questions,
    });
  } catch (err) {
    console.error('Get intervention error:', err);
    res.status(500).json({ error: 'Failed to fetch intervention' });
  }
});

// POST /api/interventions/:id/attempt
// Student-facing intervention practice flow - same attempt pipeline as Practice Lab,
// tagged so it is traceable to the intervention.
router.post('/:id/attempt', requireAuth, async (req, res) => {
  try {
    const interventionId = req.params.id;
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

    // 2. Evaluate deterministically
    const evaluation = evaluateMCQ(
      question.type,
      selected_option_ids,
      evaluatorCorrectOptions,
      1.0
    );
    const isCorrect = Boolean(evaluation.is_correct);

    // 3. Record attempt tagged with source = 'practice' and linked metadata
    const attemptRes = await query(
      `INSERT INTO attempts (student_id, question_id, source, selected_option_ids, is_correct, marks_awarded)
       VALUES ($1, $2, 'practice', $3, $4, $5)
       RETURNING *`,
      [studentId, question_id, JSON.stringify(selected_option_ids), isCorrect, evaluation.marks_awarded]
    );

    // 4. Create learning evidence
    const evidenceResult = isCorrect ? 'correct' : 'incorrect';
    const evidenceRes = await query(
      `INSERT INTO learning_evidence (student_id, concept, subconcept, attempt_id, result)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [studentId, question.concept, question.subconcept, attemptRes.rows[0].id, evidenceResult]
    );

    res.status(201).json({
      attempt: attemptRes.rows[0],
      evidence: evidenceRes.rows[0],
      evaluation,
      intervention_id: interventionId,
    });
  } catch (err) {
    console.error('Intervention attempt error:', err);
    res.status(500).json({ error: 'Failed to record intervention attempt' });
  }
});

export default router;
