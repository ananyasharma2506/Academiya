import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { queue } from '../jobs/generationQueue.js';
import { BLOOM_LEVELS, computeStudentBloomDistribution, computeClassBloomDistribution, getWeaknessProfile } from '../services/evidenceService.js';
import { getRemaining, consume, MAX_PER_SESSION } from '../lib/sessionGenerationLimiter.js';

const router = express.Router();

const STUDENT_MAX_COUNT = 10; // bounded self-serve practice generation
const TEACHER_MAX_COUNT = 20; // hard cap per spec

// Same rotation Code Lab falls back to when a student has no weakness data yet.
const DEFAULT_TARGET_ROTATION = [
  { concept: 'Recursion', subconcept: 'Base Case Termination' },
  { concept: 'Arrays', subconcept: 'Two Pointer Technique' },
  { concept: 'Binary Search Trees', subconcept: 'Traversal Order' },
  { concept: 'Dynamic Programming', subconcept: 'Memoization vs Tabulation' },
];

/** Scales/rounds an arbitrary count map onto BLOOM_LEVELS so it sums to exactly `count`. */
function normalizeDistribution(rawDistribution, count) {
  const weights = BLOOM_LEVELS.map(level => Math.max(0, Number(rawDistribution[level]) || 0));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return null;

  const raw = weights.map(w => (w / totalWeight) * count);
  const floors = raw.map(Math.floor);
  let remainder = count - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floors];
  for (let k = 0; k < remainder && order.length > 0; k++) {
    result[order[k % order.length].i] += 1;
  }

  return BLOOM_LEVELS.reduce((acc, level, i) => {
    acc[level] = result[i];
    return acc;
  }, {});
}

/** Same largest-remainder scaling, generalized to an arbitrary set of type keys. */
function normalizeTypeMix(rawMix, count) {
  const keys = Object.keys(rawMix).filter(k => ['mcq_single', 'mcq_multi', 'descriptive'].includes(k));
  const weights = keys.map(k => Math.max(0, Number(rawMix[k]) || 0));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (keys.length === 0 || totalWeight === 0) return null;

  const raw = weights.map(w => (w / totalWeight) * count);
  const floors = raw.map(Math.floor);
  let remainder = count - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floors];
  for (let k = 0; k < remainder && order.length > 0; k++) {
    result[order[k % order.length].i] += 1;
  }

  return keys.reduce((acc, key, i) => {
    acc[key] = result[i];
    return acc;
  }, {});
}

