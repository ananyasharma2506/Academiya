/**
 * Semantic Layer Service (pgvector)
 *
 * Single shared semanticSearch function supporting:
 * 1. Similar-question retrieval (concept-filtered context for generation)
 * 2. Duplicate detection (high similarity threshold check)
 * 3. Resource matching (knowledge matching)
 */

import { query } from '../db/index.js';

/**
 * Generates an embedding vector for a given text input.
 * In local environment without dedicated embedding server,
 * computes deterministic normalized hash-projection embedding of 1536 dimensions.
 */
export function generateEmbedding(text) {
  const DIMENSIONS = 1536;
  const vector = new Array(DIMENSIONS).fill(0);
  const clean = (text || '').toLowerCase().trim();

  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    const index = (charCode * 31 + i * 17) % DIMENSIONS;
    vector[index] += 1.0;
  }

  // L2 normalize
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1.0;
  return vector.map((v) => Number((v / norm).toFixed(6)));
}

/**
 * Single shared semantic search capability using pgvector cosine distance (<=>).
 *
 * @param {Array<number>} embedding
 * @param {Object} options
 * @param {string} [options.concept]
 * @param {number} [options.limit=5]
 * @param {number} [options.maxDistance=1.0]
 * @returns {Promise<Array>}
 */
export async function semanticSearch(embedding, { concept = null, limit = 5, maxDistance = 1.0 } = {}) {
  const vectorStr = `[${embedding.join(',')}]`;

  let sql = `
    SELECT id, concept, subconcept, statement, type, options, correct_option_ids,
           (embedding <=> $1::vector) as distance,
           (1 - (embedding <=> $1::vector)) as similarity
    FROM questions
    WHERE embedding IS NOT NULL
  `;
  const params = [vectorStr];

  if (concept) {
    params.push(concept);
    sql += ` AND concept = $${params.length}`;
  }

  params.push(limit);
  sql += ` ORDER BY embedding <=> $1::vector ASC LIMIT $${params.length}`;

  const res = await query(sql, params);
  return res.rows.filter((row) => row.distance <= maxDistance);
}

/**
 * Duplicate detection using semanticSearch with a high similarity threshold (e.g. >= 0.92)
 */
export async function detectDuplicateQuestion(statement, concept) {
  const embedding = generateEmbedding(statement);
  // Distance <= 0.08 is equivalent to similarity >= 0.92
  const matches = await semanticSearch(embedding, { concept, limit: 1, maxDistance: 0.08 });
  if (matches.length > 0) {
    return {
      is_duplicate: true,
      matched_question: matches[0],
      similarity: matches[0].similarity,
    };
  }
  return { is_duplicate: false };
}

/**
 * Similar-question retrieval: concept-filtered similarity search for context
 */
export async function getSimilarQuestions(concept, referenceStatement, limit = 3) {
  const embedding = generateEmbedding(referenceStatement);
  return semanticSearch(embedding, { concept, limit, maxDistance: 0.6 });
}
