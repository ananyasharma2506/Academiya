import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { evaluateMCQ } from '../lib/evaluator.js';

const router = express.Router();

// POST /api/reassessments - Administer reassessment attempt and compute progress
router.post('/reassessments', requireAuth, async (req, res) => {
  try {
    const studentId = req.user.id;
    const { intervention_id, question_id, selected_option_ids } = req.body;

    if (!intervention_id || !question_id) {
      return res.status(400).json({ error: 'intervention_id and question_id are required' });
    }

    // Fetch intervention & gap
    const intRes = await query(
      `SELECT i.*, lg.concept, lg.subconcept, lg.id as gap_id
       FROM interventions i
       JOIN learning_gaps lg ON i.gap_id = lg.id
       WHERE i.id = $1`,
      [intervention_id]
    );
    if (intRes.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention not found' });
    }
    const intervention = intRes.rows[0];

    // Fetch question
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

    // 1. Insert attempt (source = 'reassessment')
    const attemptRes = await query(
      `INSERT INTO attempts 
       (student_id, question_id, source, selected_option_ids, is_correct, marks_awarded)
       VALUES ($1, $2, 'reassessment', $3, $4, $5)
       RETURNING *`,
      [
        studentId,
        question_id,
        JSON.stringify(selected_option_ids),
        evalResult.is_correct,
        evalResult.marks_awarded
      ]
    );
    const attempt = attemptRes.rows[0];

    // 2. Insert new learning evidence
    const evRes = await query(
      `INSERT INTO learning_evidence 
       (student_id, concept, subconcept, attempt_id, result)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        studentId,
        intervention.concept,
        intervention.subconcept,
        attempt.id,
        evalResult.is_correct ? 'correct' : 'incorrect'
      ]
    );
    const newEvidence = evRes.rows[0];

    // 3. Insert into reassessments linking attempt_id and intervention_id
    const reassessRes = await query(
      `INSERT INTO reassessments (intervention_id, student_id, attempt_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [intervention_id, studentId, attempt.id]
    );

    // 4. Compute before/after evidence sets and delta
    // Baseline evidence: attempts created before intervention.created_at
    const beforeEvRes = await query(
      `SELECT id, result, created_at FROM learning_evidence
       WHERE student_id = $1 AND concept = $2 AND created_at <= $3
       ORDER BY created_at ASC`,
      [studentId, intervention.concept, intervention.created_at]
    );

    // Post-intervention evidence: attempts created after intervention.created_at
    const afterEvRes = await query(
      `SELECT id, result, created_at FROM learning_evidence
       WHERE student_id = $1 AND concept = $2 AND created_at > $3
       ORDER BY created_at ASC`,
      [studentId, intervention.concept, intervention.created_at]
    );

    const beforeRows = beforeEvRes.rows;
    const afterRows = afterEvRes.rows;

    const beforeCorrect = beforeRows.filter(r => r.result === 'correct').length;
    const beforeTotal = beforeRows.length;
    const beforeAccuracy = beforeTotal > 0 ? Math.round((beforeCorrect / beforeTotal) * 100) : 0;

    const afterCorrect = afterRows.filter(r => r.result === 'correct').length;
    const afterTotal = afterRows.length;
    const afterAccuracy = afterTotal > 0 ? Math.round((afterCorrect / afterTotal) * 100) : 0;

    const deltaObj = {
      before_accuracy_pct: beforeAccuracy,
      before_correct: beforeCorrect,
      before_total: beforeTotal,
      after_accuracy_pct: afterAccuracy,
      after_correct: afterCorrect,
      after_total: afterTotal,
      accuracy_gain_pct: afterAccuracy - beforeAccuracy,
      reassessment_passed: evalResult.is_correct
    };

    // 5. Insert into progress table
    const progRes = await query(
      `INSERT INTO progress (student_id, concept, before_evidence_ids, after_evidence_ids, delta)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        studentId,
        intervention.concept,
        JSON.stringify(beforeRows.map(r => r.id)),
        JSON.stringify(afterRows.map(r => r.id)),
        JSON.stringify(deltaObj)
      ]
    );

    // 6. If reassessment passed, resolve the gap and mark intervention completed!
    if (evalResult.is_correct) {
      await query(
        `UPDATE learning_gaps
         SET status = 'resolved', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [intervention.gap_id]
      );
      await query(
        `UPDATE interventions
         SET status = 'completed'
         WHERE id = $1`,
        [intervention_id]
      );
    }

    return res.status(201).json({
      reassessment: reassessRes.rows[0],
      evaluation: evalResult,
      progress: progRes.rows[0],
      gap_resolved: evalResult.is_correct
    });
  } catch (err) {
    console.error('Reassessment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/progress/:student_id
router.get('/:student_id', requireAuth, async (req, res) => {
  try {
    const studentId = req.params.student_id;
    const result = await query(
      `SELECT p.*
       FROM progress p
       WHERE p.student_id = $1
       ORDER BY p.created_at DESC`,
      [studentId]
    );

    // Enrich with evidence details
    const enriched = await Promise.all(
      result.rows.map(async (row) => {
        let beforeIds = [];
        let afterIds = [];
        try {
          beforeIds = typeof row.before_evidence_ids === 'string' ? JSON.parse(row.before_evidence_ids) : row.before_evidence_ids;
          afterIds = typeof row.after_evidence_ids === 'string' ? JSON.parse(row.after_evidence_ids) : row.after_evidence_ids;
        } catch {}

        const beforeItems = beforeIds.length > 0 ? (await query(
          `SELECT le.*, q.statement, a.marks_awarded, a.source as attempt_source
           FROM learning_evidence le
           JOIN attempts a ON le.attempt_id = a.id
           JOIN questions q ON a.question_id = q.id
           WHERE le.id = ANY($1::uuid[])`,
          [beforeIds]
        )).rows : [];

        const afterItems = afterIds.length > 0 ? (await query(
          `SELECT le.*, q.statement, a.marks_awarded, a.source as attempt_source
           FROM learning_evidence le
           JOIN attempts a ON le.attempt_id = a.id
           JOIN questions q ON a.question_id = q.id
           WHERE le.id = ANY($1::uuid[])`,
          [afterIds]
        )).rows : [];

        return {
          ...row,
          before_evidence: beforeItems,
          after_evidence: afterItems
        };
      })
    );

    return res.json({ progress: enriched });
  } catch (err) {
    console.error('Get progress error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
