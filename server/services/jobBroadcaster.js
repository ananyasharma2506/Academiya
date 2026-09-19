import { EventEmitter } from 'events';

class JobEventEmitter extends EventEmitter {}

export const jobEvents = new JobEventEmitter();

// Helper to broadcast to WebSocket clients subscribed to a specific jobId
export const wsSubscribers = new Map(); // jobId -> Set<WebSocket>

export function registerSubscriber(jobId, ws) {
  if (!wsSubscribers.has(jobId)) {
    wsSubscribers.set(jobId, new Set());
  }
  wsSubscribers.get(jobId).add(ws);

  ws.on('close', () => {
    const subs = wsSubscribers.get(jobId);
    if (subs) {
      subs.delete(ws);
      if (subs.size === 0) wsSubscribers.delete(jobId);
    }
  });
}

export function broadcastJobEvent(jobId, eventType, payload = {}) {
  const message = JSON.stringify({
    event: eventType,
    jobId,
    timestamp: new Date().toISOString(),
    ...payload,
  });

  const subs = wsSubscribers.get(jobId);
  if (subs) {
    for (const ws of subs) {
      if (ws.readyState === 1) { // OPEN
        ws.send(message);
      }
    }
  }

  // Also emit locally for in-process listeners
  jobEvents.emit(`job:${jobId}`, { event: eventType, jobId, ...payload });
}
