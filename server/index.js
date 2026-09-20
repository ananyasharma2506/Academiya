import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import questionRoutes from './routes/questions.js';
import attemptRoutes from './routes/attempts.js';
import gapRoutes from './routes/gaps.js';
import generationJobRoutes from './routes/generationJobs.js';
import practiceRoutes from './routes/practice.js';
import diagnosticRoutes from './routes/diagnostics.js';
import interventionRoutes from './routes/interventions.js';
import progressRoutes from './routes/progress.js';
import codeLabRoutes from './routes/codeLab.js';
import insightRoutes from './routes/insights.js';
import semanticRoutes from './routes/semantic.js';
import settingsRoutes from './routes/settings.js';
import attendanceRoutes from './routes/attendance.js';
import activityRoutes from './routes/activity.js';
import sandboxRoutes from './routes/sandbox.js';
import dashboardRoutes from './routes/dashboard.js';
import { setupWebSocket } from './ws.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Anti-caching headers for browser security and back-navigation prevention
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// ── Terminal Debugging: Colorized Request & Performance Logger ──
app.use((req, res, next) => {
  const start = Date.now();
  const method = req.method;
  const url = req.originalUrl || req.url;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusColor = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : status >= 300 ? '\x1b[36m' : '\x1b[32m';
    const methodColor = '\x1b[35m';
    const reset = '\x1b[0m';
    const timeStr = new Date().toLocaleTimeString();
    const bodyInfo = ['POST', 'PUT', 'PATCH'].includes(method) && req.body && Object.keys(req.body).length > 0
      ? ` | payload=${JSON.stringify(req.body, (k, v) => (k.toLowerCase().includes('password') ? '***' : v)).slice(0, 100)}`
      : '';

    console.log(`${timeStr} \x1b[90m[HTTP]\x1b[0m ${methodColor}${method.padEnd(6)}${reset} ${url.padEnd(32)} ${statusColor}${status}${reset} (${duration}ms)${bodyInfo}`);
  });

  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/gaps', gapRoutes);
app.use('/api/generation-jobs', generationJobRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/diagnostics', diagnosticRoutes);
app.use('/api/interventions', interventionRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/code-lab', codeLabRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/semantic', semanticRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/sandbox', sandboxRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Akademiya Learning Intelligence Platform' });
});

// Global Error Debugging Handler
app.use((err, req, res, next) => {
  const timeStr = new Date().toLocaleTimeString();
  console.error(`${timeStr} \x1b[31m[SERVER ERROR]\x1b[0m ${req.method} ${req.url}:`, err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

export const server = http.createServer(app);

// Attach WebSocket server on /ws
export const wss = setupWebSocket(server);

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`🚀 Akademiya Server listening on http://localhost:${PORT}`);
  });
}

export default app;
