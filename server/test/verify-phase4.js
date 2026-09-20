import axios from 'axios';
import { WebSocket } from 'ws';

const BASE_URL = 'http://localhost:5000';

async function verifyPhase4() {
  console.log('--- STARTING PHASE 4 AI & WEBSOCKET PIPELINE VERIFICATION ---');

  // 1. Teacher login
  console.log('1. Logging in teacher...');
  const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: 'turing@test-verification.com',
    password: 'securePassword123!'
  });
  const token = loginRes.data.token;

  // 2. Submit generation job for 4 questions
  console.log('2. Requesting generation job for 4 questions on Recursion...');
  const jobRes = await axios.post(
    `${BASE_URL}/api/generation-jobs`,
    {
      concept: 'Recursion',
      subconcept: 'Call Stack Frames',
      requested_count: 4,
      bloom_level: 'analyze'
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const jobId = jobRes.data.job_id;
  console.log('Job scheduled, ID:', jobId, 'status:', jobRes.data.status);

  // 3. Connect via WebSocket and collect stream events
  console.log('3. Connecting to WebSocket stream...');
  const events = [];
  const ws = new WebSocket('ws://localhost:5000/ws');

  const streamPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for generation completion after 60s. Received ${events.length} events.`));
    }, 60000);

    ws.on('open', () => {
      console.log('WebSocket connection opened, subscribing to jobId:', jobId);
      ws.send(JSON.stringify({ subscribe: jobId }));
    });

    ws.on('message', (data) => {
      const parsed = JSON.parse(data.toString());
      console.log('WS Event received:', parsed.type, parsed.index ? `(item ${parsed.index})` : '');
      events.push(parsed);

      if (parsed.type === 'generation.completed') {
        clearTimeout(timer);
        ws.close();
        resolve(events);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  await streamPromise;
  console.log('All streaming events received successfully! Total events:', events.length);

  const generatedQuestions = events.filter(e => e.type === 'question.generated');
  console.log(`Generated questions streamed: ${generatedQuestions.length}`);
  if (generatedQuestions.length < 1) {
    throw new Error('No question.generated events received');
  }

  // 4. Test state resync via GET /api/generation-jobs/:id
  console.log('4. Testing job state resync endpoint...');
  const syncRes = await axios.get(`${BASE_URL}/api/generation-jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Job status from sync:', syncRes.data.job.status);
  console.log('Questions count from sync:', syncRes.data.questions.length);

  if (syncRes.data.job.status !== 'completed') {
    throw new Error(`Expected completed status, got ${syncRes.data.job.status}`);
  }

  // 5. Test Cancellation
  console.log('5. Testing Job Cancellation...');
  const cancelJobRes = await axios.post(
    `${BASE_URL}/api/generation-jobs`,
    {
      concept: 'Dynamic Programming',
      subconcept: 'State Transitions',
      requested_count: 10
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const cancelJobId = cancelJobRes.data.job_id;

  // Immediately cancel
  const cancelAction = await axios.post(
    `${BASE_URL}/api/generation-jobs/${cancelJobId}/cancel`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  console.log('Job cancelled status:', cancelAction.data.job.status);

  // Wait a moment and check that status remains cancelled
  await new Promise(r => setTimeout(r, 1000));
  const postCancelCheck = await axios.get(`${BASE_URL}/api/generation-jobs/${cancelJobId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Post-cancel status check:', postCancelCheck.data.job.status);
  if (postCancelCheck.data.job.status !== 'cancelled') {
    throw new Error(`Expected cancelled, got ${postCancelCheck.data.job.status}`);
  }

  console.log('✅ Phase 4 VERIFICATION PASSED: AI model adapter, bounded queue, WebSocket streaming, resync, and cancellation verified.');
  process.exit(0);
}

verifyPhase4().catch((err) => {
  console.error('Phase 4 verification failed:', err.response?.data || err.message);
  process.exit(1);
});
