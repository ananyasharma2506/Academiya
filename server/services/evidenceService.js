/**
 * Evidence Aggregation & Learning Gap Detection Service
 * 
 * DESIGN STRATEGY:
 * We use an Exponential Recency-Weighted Window of up to the last 10 attempts
 * for each student + concept. 
 * Weight formula: w_i = (0.85)^i where i=0 is the most recent attempt.
 * A gap is triggered when:
 * 1. Total evidence attempts for the concept >= 3
 * 2. Weighted incorrect ratio >= 60% (0.60)
 * 3. No active ('emerging' or 'confirmed') gap currently exists for this student + concept.
 * 
 * When triggered, a new learning gap is inserted with status = 'emerging',
 * storing the exact evidence IDs that contributed to the trigger.
 * ZERO opaque numeric risk scores are computed or stored.
 */

import { query } from '../db/index.js';

export const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

/**
 * Bloom-level weight profile chosen by demonstrated accuracy on a concept.
 * Every level always keeps weight >= 1 so a generation request still covers
 * all six levels — capability only shifts the emphasis, it never excludes one.
 */
function weightsForAccuracy(accuracy) {
  if (accuracy === null) return [1, 1, 1, 1, 1, 1]; // no evidence yet: even spread
  if (accuracy < 0.4) return [4, 3, 2, 1, 1, 1]; // struggling: emphasize foundational levels
  if (accuracy > 0.75) return [1, 1, 1, 2, 3, 4]; // strong: emphasize higher-order levels
  return [1, 2, 2, 2, 2, 1]; // solid grasp: balanced, slight lean to apply/analyze
}

/** Largest-remainder rounding so proportional counts always sum to exactly `count`. */
function distributeCounts(weights, count) {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map(w => (w / totalWeight) * count);
  const floors = raw.map(Math.floor);
  const remainder = count - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floors];
  for (let k = 0; k < remainder; k++) {
    result[order[k % order.length].i] += 1;
  }

  return BLOOM_LEVELS.reduce((acc, level, i) => {
    acc[level] = result[i];
    return acc;
  }, {});
}

/**
 * Recent accuracy for a concept/subconcept, scoped to one student or the
 * whole student population. Returns null when there is not yet any evidence
 * (kept distinct from 0, which would mean "evidence exists and it's all wrong").
 */
async function conceptAccuracy(concept, subconcept, studentId = null) {
  const params = [concept, subconcept];
  let studentFilter = '';
  if (studentId) {
    params.push(studentId);
    studentFilter = `AND student_id = $${params.length}`;
  }

  const result = await query(
    `SELECT result FROM learning_evidence
     WHERE concept = $1 AND subconcept = $2 ${studentFilter}
     ORDER BY created_at DESC
     LIMIT 20`,
    params
  );

  if (result.rows.length === 0) return null;
  const correct = result.rows.filter(r => r.result === 'correct').length;
  return correct / result.rows.length;
}

/** Personalizes a Bloom-level count distribution to one student's own evidence. */
export async function computeStudentBloomDistribution(studentId, concept, subconcept, count) {
  const accuracy = await conceptAccuracy(concept, subconcept, studentId);
  return {
    distribution: distributeCounts(weightsForAccuracy(accuracy), count),
    capability_basis: { scope: 'student', accuracy }
  };
}

/** Structures a Bloom-level count distribution using class-wide (all students) evidence. */
export async function computeClassBloomDistribution(concept, subconcept, count) {
  const accuracy = await conceptAccuracy(concept, subconcept, null);
  return {
    distribution: distributeCounts(weightsForAccuracy(accuracy), count),
    capability_basis: { scope: 'class', accuracy }
  };
}

export async function aggregateEvidence(studentId, concept) {
  const result = await query(
    `SELECT id, student_id, concept, subconcept, attempt_id, result, source, created_at
     FROM learning_evidence
     WHERE student_id = $1 AND concept = $2
     ORDER BY created_at DESC
     LIMIT 10`,
    [studentId, concept]
  );

  const rows = result.rows;
  if (rows.length === 0) {
    return {
      total_count: 0,
      weighted_incorrect_ratio: 0,
      evidence_rows: []
    };
  }

  const DECAY = 0.85;
  let totalWeight = 0;
  let incorrectWeight = 0;

  rows.forEach((row, index) => {
    // Recency decay factor
    const recencyWeight = Math.pow(DECAY, index);
    // Trust weight: deterministic evidence has full trust (1.0),
    // ai_graded_descriptive has lower trust (0.6) per Phase 10 spec.
    const trustWeight = row.source === 'ai_graded_descriptive' ? 0.6 : 1.0;
    const effectiveWeight = recencyWeight * trustWeight;

    totalWeight += effectiveWeight;
    if (row.result === 'incorrect') {
      incorrectWeight += effectiveWeight;
    }
  });

  const weightedIncorrectRatio = totalWeight > 0 ? (incorrectWeight / totalWeight) : 0;

  return {
    total_count: rows.length,
    weighted_incorrect_ratio: weightedIncorrectRatio,
    evidence_rows: rows
  };
}

