/**
 * Evidence Aggregation and Gap Detection Service
 *
 * WEIGHTING STRATEGY:
 * We use an exponential decay weighting strategy based on attempt age (recency).
 * Each evidence item is weighted by: weight = e^(-lambda * age_in_hours)
 * where lambda = 0.05 (half-life of approximately 14 hours).
 * For immediate consecutive attempts in a practice session (small age difference),
 * weights decay progressively, ensuring recent attempts have strictly greater influence.
 *
 * GAP DETECTION THRESHOLD:
 * A learning gap is flagged when:
 * 1. Total evidence count for the student + concept is at least 3.
 * 2. Weighted incorrect ratio >= 60% (0.60).
 * 3. No open gap (status = 'emerging' or 'confirmed') currently exists for that student + concept.
 *
 * STATUS:
 * Gaps are strictly created with status = 'emerging', and backed by the triggering
 * evidence entries. NO opaque risk or confidence scores are stored or computed.
 */

import { query } from '../db/index.js';

const LAMBDA = 0.05;
const MIN_ATTEMPTS_THRESHOLD = 3;
const INCORRECT_RATIO_THRESHOLD = 0.60;

/**
 * Reads all learning_evidence rows for that student + concept,
 * weighted by recency via exponential decay.
 *
 * @param {string} studentId
 * @param {string} concept
 * @returns {Promise<{
 *   evidence: Array,
 *   totalWeight: number,
 *   weightedIncorrect: number,
 *   weightedRatio: number,
 *   totalCount: number
 * }>}
 */
export async function aggregateEvidence(studentId, concept) {
  const result = await query(
    `SELECT id, student_id, concept, subconcept, attempt_id, result, created_at
     FROM learning_evidence
     WHERE student_id = $1 AND concept = $2
     ORDER BY created_at ASC`,
    [studentId, concept]
  );

  const evidence = result.rows;
  if (evidence.length === 0) {
    return {
      evidence: [],
      totalWeight: 0,
      weightedIncorrect: 0,
      weightedRatio: 0,
      totalCount: 0,
    };
  }

  const now = new Date().getTime();
  let totalWeight = 0;
  let weightedIncorrect = 0;

  for (const item of evidence) {
    const itemTime = new Date(item.created_at).getTime();
    const ageHours = Math.max(0, (now - itemTime) / (1000 * 60 * 60));
    const weight = Math.exp(-LAMBDA * ageHours);

    totalWeight += weight;
    if (item.result === 'incorrect') {
      weightedIncorrect += weight;
    }
  }

  const weightedRatio = totalWeight > 0 ? weightedIncorrect / totalWeight : 0;

  return {
    evidence,
    totalWeight,
    weightedIncorrect,
    weightedRatio,
    totalCount: evidence.length,
  };
}

/**
 * Checks whether evidence crosses the failure threshold.
 * If >= 60% incorrect over >= 3 attempts and no open gap exists,
 * inserts a row into learning_gaps with status = 'emerging'
 * and evidence_ids set to the triggering evidence IDs.
 *
 * @param {string} studentId
 * @param {string} concept
 * @returns {Promise<Object|null>} The created gap or null
 */
export async function detectGap(studentId, concept) {
  const aggregation = await aggregateEvidence(studentId, concept);

  if (aggregation.totalCount < MIN_ATTEMPTS_THRESHOLD) {
    return null;
  }

  if (aggregation.weightedRatio < INCORRECT_RATIO_THRESHOLD) {
    return null;
  }

  // Check if an open gap already exists for this student + concept
  const existingGap = await query(
    `SELECT id, status FROM learning_gaps
     WHERE student_id = $1 AND concept = $2 AND status IN ('emerging', 'confirmed')`,
    [studentId, concept]
  );

  if (existingGap.rows.length > 0) {
    return null; // Open gap already exists
  }

  // Extract triggering subconcept from the most recent evidence
  const subconcept = aggregation.evidence[aggregation.evidence.length - 1]?.subconcept || '';
  const evidenceIds = aggregation.evidence.map((e) => e.id);

  const insertRes = await query(
    `INSERT INTO learning_gaps (student_id, concept, subconcept, status, evidence_ids)
     VALUES ($1, $2, $3, 'emerging', $4)
     RETURNING *`,
    [studentId, concept, subconcept, JSON.stringify(evidenceIds)]
  );

  return insertRes.rows[0];
}
