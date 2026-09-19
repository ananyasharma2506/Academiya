import http from 'http';
import { app } from './index.js';
import { query, pool } from './db/index.js';

async function runPhase3Verification() {
  console.log('--- Starting Phase 3 Verification ---');

  // Clean test tables
  await query('DELETE FROM learning_gaps');
  await query('DELETE FROM learning_evidence');
  await query('DELETE FROM attempts');
  await query('DELETE FROM questions');
  await query('DELETE FROM users WHERE email IN ($1, $2)', [
    'teacher_phase3@platform.local',
    'student_phase3@platform.local',
  ]);

  const server = http.createServer(app);
  const testPort = 5098;

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
      name: 'Teacher Phase3',
      email: 'teacher_phase3@platform.local',
      password: 'password123',
      role: 'teacher',
    });
    const teacherToken = teacherReg.data.token;

    // 2. Register Student
    console.log('2. Registering student...');
    const studentReg = await post('/api/auth/register', {
      name: 'Student Phase3',
      email: 'student_phase3@platform.local',
      password: 'password123',
      role: 'student',
    });
    const studentToken = studentReg.data.token;
    const studentId = studentReg.data.user.id;

    // 3. Seed 3 questions on the same concept: 'Recursion'
    console.log('3. Seeding 3 MCQs on Recursion...');
    const qIds = [];
    for (let i = 1; i <= 3; i++) {
      const qRes = await post(
        '/api/questions/seed',
        {
          concept: 'Recursion',
          subconcept: `Subtopic ${i}`,
          statement: `Recursion Question #${i}`,
          options: [
            { id: 'opt_correct', text: 'Correct Answer' },
            { id: 'opt_wrong', text: 'Wrong Answer' },
          ],
          correct_option_ids: ['opt_correct'],
          type: 'mcq_single',
          bloom_level: 'apply',
          difficulty: 'medium',
        },
        teacherToken
      );
      qIds.push(qRes.data.question.id);
    }
    console.log('Seeded question IDs:', qIds);

    // 4. Submit 3 wrong attempts on the same concept for the student
    console.log('4. Student submitting 3 wrong attempts on Recursion...');
    for (let i = 0; i < 3; i++) {
      const attemptRes = await post(
        '/api/attempts',
        {
          question_id: qIds[i],
          selected_option_ids: ['opt_wrong'],
          source: 'practice',
        },
        studentToken
      );
      console.log(`- Attempt #${i + 1} processed. is_correct: ${attemptRes.data.evaluation.is_correct}, gap:`, attemptRes.data.gap_detected?.id || 'none yet');
    }

    // 5. Query GET /api/gaps/:student_id
    console.log('5. Querying GET /api/gaps/:student_id...');
    const gapsRes = await get(`/api/gaps/${studentId}`, studentToken);

    if (gapsRes.status !== 200) {
      throw new Error('GET /api/gaps failed: ' + JSON.stringify(gapsRes.data));
    }

    const returnedGaps = gapsRes.data.gaps;
    console.log(`Gaps returned count: ${returnedGaps.length}`);

    if (returnedGaps.length !== 1) {
      throw new Error(`Expected exactly 1 gap row, got ${returnedGaps.length}`);
    }

    const gap = returnedGaps[0];
    console.log('Gap Details:');
    console.log('- Concept:', gap.concept);
    console.log('- Status:', gap.status);
    console.log('- Evidence count:', gap.evidence.length);
    console.log('- Evidence entries visible in response:');
    gap.evidence.forEach((ev, idx) => {
      console.log(`  [${idx + 1}] ID: ${ev.id}, Result: ${ev.result}, Concept: ${ev.concept}, Timestamp: ${ev.created_at}`);
    });

    // Verification asserts:
    if (gap.concept !== 'Recursion') {
      throw new Error(`Expected gap concept to be 'Recursion', got ${gap.concept}`);
    }
    if (gap.status !== 'emerging') {
      throw new Error(`Expected gap status to be 'emerging', got ${gap.status}`);
    }
    if (gap.evidence.length !== 3) {
      throw new Error(`Expected exactly 3 evidence entries visible in response body, got ${gap.evidence.length}`);
    }
    for (const ev of gap.evidence) {
      if (ev.result !== 'incorrect') {
        throw new Error(`Expected evidence result to be 'incorrect', got ${ev.result}`);
      }
    }

    console.log('====================================================');
    console.log('>>> PHASE 3 VERIFICATION PASSED PERFECTLY! <<<');
    console.log('====================================================');
  } finally {
    server.close();
    await pool.end();
  }
}

runPhase3Verification().catch((err) => {
  console.error('PHASE 3 VERIFICATION FAILED:', err);
  process.exit(1);
});
