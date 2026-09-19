import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { app } from './index.js';
import { query, pool } from './db/index.js';
import { registerSubscriber } from './services/jobBroadcaster.js';

async function runPhase4Verification() {
  console.log('--- Starting Phase 4 Verification ---');

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.subscribe) {
          registerSubscriber(data.subscribe, ws);
          ws.send(JSON.stringify({ event: 'subscribed', jobId: data.subscribe }));
        }
      } catch {}
    });
  });

  const testPort = 5097;
  await new Promise((resolve) => server.listen(testPort, resolve));

  const post = async (path, body, token = null) => {
    const res = await fetch(`http://127.0.0.1:${testPort}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { status: res.status, data };
  };

  const get = async (path, token = null) => {
    const res = await fetch(`http://127.0.0.1:${testPort}${path}`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await res.json();
    return { status: res.status, data };
  };

  try {
    // 1. Register Teacher
    console.log('1. Registering teacher...');
    const teacherReg = await post('/api/auth/register', {
      name: 'Teacher Phase4',
      email: 'teacher_phase4@platform.local',
      password: 'password123',
      role: 'teacher',
    });
    const teacherToken = teacherReg.data.token;

    // 2. Test Part A: Request 10 questions -> stream over WebSocket one at a time
    console.log('2. Requesting 10 questions via POST /api/generation-jobs...');
    const jobRes = await post(
      '/api/generation-jobs',
      {
        concept: 'Recursion',
        subconcept: 'Base Case Handling',
        requested_count: 10,
        bloom_level: 'understand',
        difficulty: 'medium',
      },
      teacherToken
    );

    if (jobRes.status !== 202) {
      throw new Error('Failed to create generation job: ' + JSON.stringify(jobRes.data));
    }

    const jobId = jobRes.data.job_id;
    console.log(`Job created with ID: ${jobId}, status = ${jobRes.data.job.status}`);

    // Connect WebSocket and subscribe to jobId
    console.log('Connecting to WebSocket to receive streaming events...');
    const ws = new WebSocket(`ws://127.0.0.1:${testPort}`);

    const receivedEvents = [];
    const questionEvents = [];

    await new Promise((resolve) => ws.on('open', resolve));
    ws.send(JSON.stringify({ subscribe: jobId }));

    let resyncVerified = false;

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for 10 streamed questions')), 20000);

      ws.on('message', async (raw) => {
        const payload = JSON.parse(raw.toString());
        receivedEvents.push(payload);

        if (payload.event === 'question.generated') {
          questionEvents.push(payload);
          console.log(`[WS Stream] Received question #${payload.generated_count}/${payload.total_requested}: "${payload.question.statement.slice(0, 50)}..."`);

          // Mid-job check: Test resync via GET /api/generation-jobs/:id
          if (payload.generated_count === 4 && !resyncVerified) {
            resyncVerified = true;
            console.log('Simulating browser refresh mid-job: calling GET /api/generation-jobs/:id...');
            const syncRes = await get(`/api/generation-jobs/${jobId}`, teacherToken);
            console.log(`Resync state -> status: ${syncRes.data.job.status}, generated_count in DB: ${syncRes.data.job.generated_count}`);
            if (syncRes.data.job.generated_count < 4) {
              reject(new Error('Resync failed: DB generated_count lagged behind stream'));
            }
          }
        }

        if (payload.event === 'generation.completed') {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    ws.close();

    console.log(`Streaming finished. Total questions received one-by-one: ${questionEvents.length}`);
    if (questionEvents.length !== 10) {
      throw new Error(`Expected 10 generated questions over WS, got ${questionEvents.length}`);
    }

    // Check final DB state for Job 1
    const finalJobRes = await get(`/api/generation-jobs/${jobId}`, teacherToken);
    console.log('Final Job 1 DB state:', finalJobRes.data.job);
    if (finalJobRes.data.job.status !== 'completed' || finalJobRes.data.job.generated_count !== 10) {
      throw new Error('Job 1 status in DB is not completed with 10 questions');
    }

    // 3. Test Part B: Cancellation test
    console.log('\n3. Testing Cancellation: Starting job with 15 questions...');
    const cancelJobRes = await post(
      '/api/generation-jobs',
      {
        concept: 'Recursion',
        subconcept: 'Tail Call Optimization',
        requested_count: 15,
      },
      teacherToken
    );
    const cancelJobId = cancelJobRes.data.job_id;

    // Wait a brief moment for worker to start, then send cancel
    await new Promise((r) => setTimeout(r, 60));
    console.log(`Cancelling job ${cancelJobId}...`);
    const cancelPostRes = await post(`/api/generation-jobs/${cancelJobId}/cancel`, {}, teacherToken);
    console.log('Cancel response:', cancelPostRes.data);

    // Wait for worker to stop
    await new Promise((r) => setTimeout(r, 400));

    // Confirm job stopped and count is less than 15
    const stoppedJobRes = await get(`/api/generation-jobs/${cancelJobId}`, teacherToken);
    console.log(`Cancelled job DB status: ${stoppedJobRes.data.job.status}, final generated_count: ${stoppedJobRes.data.job.generated_count}`);

    if (stoppedJobRes.data.job.status !== 'cancelled') {
      throw new Error(`Expected job status 'cancelled', got ${stoppedJobRes.data.job.status}`);
    }
    if (stoppedJobRes.data.job.generated_count >= 15) {
      throw new Error('Cancellation failed to stop question generation');
    }

    // 4. Test Part C: Fallback pool verification when local model is disconnected
    console.log('\n4. Fallback Pool Verification: Local model URL is disconnected/fallback active...');
    const fallbackQ = await post(
      '/api/generation-jobs',
      {
        concept: 'Recursion',
        subconcept: 'Call Stack Unwinding',
        requested_count: 2,
      },
      teacherToken
    );
    await new Promise((r) => setTimeout(r, 400));
    const fallbackCheck = await get(`/api/generation-jobs/${fallbackQ.data.job_id}`, teacherToken);
    console.log(`Fallback generation status: ${fallbackCheck.data.job.status}, generated: ${fallbackCheck.data.job.generated_count}`);
    if (fallbackCheck.data.job.generated_count !== 2) {
      throw new Error('Fallback generation did not complete expected count');
    }

    console.log('====================================================');
    console.log('>>> ALL PHASE 4 VERIFICATION STEPS PASSED! <<<');
    console.log('====================================================');
  } finally {
    server.close();
    await pool.end();
  }
}

runPhase4Verification().catch((err) => {
  console.error('PHASE 4 VERIFICATION FAILED:', err);
  process.exit(1);
});