function expandCountMapToShuffledList(countMap) {
  const list = [];
  for (const [key, n] of Object.entries(countMap)) {
    for (let i = 0; i < n; i++) list.push(key);
  }
  // Fisher-Yates shuffle so the stream isn't monotonic (all "remember" first, etc.)
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// POST /api/generation-jobs
router.post('/', requireAuth, async (req, res) => {
  try {
    const isStudent = req.user.role === 'student';
    const {
      requested_count = 5,
      difficulty = 'medium',
      constraints = '',
      // Legacy single-value controls (still honored when no distribution/mix given)
      bloom_level,
      type = 'mcq_single',
      // New controls
      bloom_distribution = null,     // { remember, understand, apply, analyze, evaluate, create }
      type_mix = null,               // { mcq_single, mcq_multi, descriptive }
      use_class_capability = false,  // teacher: structure bloom mix from class-average accuracy
      target_student_id = null,      // teacher: personalize for one student instead of the class
      auto_target = false            // student: pick the weakest concept automatically instead of typing one
    } = req.body;
    let { concept, subconcept } = req.body;

    let autoTargetReason = null;

    // Self-serve students can skip typing a concept entirely and let their own
    // "academic graph" (learning gaps + low-accuracy evidence) pick one — the
    // same weakness-ranking Code Lab's generator uses.
    if (isStudent && (auto_target || !concept || !subconcept)) {
      const weakness = await getWeaknessProfile(req.user.id, 1);
      const target = weakness[0] || DEFAULT_TARGET_ROTATION[Math.floor(Math.random() * DEFAULT_TARGET_ROTATION.length)];
      concept = target.concept;
      subconcept = target.subconcept;
      autoTargetReason = target.reason || 'foundational rotation (no weakness data yet)';
    }

    if (!concept || !subconcept) {
      return res.status(400).json({ error: 'concept and subconcept are required' });
    }

    // Bounded per-request count, further bounded by this login session's
    // remaining self-serve generation budget (students only — teacher
    // assessment generation is a different, already-reviewed workflow).
    const maxCount = isStudent ? STUDENT_MAX_COUNT : TEACHER_MAX_COUNT;
    let count = Math.min(Math.max(1, parseInt(requested_count, 10) || 1), maxCount);

    if (isStudent) {
      const remaining = getRemaining(req.user.sessionId, 'practice-generate');
      if (remaining <= 0) {
        return res.status(429).json({
          error: `You've used all ${MAX_PER_SESSION} self-generated practice questions for this session. Log out and back in to reset.`,
          remaining: 0,
        });
      }
      count = Math.min(count, remaining);
    }

    // A student may only ever generate bounded self-serve practice for themselves —
    // never into the shared assessment pool, and never impersonating another student.
    const assessment_id = isStudent ? null : (req.body.assessment_id || null);
    const generated_for_student_id = isStudent ? req.user.id : (target_student_id || null);

    // 1. Resolve the Bloom-level distribution for this job.
    let distribution = null;
    let capabilityBasis = null;

    if (bloom_distribution) {
      distribution = normalizeDistribution(bloom_distribution, count);
    } else if (isStudent) {
      // Practice Lab self-serve: always personalize to the requesting student's own evidence.
      const result = await computeStudentBloomDistribution(req.user.id, concept, subconcept, count);
      distribution = result.distribution;
      capabilityBasis = result.capability_basis;
    } else if (target_student_id) {
      const result = await computeStudentBloomDistribution(target_student_id, concept, subconcept, count);
      distribution = result.distribution;
      capabilityBasis = result.capability_basis;
    } else if (use_class_capability) {
      const result = await computeClassBloomDistribution(concept, subconcept, count);
      distribution = result.distribution;
      capabilityBasis = result.capability_basis;
    } else if (bloom_level) {
      // Legacy explicit single-level request: honor it as-is for backward compatibility.
      distribution = { [BLOOM_LEVELS.includes(bloom_level) ? bloom_level : 'apply']: count };
    } else {
      // No signal given at all: cover all six Bloom levels evenly.
      distribution = normalizeDistribution(BLOOM_LEVELS.reduce((acc, l) => ({ ...acc, [l]: 1 }), {}), count);
    }

    const bloomList = expandCountMapToShuffledList(distribution);

    // 2. Resolve the question-type mix for this job.
    let typeCounts;
    if (type_mix) {
      typeCounts = normalizeTypeMix(type_mix, count) || { [type]: count };
    } else {
      typeCounts = { [type]: count };
    }
    const typeList = expandCountMapToShuffledList(typeCounts);

    // 3. Build one blueprint per item (Bloom level x type paired independently).
    const itemBlueprints = [];
    for (let i = 0; i < count; i++) {
      itemBlueprints.push({
        concept: concept.trim(),
        subconcept: subconcept.trim(),
        type: typeList[i] || type,
        bloom_level: bloomList[i] || 'apply',
        difficulty,
        constraints
      });
    }

    const insertRes = await query(
      `INSERT INTO generation_jobs (teacher_id, requested_count, generated_count, status)
       VALUES ($1, $2, 0, 'running')
       RETURNING *`,
      [req.user.id, count]
    );

    const job = insertRes.rows[0];

    // Enqueue in-process async worker without blocking HTTP response
    queue.enqueue({
      id: job.id,
      requester_id: req.user.id,
      sessionId: req.user.sessionId,
      assessment_id,
      generated_for_student_id,
      requested_count: count,
      itemBlueprints
    });

    return res.status(202).json({
      job_id: job.id,
      status: job.status,
      requested_count: count,
      bloom_distribution: distribution,
      type_mix: typeCounts,
      capability_basis: capabilityBasis,
      targeted_concept: autoTargetReason ? { concept, subconcept, reason: autoTargetReason } : null,
      message: 'Generation job scheduled'
    });
  } catch (err) {
    console.error('Create generation job error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/generation-jobs/:id - resync state after refresh
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const jobRes = await query('SELECT * FROM generation_jobs WHERE id = $1', [req.params.id]);
    if (jobRes.rows.length === 0) {
      return res.status(404).json({ error: 'Generation job not found' });
    }
    const job = jobRes.rows[0];

    // Fetch generated questions associated with this job
    const qRes = await query(
      `SELECT q.*, gq.status as generation_status, gq.attempt_no
       FROM generated_questions gq
       JOIN questions q ON gq.question_id = q.id
       WHERE gq.job_id = $1
       ORDER BY gq.created_at ASC`,
      [job.id]
    );

    return res.json({
      job,
      questions: qRes.rows
    });
  } catch (err) {
    console.error('Get job status error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/generation-jobs/:id/cancel
router.post('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `UPDATE generation_jobs
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND teacher_id = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.json({
      message: 'Job marked as cancelled',
      job: result.rows[0]
    });
  } catch (err) {
    console.error('Cancel job error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
