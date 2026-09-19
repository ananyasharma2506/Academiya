import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { WebSocketServer } from 'ws';
import { pool } from './db/index.js';

import authRoutes from './routes/auth.js';
import questionRoutes from './routes/questions.js';
import attemptRoutes from './routes/attempts.js';
import gapRoutes from './routes/gaps.js';
import generationJobsRoutes from './routes/generationJobs.js';
import practiceRoutes from './routes/practice.js';
import diagnosticRoutes from './routes/diagnostics.js';
import interventionRoutes from './routes/interventions.js';
import reassessmentRoutes from './routes/reassessments.js';
import codeLabRoutes from './routes/codeLab.js';
import insightsRoutes from './routes/insights.js';
import semanticRoutes from './routes/semantic.js';
import { registerSubscriber } from './services/jobBroadcaster.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/gaps', gapRoutes);
app.use('/api/generation-jobs', generationJobsRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/diagnostics', diagnosticRoutes);
app.use('/api/interventions', interventionRoutes);
app.use('/api/reassessments', reassessmentRoutes);
app.use('/api/code-lab', codeLabRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/semantic', semanticRoutes);

// Health check and DB verification route
app.get('/api/health', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT NOW() as current_time');
    res.json({
      status: 'ok',
      db: 'connected',
      time: dbRes.rows[0].current_time,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.subscribe) {
        registerSubscriber(data.subscribe, ws);
        ws.send(JSON.stringify({
          event: 'subscribed',
          jobId: data.subscribe,
          timestamp: new Date().toISOString(),
        }));
      }
    } catch {
      // Ignore invalid frames
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Learning Intelligence Platform server running on port ${PORT}`);
});

export { app, server, wss };
