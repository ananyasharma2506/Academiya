import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { WebSocketServer } from 'ws';
import { pool } from './db/index.js';

import authRoutes from './routes/auth.js';
import questionRoutes from './routes/questions.js';
import attemptRoutes from './routes/attempts.js';

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

// WebSocket connection handling for streaming events
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.subscribe) {
        ws.jobId = data.subscribe;
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
