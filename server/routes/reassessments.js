import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { generateQuestion } from '../ai/modelAdapter.js';
import { evaluateMCQ } from '../lib/evaluator.js';

const router = express.Router();

// POST /api/reassessments
// After intervention's practice is complete, administer reassessment attempt on the same concept
// -> insert into reassessments linking new attempt_id and intervention_id
// -> compare evidence set from before intervention to after -> insert into progress with delta
router.post('/', requireAuth, async (req, res) => {
  try {
    const studentId = req.user.id;
    const { intervention_id, question_id, selected_option_ids } = req.body;

    if (!intervention_id) {
      return res.status(400).json({ error: 'intervention_id is required' });
    }

    // 1. Fetch intervention
    const intRes = await query('SELECT * FROM interventions WHERE id = $1', [intervention_id]);
    if (intRes.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention not found' });
    }
    const intervention = intRes.rows[0];
    const targetConcept = intervention.target_concept;

    // 2. Either use provided question or generate a fresh reassessment question on the same concept
    let qId = question_id;
    let question = null;

    if (!qId) {
      const generated = await generateQuestion({
        concept: targetConcept,
        subconcept: 'Reassessment Mastery',
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
      question = qRes.rows[0];
      qId = question.id;
    } else {
      const qRes = await query('SELECT * FROM questions WHERE id = $1', [qId]);
      question = qRes.rows[0];
    }

    // 3. Evaluate attempt deterministically
    const options = typeof question.options === 'string' ? JSON.parse(question.options) : question.options;
    const correctOptionIds = typeof question.correct_option_ids === 'string'
      ? JSON.parse(question.correct_option_ids)
      : question.correct_option_ids;

    const evaluatorCorrectOptions = options.map((opt) => ({
      id: opt.id,
      is_correct: correctOptionIds.includes(opt.id),
    }));

    const evaluation = evaluateMCQ(
      question.type,
      selected_option_ids,
      evaluatorCorrectOptions,
      1.0
    );
    const isCorrect = Boolean(evaluation.is_correct);

    // 4. Insert into attempts with source = 'reassessment'
    const attemptRes = await query(
      `INSERT INTO attempts (student_id, question_id, source, selected_option_ids, is_correct, marks_awarded)
       VALUES ($1, $2, 'reassessment', $3, $4, $5)
       RETURNING *`,
      [studentId, qId, JSON.stringify(selected_option_ids), isCorrect, evaluation.marks_awarded]
    );
    const attempt = attemptRes.rows[0];

    // 5. Insert into learning_evidence
    const evidenceResult = isCorrect ? 'correct' : 'incorrect';
    const evidenceRes = await query(
      `INSERT INTO learning_evidence (student_id, concept, subconcept, attempt_id, result)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [studentId, question.concept, question.subconcept, attempt.id, evidenceResult]
    );
    const newEvidence = evidenceRes.rows[0];

    // 6. Insert into reassessments table
    const reassessmentRes = await query(
      `INSERT INTO reassessments (intervention_id, student_id, attempt_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [intervention_id, studentId, attempt.id]
    );

    // 7. Calculate before vs after evidence comparison & insert into progress
    // Before evidence: evidence created BEFORE the intervention's created_at
    const beforeEvidenceRes = await query(
      `SELECT id, result, created_at FROM learning_evidence
       WHERE student_id = $1 AND concept = $2 AND created_at < $3
       ORDER BY created_at ASC`,
      [studentId, targetConcept, intervention.created_at]
    );

    // After evidence: evidence created AFTER the intervention's created_at
    const afterEvidenceRes = await query(
      `SELECT id, result, created_at FROM learning_evidence
       WHERE student_id = $1 AND concept = $2 AND created_at >= $3
       ORDER BY created_at ASC`,
      [studentId, targetConcept, intervention.created_at]
    );

    const beforeList = beforeEvidenceRes.rows;
    const afterList = afterEvidenceRes.rows;

    const beforeCorrect = beforeList.filter((e) => e.result === 'correct').length;
    const beforeAccuracy = beforeList.length > 0 ? Math.round((beforeCorrect / beforeList.length) * 100) : 0;

    const afterCorrect = afterList.filter((e) => e.result === 'correct').length;
    const afterAccuracy = afterList.length > 0 ? Math.round((afterCorrect / afterList.length) * 100) : 0;

    // Delta shows both raw figures before and after (never a mysterious single score)
    const delta = {
      concept: targetConcept,
      before: {
        total: beforeList.length,
        correct: beforeCorrect,
        accuracy_percent: beforeAccuracy,
      },
      after: {
        total: afterList.length,
        correct: afterCorrect,
        accuracy_percent: afterAccuracy,
      },
      mastery_improved: afterAccuracy > beforeAccuracy,
    };

    const progressRes = await query(
      `INSERT INTO progress (student_id, concept, before_evidence_ids, after_evidence_ids, delta)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        studentId,
        targetConcept,
        JSON.stringify(beforeList.map((e) => e.id)),
        JSON.stringify(afterList.map((e) => e.id)),
        JSON.stringify(delta),
      ]
    );

    // Mark gap as resolved if mastery improved to >= 70%
    if (afterAccuracy >= 70) {
      await query(
        `UPDATE learning_gaps
         SET status = 'resolved', updated_at = NOW()
         WHERE id = $1`,
        [intervention.gap_id]
      );
    }

    res.status(201).json({
      reassessment: reassessmentRes.rows[0],
      attempt,
      new_evidence: newEvidence,
      progress: progressRes.rows[0],
      delta,
    });
  } catch (err) {
    console.error('Reassessment error:', err);
    res.status(500).json({ error: 'Failed to process reassessment' });
  }
});

// GET /api/reassessments/progress/:student_id
// Returns before/after progress records for student
router.get('/progress/:student_id', requireAuth, async (req, res) => {
  try {
    const studentId = req.params.student_id;
    const result = await query(
      `SELECT * FROM progress
       WHERE student_id = $1
       ORDER BY created_at DESC`,
      [studentId]
    );

    const records = result.rows.map((r) => ({
      ...r,
      delta: typeof r.delta === 'string' ? JSON.parse(r.delta) : r.delta,
      before_evidence_ids: typeof r.before_evidence_ids === 'string' ? JSON.parse(r.before_evidence_ids) : r.before_evidence_ids,
      after_evidence_ids: typeof r.after_evidence_ids === 'string' ? JSON.parse(r.after_evidence_ids) : r.after_evidence_ids,
    }));

    res.json({ progress: records });
  } catch (err) {
    console.error('Get progress error:', err);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

export default router;
