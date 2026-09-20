import express from 'express';
import { query } from '../db/index.js';
import { requireAuth, requireTeacher } from '../middleware/auth.js';
import { getSessionAttendanceRoster, checkAttendance } from '../services/attendanceService.js';

const router = express.Router();

// Teacher creates a new class session window (e.g. 10am-11am)
router.post('/sessions', requireAuth, requireTeacher, async (req, res) => {
  try {
    const { title, start_time, end_time } = req.body;
    if (!title || !start_time || !end_time) {
      return res.status(400).json({ error: 'title, start_time, and end_time are required' });
    }

    const result = await query(
      `INSERT INTO class_sessions (teacher_id, title, start_time, end_time)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, title.trim(), new Date(start_time), new Date(end_time)]
    );

    return res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    console.error('Create class session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// List all class sessions with total attendance count
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT cs.*, 
              u.name as teacher_name,
              COUNT(DISTINCT att.student_id) as attended_count,
              (SELECT COUNT(*) FROM users WHERE role = 'student') as total_students
       FROM class_sessions cs
       JOIN users u ON cs.teacher_id = u.id
       LEFT JOIN attendance att ON att.session_id = cs.id
       GROUP BY cs.id, u.name
       ORDER BY cs.start_time DESC`
    );

    const now = new Date();
    const sessions = result.rows.map(s => ({
      ...s,
      is_active: new Date(s.start_time) <= now && new Date(s.end_time) >= now
    }));

    return res.json({ sessions });
  } catch (err) {
    console.error('List sessions error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance/session/:id - Returns full roster with present/absent and triggering source
router.get('/session/:id', requireAuth, async (req, res) => {
  try {
    const data = await getSessionAttendanceRoster(req.params.id);
    if (!data) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.json(data);
  } catch (err) {
    console.error('Get session attendance roster error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
