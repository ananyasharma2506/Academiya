import express from 'express';
import { query } from '../db/index.js';
import { requireAuth, requireTeacher } from '../middleware/auth.js';

const router = express.Router();

// GET /api/insights/class - Single aggregation query over learning_gaps
router.get('/class', requireAuth, requireTeacher, async (req, res) => {
  try {
    const conceptAgg = await query(`
      SELECT 
        concept,
        subconcept,
        COUNT(DISTINCT student_id) FILTER (WHERE status = 'emerging') as emerging_students_count,
        COUNT(DISTINCT student_id) FILTER (WHERE status = 'confirmed') as confirmed_students_count,
        COUNT(DISTINCT student_id) FILTER (WHERE status = 'resolved') as resolved_students_count,
        COUNT(DISTINCT student_id) as total_affected_students,
        json_agg(json_build_object(
          'gap_id', lg.id,
          'student_id', lg.student_id,
          'student_name', u.name,
          'status', lg.status,
          'created_at', lg.created_at
        ) ORDER BY lg.created_at DESC) as student_gaps
      FROM learning_gaps lg
      JOIN users u ON lg.student_id = u.id
      GROUP BY concept, subconcept
      ORDER BY emerging_students_count DESC, total_affected_students DESC
    `);

    const summaryStats = await query(`
      SELECT 
        COUNT(DISTINCT id) as total_gaps,
        COUNT(DISTINCT id) FILTER (WHERE status = 'emerging') as emerging_gaps,
        COUNT(DISTINCT id) FILTER (WHERE status = 'confirmed') as confirmed_gaps,
        COUNT(DISTINCT id) FILTER (WHERE status = 'resolved') as resolved_gaps,
        COUNT(DISTINCT student_id) as total_students_with_gaps
      FROM learning_gaps
    `);

    return res.json({
      summary: summaryStats.rows[0],
      concepts: conceptAgg.rows
    });
  } catch (err) {
    console.error('Class insights error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
