import axios from 'axios';
import { query } from '../db/index.js';

const BASE_URL = 'http://localhost:5000';

async function runVerification() {
  console.log('--- STARTING PHASES 2 & 3 VERIFICATION ---');

  // Clean test data
  await query("DELETE FROM users WHERE email LIKE '%@test-verification.com'");

  // 1. Register Teacher
  console.log('1. Registering teacher...');
  const teacherReg = await axios.post(`${BASE_URL}/api/auth/register`, {
    name: 'Prof. Turing',
    email: 'turing@test-verification.com',
    password: 'securePassword123!',
    role: 'teacher'
  });
  const teacherToken = teacherReg.data.token;
  console.log('Teacher registered:', teacherReg.data.user.name);

  // 2. Register Student
  console.log('2. Registering student...');
  const studentReg = await axios.post(`${BASE_URL}/api/auth/register`, {
    name: 'Ada Lovelace',
    email: 'ada@test-verification.com',
    password: 'securePassword123!',
    role: 'student'
  });
  const studentToken = studentReg.data.token;
  const studentId = studentReg.data.user.id;
  console.log('Student registered:', studentReg.data.user.name, 'ID:', studentId);

  // 3. Teacher seeds MCQ
  console.log('3. Seeding MCQ...');
  const seedRes = await axios.post(
    `${BASE_URL}/api/questions/seed`,
    {
      concept: 'Recursion',
      subconcept: 'Base Case Termination',
      statement: 'What happens if a recursive function does not include a base case condition?',
      options: [
        { id: 'opt_1', text: 'It terminates immediately' },
        { id: 'opt_2', text: 'Stack overflow error due to infinite recursion' },
        { id: 'opt_3', text: 'It converts automatically to an iterative loop' },
        { id: 'opt_4', text: 'The program returns undefined' }
      ],
      correct_option_ids: ['opt_2'],
      type: 'mcq_single',
      bloom_level: 'understand',
      difficulty: 'medium'
    },
    { headers: { Authorization: `Bearer ${teacherToken}` } }
  );
  const questionId = seedRes.data.question.id;
  console.log('MCQ seeded, ID:', questionId);

  // 4. Student submits 1st WRONG attempt (selected opt_1 instead of opt_2)
  console.log('4. Student submitting 1st wrong attempt...');
  const attempt1 = await axios.post(
    `${BASE_URL}/api/attempts`,
    {
      question_id: questionId,
      selected_option_ids: ['opt_1'],
      source: 'practice'
    },
    { headers: { Authorization: `Bearer ${studentToken}` } }
  );

  // Query DB directly to verify Phase 2
  const dbAttempts = await query('SELECT * FROM attempts WHERE student_id = $1', [studentId]);
  const dbEvidence = await query('SELECT * FROM learning_evidence WHERE student_id = $1', [studentId]);

  console.log('DB Attempts count:', dbAttempts.rows.length);
  console.log('DB Evidence count:', dbEvidence.rows.length);
  console.log('DB Evidence result:', dbEvidence.rows[0]?.result);

  if (dbAttempts.rows.length !== 1) throw new Error(`Expected 1 attempt row, got ${dbAttempts.rows.length}`);
  if (dbEvidence.rows.length !== 1) throw new Error(`Expected 1 evidence row, got ${dbEvidence.rows.length}`);
  if (dbEvidence.rows[0].result !== 'incorrect') throw new Error(`Expected incorrect result, got ${dbEvidence.rows[0].result}`);

  console.log('✅ Phase 2 VERIFICATION PASSED: Deterministic MCQ evaluation & evidence creation verified.');

  // 5. Submit 2 more wrong attempts on Recursion to test Phase 3 gap detection
  console.log('5. Submitting 2nd and 3rd wrong attempts on Recursion...');
  await axios.post(
    `${BASE_URL}/api/attempts`,
    { question_id: questionId, selected_option_ids: ['opt_3'], source: 'practice' },
    { headers: { Authorization: `Bearer ${studentToken}` } }
  );
  await axios.post(
    `${BASE_URL}/api/attempts`,
    { question_id: questionId, selected_option_ids: ['opt_4'], source: 'practice' },
    { headers: { Authorization: `Bearer ${studentToken}` } }
  );

  // 6. Query GET /api/gaps/:student_id
  console.log('6. Fetching student gaps via API...');
  const gapsRes = await axios.get(`${BASE_URL}/api/gaps/${studentId}`, {
    headers: { Authorization: `Bearer ${teacherToken}` }
  });

  const gaps = gapsRes.data.gaps;
  console.log('Total gaps returned:', gaps.length);
  if (gaps.length !== 1) throw new Error(`Expected exactly 1 gap, got ${gaps.length}`);

  const gap = gaps[0];
  console.log('Gap concept:', gap.concept);
  console.log('Gap status:', gap.status);
  console.log('Gap evidence items count:', gap.evidence.length);

  if (gap.concept !== 'Recursion') throw new Error(`Expected Recursion, got ${gap.concept}`);
  if (gap.status !== 'emerging') throw new Error(`Expected status emerging, got ${gap.status}`);
  if (gap.evidence.length !== 3) throw new Error(`Expected 3 evidence items, got ${gap.evidence.length}`);

  console.log('✅ Phase 3 VERIFICATION PASSED: Evidence aggregation & gap detection with expanded evidence verified.');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('Verification failed:', err.response?.data || err.message);
  process.exit(1);
});
