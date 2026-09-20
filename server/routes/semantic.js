import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { findSimilarQuestions, checkDuplicateQuestion } from '../services/semanticService.js';

const router = express.Router();

router.post('/similar', requireAuth, async (req, res) => {
  try {
    const { text, concept } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }
    const results = await findSimilarQuestions(text, concept);
    return res.json({ matches: results });
  } catch (err) {
    console.error('Similar search error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/check-duplicate', requireAuth, async (req, res) => {
  try {
    const { statement, concept } = req.body;
    if (!statement) {
      return res.status(400).json({ error: 'statement is required' });
    }
    const duplicate = await checkDuplicateQuestion(statement, concept);
    return res.json({
      is_duplicate: Boolean(duplicate),
      duplicate
    });
  } catch (err) {
    console.error('Duplicate check error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