export async function detectGap(studentId, concept, subconcept) {
  const aggregation = await aggregateEvidence(studentId, concept);

  // Require at least 3 attempts and >= 60% weighted incorrect ratio
  if (aggregation.total_count < 3 || aggregation.weighted_incorrect_ratio < 0.60) {
    return null;
  }

  // Check if an open gap ('emerging' or 'confirmed') already exists
  const existingGap = await query(
    `SELECT id, status, evidence_ids 
     FROM learning_gaps 
     WHERE student_id = $1 AND concept = $2 AND status IN ('emerging', 'confirmed')
     LIMIT 1`,
    [studentId, concept]
  );

  const triggeringEvidenceIds = aggregation.evidence_rows.map(e => e.id);

  if (existingGap.rows.length > 0) {
    // Gap already exists; we update updated_at and refresh evidence_ids if needed
    const currentGap = existingGap.rows[0];
    await query(
      `UPDATE learning_gaps
       SET evidence_ids = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(triggeringEvidenceIds), currentGap.id]
    );
    return { gap_id: currentGap.id, status: currentGap.status, is_new: false };
  }

  // Create new emerging gap
  const insertResult = await query(
    `INSERT INTO learning_gaps (student_id, concept, subconcept, status, evidence_ids)
     VALUES ($1, $2, $3, 'emerging', $4)
     RETURNING *`,
    [
      studentId,
      concept,
      subconcept || (aggregation.evidence_rows[0]?.subconcept || concept),
      JSON.stringify(triggeringEvidenceIds)
    ]
  );

  return { gap_id: insertResult.rows[0].id, status: 'emerging', is_new: true, gap: insertResult.rows[0] };
}

export async function getStudentGapsWithEvidence(studentId) {
  const gapsResult = await query(
    `SELECT * FROM learning_gaps
     WHERE student_id = $1
     ORDER BY updated_at DESC`,
    [studentId]
  );

  const gaps = gapsResult.rows;

  // Expand full evidence rows for each gap
  const enrichedGaps = await Promise.all(
    gaps.map(async (gap) => {
      let evidenceIds = [];
      try {
        evidenceIds = typeof gap.evidence_ids === 'string' 
          ? JSON.parse(gap.evidence_ids) 
          : (gap.evidence_ids || []);
      } catch {
        evidenceIds = [];
      }

      if (evidenceIds.length === 0) {
        return { ...gap, evidence: [] };
      }

      const evidenceQuery = await query(
        `SELECT le.id, le.concept, le.subconcept, le.result, le.source as evidence_source, le.created_at,
                a.source as attempt_source, a.marks_awarded, a.selected_option_ids, a.grading_details,
                q.statement, q.type as question_type, q.bloom_level
         FROM learning_evidence le
         LEFT JOIN attempts a ON le.attempt_id = a.id
         LEFT JOIN questions q ON a.question_id = q.id
         WHERE le.id = ANY($1::uuid[])
         ORDER BY le.created_at DESC`,
        [evidenceIds]
      );

      return {
        ...gap,
        evidence: evidenceQuery.rows
      };
    })
  );

  return enrichedGaps;
}

/**
 * A ranked list of concept/subconcept pairs this student is weakest in,
 * combining confirmed/emerging learning gaps (strongest signal) with recent
 * evidence that hasn't crossed the gap threshold yet but still skews
 * incorrect. Used to personalize AI generation (Code Lab challenges, Practice
 * Lab questions) toward what the student actually needs practice on, rather
 * than a manually-typed topic — the "academic graph" data driving both.
 */
export async function getWeaknessProfile(studentId, limit = 5) {
  const gapsRes = await query(
    `SELECT concept, subconcept, status, updated_at
     FROM learning_gaps
     WHERE student_id = $1 AND status IN ('emerging', 'confirmed')
     ORDER BY updated_at DESC`,
    [studentId]
  );

  const evidenceRes = await query(
    `SELECT concept, subconcept,
            COUNT(*) FILTER (WHERE result = 'incorrect')::float / COUNT(*) AS incorrect_ratio,
            COUNT(*) AS total,
            MAX(created_at) AS last_seen
     FROM learning_evidence
     WHERE student_id = $1
     GROUP BY concept, subconcept
     HAVING COUNT(*) >= 2
     ORDER BY incorrect_ratio DESC, last_seen DESC`,
    [studentId]
  );

  const byKey = new Map();
  const keyOf = (concept, subconcept) => `${concept}::${subconcept}`;

  for (const gap of gapsRes.rows) {
    const key = keyOf(gap.concept, gap.subconcept);
    byKey.set(key, {
      concept: gap.concept,
      subconcept: gap.subconcept,
      weight: gap.status === 'confirmed' ? 3 : 2,
      reason: `${gap.status} learning gap`,
    });
  }

  for (const row of evidenceRes.rows) {
    const key = keyOf(row.concept, row.subconcept);
    if (byKey.has(key)) continue; // already weighted higher via an actual gap
    if (row.incorrect_ratio < 0.4) continue; // not actually weak, just noisy
    byKey.set(key, {
      concept: row.concept,
      subconcept: row.subconcept,
      weight: 1,
      reason: `${Math.round(row.incorrect_ratio * 100)}% incorrect over ${row.total} recent attempts`,
    });
  }

  return Array.from(byKey.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}
