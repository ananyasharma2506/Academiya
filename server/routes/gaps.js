import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/gaps/:student_id
// Returns each gap with its full evidence list expanded (not just IDs)
// so the UI can render concrete evidence, never an opaque score.
router.get('/:student_id', requireAuth, async (req, res) => {
  try {
    const requestedStudentId = req.params.student_id;

    // Student can view their own gaps; teachers can view any student's gaps
    if (req.user.role === 'student' && req.user.id !== requestedStudentId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const gapsResult = await query(
      `SELECT id, student_id, concept, subconcept, status, evidence_ids, created_at, updated_at
       FROM learning_gaps
       WHERE student_id = $1
       ORDER BY updated_at DESC`,
      [requestedStudentId]
    );

    const gaps = gapsResult.rows;

    // Expand evidence items for each gap
    const expandedGaps = await Promise.all(
      gaps.map(async (gap) => {
        let evidenceList = [];
        const rawIds = Array.isArray(gap.evidence_ids)
          ? gap.evidence_ids
          : JSON.parse(gap.evidence_ids || '[]');

        if (rawIds.length > 0) {
          const evidenceResult = await query(
            `SELECT id, student_id, concept, subconcept, attempt_id, result, created_at
             FROM learning_evidence
             WHERE id = ANY($1::uuid[])
             ORDER BY created_at ASC`,
            [rawIds]
          );
          evidenceList = evidenceResult.rows;
        }

        return {
          id: gap.id,
          student_id: gap.student_id,
          concept: gap.concept,
          subconcept: gap.subconcept,
          status: gap.status,
          evidence_ids: rawIds,
          evidence: evidenceList, // full evidence list expanded
          created_at: gap.created_at,
          updated_at: gap.updated_at,
        };
      })
    );

    res.json({ gaps: expandedGaps });
  } catch (err) {
    console.error('Get gaps error:', err);
    res.status(500).json({ error: 'Failed to fetch gaps' });
  }
});

export default router;
