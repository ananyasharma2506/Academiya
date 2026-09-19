import http from 'http';
import { app } from './index.js';
import { query, pool } from './db/index.js';

async function runVerification() {
  console.log('--- Starting Phase 2 Verification ---');

  // Clean test tables
  await query('DELETE FROM learning_evidence');
  await query('DELETE FROM attempts');
  await query('DELETE FROM questions');
  await query('DELETE FROM users WHERE email IN ($1, $2)', [
    'teacher_test@platform.local',
    'student_test@platform.local',
  ]);

  const server = http.createServer(app);
  const testPort = 5099;

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

  try {
    // 1. Register Teacher
    console.log('1. Registering teacher...');
    const teacherReg = await post('/api/auth/register', {
      name: 'Teacher Test',
      email: 'teacher_test@platform.local',
      password: 'password123',
      role: 'teacher',
    });
    if (teacherReg.status !== 201) throw new Error('Teacher registration failed: ' + JSON.stringify(teacherReg.data));
    const teacherToken = teacherReg.data.token;
    console.log('Teacher registered successfully. Token received.');

    // 2. Register Student
    console.log('2. Registering student...');
    const studentReg = await post('/api/auth/register', {
      name: 'Student Test',
      email: 'student_test@platform.local',
      password: 'password123',
      role: 'student',
    });
    if (studentReg.status !== 201) throw new Error('Student registration failed: ' + JSON.stringify(studentReg.data));
    const studentToken = studentReg.data.token;
    const studentId = studentReg.data.user.id;
    console.log('Student registered successfully. Token received.');

    // 3. Login verification
    console.log('3. Verifying student login...');
    const loginRes = await post('/api/auth/login', {
      email: 'student_test@platform.local',
      password: 'password123',
    });
    if (loginRes.status !== 200 || !loginRes.data.token) throw new Error('Login failed: ' + JSON.stringify(loginRes.data));
    console.log('Login verified successfully.');

    // 4. Seed MCQ via POST /api/questions/seed
    console.log('4. Teacher seeding one MCQ...');
    const seedRes = await post(
      '/api/questions/seed',
      {
        concept: 'Recursion',
        subconcept: 'Base Case',
        statement: 'What happens if a recursive function lacks a base case?',
        options: [
          { id: 'opt1', text: 'It runs faster' },
          { id: 'opt2', text: 'It causes a stack overflow error' },
          { id: 'opt3', text: 'It compiles with a warning' },
          { id: 'opt4', text: 'It returns zero automatically' },
        ],
        correct_option_ids: ['opt2'],
        type: 'mcq_single',
        bloom_level: 'understand',
        difficulty: 'medium',
      },
      teacherToken
    );
    if (seedRes.status !== 201) throw new Error('Question seed failed: ' + JSON.stringify(seedRes.data));
    const questionId = seedRes.data.question.id;
    console.log('Question seeded successfully with id:', questionId);

    // 5. Submit a WRONG answer as student
    console.log('5. Student submitting wrong answer [opt1]...');
    const attemptRes = await post(
      '/api/attempts',
      {
        question_id: questionId,
        selected_option_ids: ['opt1'],
        source: 'practice',
      },
      studentToken
    );
    if (attemptRes.status !== 201) throw new Error('Attempt failed: ' + JSON.stringify(attemptRes.data));
    console.log('Attempt processed. Response result:', attemptRes.data.evaluation);

    // 6. Direct Database Query Verification
    console.log('6. Confirming via direct DB query...');
    const attemptsDb = await query('SELECT * FROM attempts WHERE question_id = $1', [questionId]);
    const evidenceDb = await query('SELECT * FROM learning_evidence WHERE student_id = $1', [studentId]);

    console.log(`Direct DB Verification:`);
    console.log(`- Total attempts found: ${attemptsDb.rows.length}`);
    console.log(`- Attempt is_correct: ${attemptsDb.rows[0]?.is_correct}`);
    console.log(`- Total evidence found: ${evidenceDb.rows.length}`);
    console.log(`- Evidence result: ${evidenceDb.rows[0]?.result}`);
    console.log(`- Evidence concept: ${evidenceDb.rows[0]?.concept}`);

    if (attemptsDb.rows.length !== 1) {
      throw new Error(`Expected exactly 1 attempt row, got ${attemptsDb.rows.length}`);
    }
    if (attemptsDb.rows[0].is_correct !== false) {
      throw new Error(`Expected attempt is_correct to be false, got ${attemptsDb.rows[0].is_correct}`);
    }
    if (evidenceDb.rows.length !== 1) {
      throw new Error(`Expected exactly 1 learning_evidence row, got ${evidenceDb.rows.length}`);
    }
    if (evidenceDb.rows[0].result !== 'incorrect') {
      throw new Error(`Expected evidence result to be 'incorrect', got ${evidenceDb.rows[0].result}`);
    }

    console.log('====================================================');
    console.log('>>> PHASE 2 VERIFICATION PASSED PERFECTLY! <<<');
    console.log('====================================================');
  } finally {
    server.close();
    await pool.end();
  }
}

runVerification().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
