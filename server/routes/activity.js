import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Format active seconds into human-readable hours string
 * e.g. 3600 -> "1.00 hours", 900 -> "0.25 hours"
 */
function formatHours(seconds) {
  const hrs = seconds / 3600;
  if (hrs < 0.01 && seconds > 0) return '0.01 hours';
  return `${hrs.toFixed(2)} hours`;
}

/**
 * POST /api/activity/heartbeat
 * Batched telemetry heartbeat from student learning window
 */
router.post('/heartbeat', requireAuth, async (req, res) => {
  try {
    const studentId = req.user.id;
    const {
      subject_id,
      subject_name,
      topic_id,
      topic_title,
      active_seconds_delta = 0,
      total_seconds_delta = 0,
      scroll_distance_delta = 0,
      scroll_events_count_delta = 0,
      scroll_reversals_count_delta = 0,
      current_scroll_depth_pct = 0,
      idle_seconds_delta = 0,
      expected_read_time_seconds = 600,
      is_rapid_scroll = false,
    } = req.body;

    if (!topic_id || !subject_id) {
      return res.status(400).json({ error: 'subject_id and topic_id are required' });
    }

    // 1. Fetch existing activity row if present
    const existing = await query(
      `SELECT * FROM student_topic_activity WHERE student_id = $1 AND topic_id = $2`,
      [studentId, topic_id]
    );

    let row = existing.rows[0];

    const activeSec = (row?.active_seconds || 0) + Math.max(0, parseInt(active_seconds_delta, 10) || 0);
    const totalSec = (row?.total_seconds || 0) + Math.max(0, parseInt(total_seconds_delta, 10) || 0);
    const scrollDist = (row?.scroll_distance || 0) + Math.max(0, parseInt(scroll_distance_delta, 10) || 0);
    const scrollCount = (row?.scroll_events_count || 0) + Math.max(0, parseInt(scroll_events_count_delta, 10) || 0);
    const scrollReversals = (row?.scroll_reversals_count || 0) + Math.max(0, parseInt(scroll_reversals_count_delta, 10) || 0);
    const idleSec = (row?.idle_seconds || 0) + Math.max(0, parseInt(idle_seconds_delta, 10) || 0);
    const maxDepth = Math.max(
      parseFloat(row?.max_scroll_depth_pct || 0),
      Math.min(100, Math.max(0, parseFloat(current_scroll_depth_pct) || 0))
    );

    // 2. Intelligence: Detect Rapid Scrolling without Reading
    // If student has scrolled deeply (>70%) but active time is less than 20% of expected read time
    // OR client reported excessive scroll velocity
    const expectedTime = Math.max(60, parseInt(expected_read_time_seconds, 10) || 600);
    const minimumGenuineReadTime = Math.max(45, expectedTime * 0.20);
    
    let rapidScrollDetected = row?.rapid_scroll_detected || Boolean(is_rapid_scroll);
    if (!rapidScrollDetected && maxDepth >= 70 && activeSec < minimumGenuineReadTime) {
      rapidScrollDetected = true;
    }

    // Topic is considered genuinely read ONLY IF:
    // - Not flagged for rapid scrolling
    // - Active reading time >= minimum genuine read time
    // - Scrolled through at least 65% of content
    let isConsideredRead = false;
    if (!rapidScrollDetected && activeSec >= minimumGenuineReadTime && maxDepth >= 65) {
      isConsideredRead = true;
    } else if (row?.is_considered_read && !rapidScrollDetected) {
      isConsideredRead = true;
    }

    // 3. Intelligence: Topic Struggle Detection
    // Analyzes dwell ratio vs expected time, scroll reversals (re-reading), and prolonged idle pauses
    const dwellRatio = activeSec / expectedTime;
    let struggleScore = 0;
    const struggleFactors = [];

    if (dwellRatio >= 1.8) {
      struggleScore += Math.min(5.5, (dwellRatio - 1.0) * 2.8);
      struggleFactors.push(`Dwell time ${dwellRatio.toFixed(1)}x expected baseline`);
    }
    if (scrollReversals >= 10) {
      const revScore = Math.min(3.5, (scrollReversals / 6));
      struggleScore += revScore;
      struggleFactors.push(`${scrollReversals} back-and-forth re-reading scroll reversals`);
    }
    if (idleSec >= 120 && activeSec >= 180) {
      struggleScore += 1.5;
      struggleFactors.push(`Repeated conceptual hesitation pauses (${Math.round(idleSec)}s idle)`);
    }

    struggleScore = Math.min(10.0, Math.max(0, parseFloat(struggleScore.toFixed(2))));

    let struggleLevel = 'normal';
    if (struggleScore >= 5.0) {
      struggleLevel = 'high_struggle';
    } else if (struggleScore >= 2.5) {
      struggleLevel = 'moderate_struggle';
    }

    const struggleReason = struggleFactors.length > 0
      ? struggleFactors.join('; ')
      : 'Steady reading cadence with normal comprehension signals.';

    // 4. Upsert into database
    const upsertRes = await query(
      `INSERT INTO student_topic_activity (
        student_id, subject_id, subject_name, topic_id, topic_title,
        active_seconds, total_seconds, scroll_distance, scroll_events_count,
        scroll_reversals_count, max_scroll_depth_pct, idle_seconds,
        rapid_scroll_detected, is_considered_read, struggle_score,
        struggle_level, struggle_reason, last_active_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15,
        $16, $17, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (student_id, topic_id) DO UPDATE SET
        subject_id = EXCLUDED.subject_id,
        subject_name = EXCLUDED.subject_name,
        topic_title = EXCLUDED.topic_title,
        active_seconds = EXCLUDED.active_seconds,
        total_seconds = EXCLUDED.total_seconds,
        scroll_distance = EXCLUDED.scroll_distance,
        scroll_events_count = EXCLUDED.scroll_events_count,
        scroll_reversals_count = EXCLUDED.scroll_reversals_count,
        max_scroll_depth_pct = EXCLUDED.max_scroll_depth_pct,
        idle_seconds = EXCLUDED.idle_seconds,
        rapid_scroll_detected = EXCLUDED.rapid_scroll_detected,
        is_considered_read = EXCLUDED.is_considered_read,
        struggle_score = EXCLUDED.struggle_score,
        struggle_level = EXCLUDED.struggle_level,
        struggle_reason = EXCLUDED.struggle_reason,
        last_active_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        studentId,
        subject_id,
        subject_name || 'Computer Science',
        topic_id,
        topic_title || 'Topic',
        activeSec,
        totalSec,
        scrollDist,
        scrollCount,
        scrollReversals,
        maxDepth,
        idleSec,
        rapidScrollDetected,
        isConsideredRead,
        struggleScore,
        struggleLevel,
        struggleReason,
      ]
    );

    return res.json({
      status: 'ok',
      activity: upsertRes.rows[0],
    });
  } catch (err) {
    console.error('Activity heartbeat error:', err);
    return res.status(500).json({ error: 'Failed to record activity heartbeat' });
  }
});

/**
 * GET /api/activity/summary/:student_id
 * Returns aggregated stats for Progress Lab and Teacher Student Console
 */
router.get('/summary/:student_id', requireAuth, async (req, res) => {
  try {
    const studentId = req.params.student_id;

    // Verify requesting user is either the student themselves or a teacher
    if (req.user.role !== 'teacher' && req.user.id !== studentId) {
      return res.status(403).json({ error: 'Unauthorized to view this student activity' });
    }

    const rowsRes = await query(
      `SELECT * FROM student_topic_activity
       WHERE student_id = $1
       ORDER BY last_active_at DESC, created_at DESC`,
      [studentId]
    );

    const rows = rowsRes.rows;

    let totalActiveSec = 0;
    let totalIdleSec = 0;
    let rapidScrollCount = 0;
    let consideredReadCount = 0;
    let stayedMost = null;
    let highestStruggle = null;

    rows.forEach((r) => {
      const active = parseInt(r.active_seconds, 10) || 0;
      const score = parseFloat(r.struggle_score) || 0;

      totalActiveSec += active;
      totalIdleSec += parseInt(r.idle_seconds, 10) || 0;

      if (r.rapid_scroll_detected) rapidScrollCount += 1;
      if (r.is_considered_read) consideredReadCount += 1;

      if (!stayedMost || active > (parseInt(stayedMost.active_seconds, 10) || 0)) {
        stayedMost = r;
      }

      if (!highestStruggle || score > (parseFloat(highestStruggle.struggle_score) || 0)) {
        if (score >= 2.5) {
          highestStruggle = r;
        }
      }
    });

    // Format topics with "Topic X : Studied x hours"
    const formattedTopics = rows.map((r, idx) => {
      const sec = parseInt(r.active_seconds, 10) || 0;
      const hrsStr = formatHours(sec);
      const hoursNum = parseFloat((sec / 3600).toFixed(2));

      return {
        id: r.id,
        topic_id: r.topic_id,
        topic_title: r.topic_title,
        subject_id: r.subject_id,
        subject_name: r.subject_name,
        topic_label: `Topic ${idx + 1} : Studied ${hrsStr}`,
        hours_studied: hoursNum,
        hours_studied_str: hrsStr,
        active_seconds: sec,
        scroll_distance: r.scroll_distance,
        scroll_reversals_count: r.scroll_reversals_count,
        max_scroll_depth_pct: parseFloat(r.max_scroll_depth_pct) || 0,
        rapid_scroll_detected: r.rapid_scroll_detected,
        is_considered_read: r.is_considered_read,
        struggle_score: parseFloat(r.struggle_score) || 0,
        struggle_level: r.struggle_level,
        struggle_reason: r.struggle_reason,
        last_active_at: r.last_active_at,
      };
    });

    const totalHours = parseFloat((totalActiveSec / 3600).toFixed(2));

    return res.json({
      summary: {
        total_active_seconds: totalActiveSec,
        total_active_hours: totalHours,
        total_active_hours_str: formatHours(totalActiveSec),
        total_topics_tracked: rows.length,
        considered_read_count: consideredReadCount,
        rapid_scroll_count: rapidScrollCount,
        stayed_most_topic: stayedMost
          ? {
              topic_id: stayedMost.topic_id,
              topic_title: stayedMost.topic_title,
              subject_name: stayedMost.subject_name,
              active_seconds: stayedMost.active_seconds,
              hours_studied_str: formatHours(stayedMost.active_seconds),
            }
          : null,
        highest_struggle_topic: highestStruggle
          ? {
              topic_id: highestStruggle.topic_id,
              topic_title: highestStruggle.topic_title,
              subject_name: highestStruggle.subject_name,
              struggle_score: highestStruggle.struggle_score,
              struggle_level: highestStruggle.struggle_level,
              struggle_reason: highestStruggle.struggle_reason,
              active_seconds: highestStruggle.active_seconds,
              hours_studied_str: formatHours(highestStruggle.active_seconds),
            }
          : null,
      },
      topics: formattedTopics,
    });
  } catch (err) {
    console.error('Get activity summary error:', err);
    return res.status(500).json({ error: 'Failed to retrieve student activity summary' });
  }
});

export default router;
