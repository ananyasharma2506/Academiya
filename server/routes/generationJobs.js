import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { generationQueue } from '../services/generationQueue.js';

const router = express.Router();
const MAX_REQUESTED_COUNT = 20;

// POST /api/generation-jobs
// Teacher sends { concept, subconcept, requested_count } -> hard capped (max 20)
// -> insert row into generation_jobs with status = 'running' -> return job_id immediately
router.post('/', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can initiate generation jobs' });
    }

    const { concept, subconcept, requested_count } = req.body;

    if (!concept || !subconcept || !requested_count) {
      return res.status(400).json({ error: 'concept, subconcept, and requested_count are required' });
    }

    const parsedCount = parseInt(requested_count, 10);
    if (isNaN(parsedCount) || parsedCount <= 0) {
      return res.status(400).json({ error: 'requested_count must be a positive number' });
    }

    // Hard cap at MAX_REQUESTED_COUNT (20)
    const boundedCount = Math.min(parsedCount, MAX_REQUESTED_COUNT);

    // Build structured question blueprint before generation
    const blueprint = {
      concept: concept.trim(),
      subconcept: subconcept.trim(),
      type: req.body.type || 'mcq_single',
      bloom_level: req.body.bloom_level || 'understand',
      difficulty: req.body.difficulty || 'medium',
      constraints: req.body.constraints || {},
    };

    const insertRes = await query(
      `INSERT INTO generation_jobs (teacher_id, requested_count, generated_count, status, retry_budget_used)
       VALUES ($1, $2, 0, 'running', 0)
       RETURNING *`,
      [req.user.id, boundedCount]
    );

    const job = insertRes.rows[0];

    // Enqueue job in bounded in-process queue
    generationQueue.enqueue({
      jobId: job.id,
      blueprint,
      requestedCount: boundedCount,
    });

    // Return job_id immediately without blocking on generation
    res.status(202).json({
      job_id: job.id,
      job,
      message: 'Generation job started in background',
    });
  } catch (err) {
    console.error('Create generation job error:', err);
    res.status(500).json({ error: 'Failed to create generation job' });
  }
});

// GET /api/generation-jobs/:id
// Returns current job state and associated generated questions
// Enables clients to resync state after browser refresh
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const jobRes = await query('SELECT * FROM generation_jobs WHERE id = $1', [req.params.id]);
    if (jobRes.rows.length === 0) {
      return res.status(404).json({ error: 'Generation job not found' });
    }

    const job = jobRes.rows[0];

    // Fetch generated questions associated with this job
    const questionsRes = await query(
      `SELECT gq.id as generated_q_id, gq.status as generation_status, gq.attempt_no,
              q.*
       FROM generated_questions gq
       LEFT JOIN questions q ON gq.question_id = q.id
       WHERE gq.job_id = $1
       ORDER BY gq.created_at ASC`,
      [job.id]
    );

    res.json({
      job,
      questions: questionsRes.rows,
    });
  } catch (err) {
    console.error('Get generation job error:', err);
    res.status(500).json({ error: 'Failed to fetch generation job' });
  }
});

// POST /api/generation-jobs/:id/cancel
// Sets status = 'cancelled'. Worker checks flag and stops processing remaining items.
router.post('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const updateRes = await query(
      `UPDATE generation_jobs
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND status = 'running'
       RETURNING *`,
      [req.params.id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(400).json({ error: 'Job is not running or not found' });
    }

    res.json({
      job: updateRes.rows[0],
      message: 'Job cancelled successfully',
    });
  } catch (err) {
    console.error('Cancel generation job error:', err);
    res.status(500).json({ error: 'Failed to cancel generation job' });
  }
});

export default router;
