import { WebSocketServer } from 'ws';

// Map of jobId -> Set of WebSocket clients
const jobSubscribers = new Map();

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let currentJobId = null;

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.subscribe) {
          currentJobId = data.subscribe;
          if (!jobSubscribers.has(currentJobId)) {
            jobSubscribers.set(currentJobId, new Set());
          }
          jobSubscribers.get(currentJobId).add(ws);
          console.log(`${new Date().toLocaleTimeString()} \x1b[90m[WS]\x1b[0m Client subscribed to job \x1b[36m${currentJobId}\x1b[0m`);
          ws.send(JSON.stringify({ type: 'subscribed', jobId: currentJobId }));
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    ws.on('close', () => {
      if (currentJobId && jobSubscribers.has(currentJobId)) {
        jobSubscribers.get(currentJobId).delete(ws);
        if (jobSubscribers.get(currentJobId).size === 0) {
          jobSubscribers.delete(currentJobId);
        }
      }
    });
  });

  return wss;
}

export function broadcastJobEvent(jobId, eventType, payload) {
  const subscribers = jobSubscribers.get(jobId);
  if (!subscribers || subscribers.size === 0) return;

  console.log(`${new Date().toLocaleTimeString()} \x1b[90m[WS BROADCAST]\x1b[0m Event: \x1b[32m${eventType}\x1b[0m (Job: ${jobId}) -> ${subscribers.size} subscriber(s)`);

  const message = JSON.stringify({
    type: eventType,
    jobId,
    timestamp: new Date().toISOString(),
    ...payload
  });

  for (const client of subscribers) {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  }
}
