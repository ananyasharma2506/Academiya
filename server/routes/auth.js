import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import { JWT_SECRET, requireAuth } from '../middleware/auth.js';

import crypto from 'crypto';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields (name, email, password, role) are required' });
    }

    if (!['teacher', 'student'].includes(role)) {
      return res.status(400).json({ error: 'Role must be teacher or student' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name.trim(), email.toLowerCase().trim(), passwordHash, role]
    );

    const user = result.rows[0];
    const sessionId = crypto.randomUUID();
    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name, email: user.email, sessionId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Register active session in user_sessions credential & session store
    await query(
      `INSERT INTO user_sessions (id, user_id, session_token, is_active, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, true, $4, $5, NOW() + INTERVAL '7 days')`,
      [sessionId, user.id, token, req.headers['user-agent'] || '', req.ip || '']
    );

    return res.status(201).json({ user, token, sessionId });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await query(
      'SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const sessionId = crypto.randomUUID();
    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name, email: user.email, sessionId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Register active session in user_sessions credential & session store
    await query(
      `INSERT INTO user_sessions (id, user_id, session_token, is_active, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, true, $4, $5, NOW() + INTERVAL '7 days')`,
      [sessionId, user.id, token, req.headers['user-agent'] || '', req.ip || '']
    );

    const { password_hash, ...userProfile } = user;
    return res.json({ user: userProfile, token, sessionId });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout: Explicitly revokes and invalidates session in DB
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(' ')[1] : null;
    const sessionId = req.user?.sessionId;

    await query(
      `UPDATE user_sessions 
       SET is_active = false 
       WHERE (session_token = $1 OR ($2::uuid IS NOT NULL AND id = $2::uuid))`,
      [token, sessionId || null]
    );

    return res.json({ success: true, message: 'Session successfully revoked' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Internal server error during logout' });
  }
});

// Session Verification Endpoint
router.get('/session/verify', requireAuth, async (req, res) => {
  return res.json({
    valid: true,
    user: req.user,
    session: req.session || null,
  });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user: result.rows[0], session: req.session || null });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/users', requireAuth, async (req, res) => {
  try {
    const roleFilter = req.query.role;
    let text = 'SELECT id, name, email, role, created_at FROM users';
    const params = [];
    if (roleFilter) {
      text += ' WHERE role = $1';
      params.push(roleFilter);
    }
    text += ' ORDER BY name ASC';
    const result = await query(text, params);
    return res.json({ users: result.rows });
  } catch (err) {
    console.error('Get users error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
