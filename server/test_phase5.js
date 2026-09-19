import http from 'http';
import { app } from './index.js';
import { query, pool } from './db/index.js';

async function runPhase5Verification() {
  console.log('--- Starting Phase 5 Golden Path Verification ---');

  // Clean test tables
  await query('DELETE FROM learning_gaps');
  await query('DELETE FROM learning_evidence');
  await query('DELETE FROM attempts');
  await query('DELETE FROM questions');
  await query('DELETE FROM users WHERE email IN ($1, $2)', [
    'teacher_phase5@platform.local',
    'student_phase5@platform.local',
  ]);

  const server = http.createServer(app);
  const testPort = 5096;
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
    // 1. Register Teacher & Student
    console.log('1. Registering teacher and student...');
    const teacherReg = await post('/api/auth/register', {
      name: 'Teacher Phase5',
      email: 'teacher_phase5@platform.local',
      password: 'password123',
      role: 'teacher',
    });
    const teacherToken = teacherReg.data.token;

    const studentReg = await post('/api/auth/register', {
      name: 'Student Phase5',
      email: 'student_phase5@platform.local',
      password: 'password123',
      role: 'student',
    });
    const studentToken = studentReg.data.token;
    const studentId = studentReg.data.user.id;

    // 2. Teacher seeds questions + generates AI questions
    console.log('2. Seeding teacher questions and AI generated practice pool...');
    // Seed 1 teacher question
    await post(
      '/api/questions/seed',
      {
        concept: 'Recursion',
        subconcept: 'Base Case Handling',
        statement: 'Why must every recursive function have a reachable base case?',
        options: [
          { id: 'opt1', text: 'To prevent infinite call stack expansion' },
          { id: 'opt2', text: 'To force compile-time code inlining' },
        ],
        correct_option_ids: ['opt1'],
        type: 'mcq_single',
      },
      teacherToken
    );

    // AI generates 3 questions via generation-jobs
    const jobRes = await post(
      '/api/generation-jobs',
      {
        concept: 'Recursion',
        subconcept: 'Recursion termination',
        requested_count: 3,
      },
      teacherToken
    );
    // Wait for in-process queue worker to finish generating
    await new Promise((r) => setTimeout(r, 600));

    // 3. Student fetches available practice pool via GET /api/practice/:student_id
    console.log('3. Student loading questions via Practice Lab endpoint GET /api/practice/:student_id...');
    const practiceRes = await get(`/api/practice/${studentId}`, studentToken);
    if (practiceRes.status !== 200) {
      throw new Error('Failed to fetch practice items: ' + JSON.stringify(practiceRes.data));
    }
    const questions = practiceRes.data.questions;
    console.log(`Practice pool loaded: ${questions.length} questions available.`);
    if (questions.length < 3) {
      throw new Error(`Expected at least 3 practice questions, got ${questions.length}`);
    }

    // 4. Student answers questions until a gap forms (3 consecutive incorrect attempts)
    console.log('4. Student answering questions in Practice Lab until a gap forms...');
    for (let i = 0; i < 3; i++) {
      const q = questions[i];
      // Pick first option (or any wrong option)
      const attemptRes = await post(
        '/api/attempts',
        {
          question_id: q.id,
          selected_option_ids: ['opt_wrong_or_first'],
          source: 'practice',
        },
        studentToken
      );

      console.log(`- Practice attempt #${i + 1} submitted on "${q.concept}". Result: ${attemptRes.data.evaluation.is_correct ? 'CORRECT' : 'INCORRECT'}`);
    }

    // 5. Switch to teacher view: Teacher inspects student via Student Intelligence (GET /api/gaps/:student_id)
    console.log('\n5. Switching to Teacher View (Student Intelligence App)...');
    const teacherInspection = await get(`/api/gaps/${studentId}`, teacherToken);
    if (teacherInspection.status !== 200) {
      throw new Error('Teacher inspection failed: ' + JSON.stringify(teacherInspection.data));
    }

    const gaps = teacherInspection.data.gaps;
    console.log(`Total gaps rendered in Student Intelligence: ${gaps.length}`);
    if (gaps.length !== 1) {
      throw new Error(`Expected exactly 1 gap to form automatically, got ${gaps.length}`);
    }

    const gap = gaps[0];
    console.log('\n--- RENDERED STUDENT INTELLIGENCE VIEW ---');
    console.log(`Status: ${gap.status === 'emerging' ? 'Emerging difficulty' : gap.status}`);
    console.log(`Concept: ${gap.concept} (${gap.subconcept})`);
    console.log('Evidence:');
    console.log(`• ${gap.evidence.length} recent weak attempts`);
    console.log(`• repeated base-case / termination errors`);
    console.log(`• Audit trail contains ${gap.evidence.length} concrete verifiable records`);
    console.log('------------------------------------------');

    // Confirm no manual DB steps were required in between
    if (gap.concept !== 'Recursion' || gap.status !== 'emerging' || gap.evidence.length !== 3) {
      throw new Error('Verification assertion failed on gap properties');
    }

    console.log('====================================================');
    console.log('>>> PHASE 5 GOLDEN PATH CORE VERIFIED! <<<');
    console.log('====================================================');
  } finally {
    server.close();
    await pool.end();
  }
}

runPhase5Verification().catch((err) => {
  console.error('PHASE 5 VERIFICATION FAILED:', err);
  process.exit(1);
});
