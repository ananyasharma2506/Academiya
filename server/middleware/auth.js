import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'akademiya-jwt-secret-key-2026';

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required', code: 'NO_TOKEN' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, role, name, email, sessionId }

    // Check user_sessions table to verify session has not been revoked or expired
    const sessionRes = await query(
      `SELECT id, user_id, is_active, expires_at 
       FROM user_sessions 
       WHERE (session_token = $1 OR ($2::uuid IS NOT NULL AND id = $2::uuid))
       ORDER BY created_at DESC
       LIMIT 1`,
      [token, decoded.sessionId || null]
    );

    if (sessionRes.rows.length > 0) {
      const session = sessionRes.rows[0];
      if (!session.is_active) {
        return res.status(401).json({ error: 'Session has been invalidated. Please log in again.', code: 'SESSION_INVALID' });
      }
      if (new Date(session.expires_at) < new Date()) {
        return res.status(401).json({ error: 'Session has expired. Please log in again.', code: 'SESSION_EXPIRED' });
      }
      req.session = session;

      // Update last_active_at non-blockingly
      query('UPDATE user_sessions SET last_active_at = NOW() WHERE id = $1', [session.id]).catch(() => {});
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'TOKEN_INVALID' });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `Forbidden: requires ${role} role` });
    }
    next();
  };
}

export const requireTeacher = requireRole('teacher');
export const requireStudent = requireRole('student');

