import express from 'express';
import { query } from '../db/index.js';
import { requireAuth, requireTeacher } from '../middleware/auth.js';
import { generatePlan } from '../ai/modelAdapter.js';

const router = express.Router();

// POST /api/interventions - Teacher creates intervention
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

    // Find diagnostic blueprint if available
    const diagRes = await query(
      'SELECT blueprint FROM diagnostics WHERE gap_id = $1 ORDER BY created_at DESC LIMIT 1',
      [gap_id]
    );
    const diagnosis = diagRes.rows.length > 0 ? diagRes.rows[0].blueprint : null;

    // Generate learning plan
    const plan = await generatePlan(gap, diagnosis);

    // Save practice questions from the plan
    const persistedPracticeQuestions = [];
    if (plan.practice_questions && Array.isArray(plan.practice_questions)) {
      for (const pq of plan.practice_questions) {
        const qRes = await query(
          `INSERT INTO questions
           (concept, subconcept, type, statement, options, correct_option_ids, bloom_level, difficulty, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ai')
           RETURNING *`,
          [
            gap.concept,
            gap.subconcept,
            pq.type || 'mcq_single',
            pq.statement,
            JSON.stringify(pq.options),
            JSON.stringify(pq.correct_option_ids),
            pq.bloom_level || 'apply',
            pq.difficulty || 'medium'
          ]
        );
        persistedPracticeQuestions.push(qRes.rows[0]);
      }
    }

    // Save intervention
    const intRes = await query(
      `INSERT INTO interventions (gap_id, plan, target_concept, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING *`,
      [
        gap_id,
        JSON.stringify({ ...plan, generated_question_ids: persistedPracticeQuestions.map(q => q.id) }),
        gap.concept
      ]
    );

    return res.status(201).json({
      intervention: intRes.rows[0],
      practice_questions: persistedPracticeQuestions
    });
  } catch (err) {
    console.error('Create intervention error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/interventions/student/:student_id
router.get('/student/:student_id', requireAuth, async (req, res) => {
  try {
    const studentId = req.params.student_id;
    const result = await query(
      `SELECT i.*, lg.concept, lg.subconcept, lg.status as gap_status
       FROM interventions i
       JOIN learning_gaps lg ON i.gap_id = lg.id
       WHERE lg.student_id = $1
       ORDER BY i.created_at DESC`,
      [studentId]
    );
    return res.json({ interventions: result.rows });
  } catch (err) {
    console.error('Get student interventions error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/interventions/gap/:gap_id
router.get('/gap/:gap_id', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM interventions WHERE gap_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.params.gap_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention not found' });
    }
    return res.json({ intervention: result.rows[0] });
  } catch (err) {
    console.error('Get gap intervention error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/interventions/:id/complete
router.post('/:id/complete', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `UPDATE interventions
       SET status = 'completed'
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intervention not found' });
    }
    return res.json({ intervention: result.rows[0] });
  } catch (err) {
    console.error('Complete intervention error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
