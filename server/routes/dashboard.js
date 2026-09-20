import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function canView(req, studentId) {
  return req.user.id === studentId || req.user.role === 'teacher';
}

/**
 * `pg` parses a Postgres DATE column into a JS Date set to LOCAL midnight of
 * that calendar day — not UTC midnight. Calling `.toISOString()` on it (which
 * always renders in UTC) silently shifts the date backward by a day in any
 * timezone ahead of UTC (confirmed on this server, which runs IST/+5:30).
 * Reading the date back out with the LOCAL getters below recovers the exact
 * calendar day `pg` encoded, and doubles as the "what day is today" helper
 * for a fresh `new Date()` — both cases want the same local-calendar answer,
 * so one function covers both and there is exactly one definition of "today"
 * for this feature.
 */
function toLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// POST /api/dashboard/checkin — self-service "I studied today" button on the
// Attendance widget. Always checks the caller in (never another student),
// idempotent per calendar day (clicking twice the same day is a no-op, not
// an error or a double-counted streak day).
router.post('/checkin', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can check in' });
    }

    // An explicit date computed in Node (not Postgres's CURRENT_DATE, which
    // resolves in the DB session's own timezone and can disagree with the
    // app's notion of "today" by a day) — see toLocalDateString() above.
    const today = toLocalDateString(new Date());

    const result = await query(
      `INSERT INTO daily_checkins (student_id, checkin_date)
       VALUES ($1, $2::date)
       ON CONFLICT (student_id, checkin_date) DO NOTHING
       RETURNING *`,
      [req.user.id, today]
    );

    return res.status(201).json({
      checked_in: true,
      already_checked_in: result.rows.length === 0,
      date: today,
    });
  } catch (err) {
    console.error('Daily check-in error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * One consolidated payload for the desktop widget layer (attendance calendar,
 * performance summary, pending-studies todo list) — a single round trip
 * instead of each widget firing its own request. Evidence-first throughout:
 * the "performance score" is a transparent weighted blend of three concrete,
 * inspectable numbers (never a bare opaque figure), and is simply omitted
 * (not faked as 0) when there isn't enough evidence yet to compute it.
 */
router.get('/:student_id/widgets', requireAuth, async (req, res) => {
  try {
    const studentId = req.params.student_id;
    if (!canView(req, studentId)) {
      return res.status(403).json({ error: 'Forbidden: can only view your own dashboard' });
    }

    const [attendanceRes, checkinRes, gapsRes, evidenceRes, hoursRes, violationsRes, interventionsRes] = await Promise.all([
      // Raw timestamp, not a Postgres-side DATE() cast — that resolves in the
      // DB session's own timezone, which can differ from Node's and from
      // daily_checkins' definition of "day" below. Deduping by calendar day
      // happens in JS via the same toLocalDateString() as everywhere else.
      query(
        `SELECT marked_at
         FROM attendance
         WHERE student_id = $1
         ORDER BY marked_at DESC
         LIMIT 400`,
        [studentId]
      ),
      query(
        `SELECT checkin_date AS day
         FROM daily_checkins
         WHERE student_id = $1
         ORDER BY checkin_date DESC
         LIMIT 120`,
        [studentId]
      ),
      query(
        `SELECT status, concept, subconcept, updated_at
         FROM learning_gaps
         WHERE student_id = $1
         ORDER BY updated_at DESC`,
        [studentId]
      ),
      query(
        `SELECT result FROM learning_evidence WHERE student_id = $1`,
        [studentId]
      ),
      query(
        `SELECT COALESCE(SUM(active_seconds), 0) AS total_seconds
         FROM student_topic_activity
         WHERE student_id = $1`,
        [studentId]
      ),
      query(
        `SELECT COUNT(*) AS total FROM integrity_events WHERE student_id = $1`,
        [studentId]
      ),
      query(
        `SELECT i.id, i.status, i.target_concept, lg.subconcept, i.created_at
         FROM interventions i
         JOIN learning_gaps lg ON lg.id = i.gap_id
         WHERE lg.student_id = $1 AND i.status = 'active'
         ORDER BY i.created_at DESC`,
        [studentId]
      ),
    ]);

    // ── Attendance streak (consecutive days up to and including today/yesterday) ──
    // Merges deterministic class-session attendance with self-service check-ins
    // (daily_checkins) into one calendar — a day counts if either fired.
    const daySet = new Set([
      ...attendanceRes.rows.map((r) => toLocalDateString(r.marked_at)),
      ...checkinRes.rows.map((r) => toLocalDateString(r.day)),
    ]);
    const attendanceDays = Array.from(daySet).sort((a, b) => (a < b ? 1 : -1));
    let streak = 0;
    const cursor = new Date();
    // A day "counts" toward an ongoing streak if today hasn't checked in yet
    // but yesterday did — otherwise the streak starts from today.
    if (!daySet.has(toLocalDateString(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (daySet.has(toLocalDateString(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    // ── Performance summary (evidence-backed, never fabricated from nothing) ──
    const gaps = gapsRes.rows;
    const totalGaps = gaps.length;
    const resolvedGaps = gaps.filter((g) => g.status === 'resolved').length;
    const gapResolutionPct = totalGaps > 0 ? Math.round((resolvedGaps / totalGaps) * 100) : null;

    const evidenceRows = evidenceRes.rows;
    const correctCount = evidenceRows.filter((r) => r.result === 'correct').length;
    const accuracyPct = evidenceRows.length > 0 ? Math.round((correctCount / evidenceRows.length) * 100) : null;

    const totalHours = Math.round((Number(hoursRes.rows[0].total_seconds) / 3600) * 100) / 100;
    const violationCount = parseInt(violationsRes.rows[0].total, 10) || 0;
    // 0 violations -> full 100 credit; every 2 violations costs 10 points, floored at 0.
    const integrityPct = Math.max(0, 100 - violationCount * 5);

    // Integrity is always a real, observed value (a clean record with zero
    // violations legitimately earns full credit) — only gap-resolution and
    // accuracy can be genuinely "no data yet" and get excluded.
    const hasAnyData = evidenceRows.length > 0 || totalGaps > 0 || violationCount > 0;
    const scoreComponents = [gapResolutionPct, accuracyPct].filter((v) => v !== null);
    scoreComponents.push(integrityPct);
    const overallScore = hasAnyData
      ? Math.round(scoreComponents.reduce((a, b) => a + b, 0) / scoreComponents.length)
      : null;

    // ── Pending studies (todo list) — confirmed gaps first, then active
    // interventions, then emerging gaps; capped so it stays a short, actionable list. ──
    const pending = [];
    for (const g of gaps) {
      if (g.status === 'confirmed') {
        pending.push({
          type: 'gap',
          severity: 'high',
          label: `Practice ${g.concept} — ${g.subconcept}`,
          concept: g.concept,
          subconcept: g.subconcept,
        });
      }
    }
    for (const iv of interventionsRes.rows) {
      pending.push({
        type: 'intervention',
        severity: 'medium',
        label: `Complete intervention: ${iv.target_concept}${iv.subconcept ? ` — ${iv.subconcept}` : ''}`,
        concept: iv.target_concept,
        subconcept: iv.subconcept,
      });
    }
    for (const g of gaps) {
      if (g.status === 'emerging') {
        pending.push({
          type: 'gap',
          severity: 'low',
          label: `Review ${g.concept} — ${g.subconcept}`,
          concept: g.concept,
          subconcept: g.subconcept,
        });
      }
    }

    return res.json({
      attendance: {
        dates: attendanceDays,
        total_days: attendanceDays.length,
        current_streak: streak,
        checked_in_today: daySet.has(toLocalDateString(new Date())),
      },
      performance: {
        score: overallScore,
        gap_resolution_pct: gapResolutionPct,
        accuracy_pct: accuracyPct,
        integrity_pct: hasAnyData ? integrityPct : null,
        total_gaps: totalGaps,
        resolved_gaps: resolvedGaps,
        total_study_hours: totalHours,
        violation_count: violationCount,
      },
      pending: pending.slice(0, 8),
    });
  } catch (err) {
    console.error('Get dashboard widgets error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
