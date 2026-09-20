/**
 * Deterministic Auto Attendance Service (Phase 11)
 * Zero AI involvement - purely deterministic window checking based on student actions.
 */

import { query } from '../db/index.js';

/**
 * Checks if timestamp falls within an active class session for student's class,
 * and records attendance if not already marked.
 * 
 * @param {string} studentId
 * @param {Date|string} timestamp
 * @param {'assignment_completion'|'assessment_completion'|'video_completion'} source
 * @returns {Promise<Array>} Newly inserted attendance records
 */
export async function checkAttendance(studentId, timestamp = new Date(), source = 'assignment_completion') {
  try {
    const time = new Date(timestamp);

    // 1. Find all active class sessions spanning this timestamp
    const sessionRes = await query(
      `SELECT id, teacher_id, title, start_time, end_time
       FROM class_sessions
       WHERE start_time <= $1 AND end_time >= $1`,
      [time]
    );

    if (sessionRes.rows.length === 0) {
      return [];
    }

    const inserted = [];
    for (const session of sessionRes.rows) {
      // 2. Insert attendance with ON CONFLICT DO NOTHING (deterministic idempotency)
      const attRes = await query(
        `INSERT INTO attendance (student_id, session_id, marked_at, source)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (student_id, session_id) DO NOTHING
         RETURNING *`,
        [studentId, session.id, time, source]
      );

      if (attRes.rows.length > 0) {
        inserted.push(attRes.rows[0]);
      }
    }

    return inserted;
  } catch (err) {
    console.error('[checkAttendance] Error checking auto-attendance:', err);
    return [];
  }
}

/**
 * Get attendance roster for a specific session with present/absent status
 * 
 * @param {string} sessionId
 * @returns {Promise<Object>} session details and student roster
 */
export async function getSessionAttendanceRoster(sessionId) {
  const sessionRes = await query(
    `SELECT cs.*, u.name as teacher_name
     FROM class_sessions cs
     JOIN users u ON cs.teacher_id = u.id
     WHERE cs.id = $1`,
    [sessionId]
  );

  if (sessionRes.rows.length === 0) {
    return null;
  }

  const session = sessionRes.rows[0];

  // Return all students in the platform with their attendance status for this session
  const rosterRes = await query(
    `SELECT u.id as student_id, u.name as student_name, u.email as student_email,
            att.id as attendance_id,
            att.marked_at,
            att.source as attendance_source,
            CASE WHEN att.id IS NOT NULL THEN true ELSE false END as is_present
     FROM users u
     LEFT JOIN attendance att ON att.student_id = u.id AND att.session_id = $1
     WHERE u.role = 'student'
     ORDER BY is_present DESC, u.name ASC`,
    [sessionId]
  );

  const presentCount = rosterRes.rows.filter(r => r.is_present).length;
  const totalStudents = rosterRes.rows.length;

  return {
    session,
    stats: {
      total_students: totalStudents,
      present_count: presentCount,
      absent_count: totalStudents - presentCount,
      attendance_rate_pct: totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0
    },
    roster: rosterRes.rows
  };
}
