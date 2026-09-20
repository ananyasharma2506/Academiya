/**
 * Bounds how many AI-generated items (coding challenges, practice questions)
 * a single login session may self-serve-generate. Keyed by the JWT's
 * sessionId (minted fresh at every login/register — see server/routes/auth.js
 * and server/middleware/auth.js), so the cap naturally resets on next login
 * rather than following the user forever, and is independent per bucket
 * (Code Lab vs Practice Lab each get their own 10).
 *
 * In-memory by design: this is a soft, per-process compute-cost guard in the
 * same spirit as the hard per-request generation caps elsewhere, not a
 * security boundary — resetting on server restart is acceptable.
 */

export const MAX_PER_SESSION = 10;

const counters = new Map(); // `${sessionId}:${bucket}` -> count consumed

function keyFor(sessionId, bucket) {
  return `${sessionId}:${bucket}`;
}

export function getRemaining(sessionId, bucket) {
  if (!sessionId) return MAX_PER_SESSION; // no session id available: don't block, just don't track
  const used = counters.get(keyFor(sessionId, bucket)) || 0;
  return Math.max(0, MAX_PER_SESSION - used);
}

export function consume(sessionId, bucket, amount) {
  if (!sessionId || amount <= 0) return;
  const key = keyFor(sessionId, bucket);
  counters.set(key, (counters.get(key) || 0) + amount);
}
