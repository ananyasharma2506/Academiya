import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/questions/seed
// Teacher submits an MCQ (concept, subconcept, statement, options, correct_option_ids)
// Inserted into questions with source = 'teacher'
router.post('/seed', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can seed questions' });
    }

    const {
      concept,
      subconcept,
      statement,
      options,
      correct_option_ids,
      type = 'mcq_single',
      bloom_level,
      difficulty,
      assessment_id = null,
    } = req.body;

    if (!concept || !subconcept || !statement || !options || !correct_option_ids) {
      return res.status(400).json({
        error: 'concept, subconcept, statement, options, and correct_option_ids are required',
      });
    }

    if (!['mcq_single', 'mcq_multi', 'coding'].includes(type)) {
      return res.status(400).json({ error: 'Invalid question type' });
    }

    const result = await query(
      `INSERT INTO questions (
        assessment_id, concept, subconcept, type, statement,
        options, correct_option_ids, bloom_level, difficulty, source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'teacher')
      RETURNING *`,
      [
        assessment_id,
        concept.trim(),
        subconcept.trim(),
        type,
        statement.trim(),
        JSON.stringify(options),
        JSON.stringify(correct_option_ids),
        bloom_level || null,
        difficulty || null,
      ]
    );

    res.status(201).json({ question: result.rows[0] });
  } catch (err) {
    console.error('Seed question error:', err);
    res.status(500).json({ error: 'Failed to seed question' });
  }
});

// GET /api/questions/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM questions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.json({ question: result.rows[0] });
  } catch (err) {
    console.error('Get question error:', err);
    res.status(500).json({ error: 'Failed to fetch question' });
  }
});

export default router;
