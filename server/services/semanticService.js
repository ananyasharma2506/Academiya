/**
 * Semantic Layer Service (pgvector)
 * Single unified semanticSearch(embedding, filter, limit, threshold) function per spec (Phase 9)
 */

import { query } from '../db/index.js';
import { generateEmbedding } from '../ai/modelAdapter.js';

export async function semanticSearch(embedding, filter = {}, limit = 5, threshold = 0.85) {
  const vectorStr = `[${embedding.join(',')}]`;
  let sql = `
    SELECT id, concept, subconcept, statement, type, options, bloom_level, difficulty, source,
           1 - (embedding <=> $1::vector) AS similarity
    FROM questions
    WHERE embedding IS NOT NULL
  `;
  const params = [vectorStr];

  if (filter.concept) {
    params.push(filter.concept);
    sql += ` AND concept = $${params.length}`;
  }

  if (filter.exclude_id) {
    params.push(filter.exclude_id);
    sql += ` AND id != $${params.length}`;
  }

  sql += ` AND (1 - (embedding <=> $1::vector)) >= ${threshold}`;
  sql += ` ORDER BY similarity DESC LIMIT ${limit}`;

  const res = await query(sql, params);
  return res.rows;
}

export async function findSimilarQuestions(text, concept = null, limit = 5) {
  const embedding = await generateEmbedding(text);
  return await semanticSearch(embedding, { concept }, limit, 0.5);
}

export async function checkDuplicateQuestion(statement, concept = null) {
  const embedding = await generateEmbedding(statement);
  // High similarity threshold for duplicate detection per spec
  const matches = await semanticSearch(embedding, { concept }, 1, 0.90);
  return matches.length > 0 ? matches[0] : null;
}
