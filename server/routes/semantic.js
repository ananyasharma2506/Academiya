import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  generateEmbedding,
  semanticSearch,
  detectDuplicateQuestion,
  getSimilarQuestions,
} from '../services/semanticService.js';

const router = express.Router();

// POST /api/semantic/search
router.post('/search', requireAuth, async (req, res) => {
  try {
    const { query: queryText, concept, limit = 5 } = req.body;
    if (!queryText) {
      return res.status(400).json({ error: 'query text is required' });
    }

    const embedding = generateEmbedding(queryText);
    const results = await semanticSearch(embedding, { concept, limit });

    res.json({ results });
  } catch (err) {
    console.error('Semantic search error:', err);
    res.status(500).json({ error: 'Failed to perform semantic search' });
  }
});

// POST /api/semantic/check-duplicate
// Flags near-duplicates rather than silently persisting them
router.post('/check-duplicate', requireAuth, async (req, res) => {
  try {
    const { statement, concept } = req.body;
    if (!statement || !concept) {
      return res.status(400).json({ error: 'statement and concept are required' });
    }

    const dupResult = await detectDuplicateQuestion(statement, concept);
    res.json(dupResult);
  } catch (err) {
    console.error('Duplicate check error:', err);
    res.status(500).json({ error: 'Failed to check duplicate' });
  }
});

// GET /api/semantic/similar
router.get('/similar', requireAuth, async (req, res) => {
  try {
    const { concept, reference, limit } = req.query;
    if (!concept || !reference) {
      return res.status(400).json({ error: 'concept and reference query params are required' });
    }

    const results = await getSimilarQuestions(concept, reference, parseInt(limit || '3', 10));
    res.json({ similar_questions: results });
  } catch (err) {
    console.error('Similar questions error:', err);
    res.status(500).json({ error: 'Failed to fetch similar questions' });
  }
});

export default router;
