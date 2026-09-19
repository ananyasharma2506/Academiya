import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/insights/class
// Aggregates learning_gaps across all students in a class/system by concept
// Single efficient SQL aggregation over the existing learning_gaps table
router.get('/class', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can access class insights' });
    }

    const result = await query(
      `SELECT
         concept,
         subconcept,
         COUNT(DISTINCT student_id) as affected_students_count,
         COUNT(CASE WHEN status = 'emerging' THEN 1 END) as emerging_count,
         COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_count,
         COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
         JSON_AGG(DISTINCT student_id) as student_ids
       FROM learning_gaps
       GROUP BY concept, subconcept
       ORDER BY affected_students_count DESC`
    );

    const aggregations = result.rows.map((row) => ({
      concept: row.concept,
      subconcept: row.subconcept,
      affected_students_count: parseInt(row.affected_students_count, 10),
      emerging_count: parseInt(row.emerging_count, 10),
      confirmed_count: parseInt(row.confirmed_count, 10),
      resolved_count: parseInt(row.resolved_count, 10),
      student_ids: row.student_ids || [],
    }));

    res.json({ insights: aggregations });
  } catch (err) {
    console.error('Class insights error:', err);
    res.status(500).json({ error: 'Failed to fetch class insights' });
  }
});

export default router;
