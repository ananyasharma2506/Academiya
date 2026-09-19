import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/practice/:student_id
// Returns published teacher questions + AI-generated questions available to that student
router.get('/:student_id', requireAuth, async (req, res) => {
  try {
    const studentId = req.params.student_id;

    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Returns questions that are:
    // 1. Teacher questions (either standalone or from published assessments)
    // 2. AI-generated questions validated for practice
    const result = await query(
      `SELECT q.id, q.concept, q.subconcept, q.type, q.statement,
              q.options, q.bloom_level, q.difficulty, q.source, q.created_at,
              a.id as attempt_id, a.is_correct as last_attempt_correct
       FROM questions q
       LEFT JOIN assessments asm ON q.assessment_id = asm.id
       LEFT JOIN LATERAL (
         SELECT id, is_correct
         FROM attempts
         WHERE attempts.question_id = q.id AND attempts.student_id = $1
         ORDER BY created_at DESC
         LIMIT 1
       ) a ON true
       WHERE (q.source = 'ai')
          OR (q.source = 'teacher' AND (q.assessment_id IS NULL OR asm.status = 'published'))
       ORDER BY q.created_at DESC`,
      [studentId]
    );

    // Sanitize correct options so student client does not receive answers prematurely
    const questions = result.rows.map((q) => ({
      ...q,
      options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
    }));

    res.json({ questions });
  } catch (err) {
    console.error('Get practice questions error:', err);
    res.status(500).json({ error: 'Failed to fetch practice questions' });
  }
});

export default router;
