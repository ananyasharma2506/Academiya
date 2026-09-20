import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/practice/assessments/available - returns published assessments for students
router.get('/assessments/available', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT a.id, a.title, a.status, a.proctoring_enabled, a.integrity_rules, a.created_at,
              COUNT(q.id) as question_count
       FROM assessments a
       JOIN questions q ON q.assessment_id = a.id
       WHERE a.status = 'published'
       GROUP BY a.id
       ORDER BY a.created_at DESC`
    );
    return res.json({ assessments: result.rows });
  } catch (err) {
    console.error('Available assessments error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/practice/:student_id - returns teacher and AI generated questions available to student
router.get('/:student_id', requireAuth, async (req, res) => {
  try {
    const studentId = req.params.student_id;
    const { concept, assessment_id } = req.query;

    let sql = `
      SELECT q.id, q.concept, q.subconcept, q.type, q.statement, q.options, 
             q.bloom_level, q.difficulty, q.source, q.assessment_id, q.created_at,
             (
               SELECT json_agg(json_build_object(
                 'id', a.id,
                 'is_correct', a.is_correct,
                 'marks_awarded', a.marks_awarded,
                 'created_at', a.created_at
               ) ORDER BY a.created_at DESC)
               FROM attempts a
               WHERE a.question_id = q.id AND a.student_id = $1
             ) as student_attempts
      FROM questions q
      WHERE (q.generated_for_student_id IS NULL OR q.generated_for_student_id = $1)
    `;
    const params = [studentId];

    if (assessment_id) {
      params.push(assessment_id);
      sql += ` AND q.assessment_id = $${params.length}`;
    } else if (concept) {
      params.push(concept);
      sql += ` AND q.concept = $${params.length}`;
    }

    sql += ' ORDER BY q.created_at DESC LIMIT 50';

    const result = await query(sql, params);
    return res.json({ questions: result.rows });
  } catch (err) {
    console.error('Practice questions error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

