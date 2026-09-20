import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { getStudentGapsWithEvidence } from '../services/evidenceService.js';

const router = express.Router();

// GET /api/gaps/:student_id - returns each gap with its full evidence list expanded
router.get('/:student_id', requireAuth, async (req, res) => {
  try {
    const studentId = req.params.student_id;
    const gaps = await getStudentGapsWithEvidence(studentId);
    return res.json({ gaps });
  } catch (err) {
    console.error('Get student gaps error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/gaps - teacher class overview of all gaps
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT lg.*, u.name as student_name, u.email as student_email
       FROM learning_gaps lg
       JOIN users u ON lg.student_id = u.id
       ORDER BY lg.updated_at DESC`
    );
    return res.json({ gaps: result.rows });
  } catch (err) {
    console.error('Get all gaps error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
