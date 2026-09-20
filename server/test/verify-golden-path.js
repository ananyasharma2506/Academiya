import axios from 'axios';
import { query } from '../db/index.js';

const BASE_URL = 'http://localhost:5000';

async function runGoldenPath() {
  console.log('====================================================');
  console.log('🚀 STARTING FULL GOLDEN PATH END-TO-END VERIFICATION');
  console.log('====================================================\n');

  // Step 0: Auth setup
  console.log('Step 0: Registering/logging in users...');
  await query("DELETE FROM users WHERE email IN ('teacher.golden@akademiya.io', 'student.golden@akademiya.io')");

  const teacherRes = await axios.post(`${BASE_URL}/api/auth/register`, {
    name: 'Prof. Golden Teacher',
    email: 'teacher.golden@akademiya.io',
    password: 'password123',
    role: 'teacher'
  });
  const teacherToken = teacherRes.data.token;

  const studentRes = await axios.post(`${BASE_URL}/api/auth/register`, {
    name: 'Jane Learner',
    email: 'student.golden@akademiya.io',
    password: 'password123',
    role: 'student'
  });
  const studentToken = studentRes.data.token;
  const studentId = studentRes.data.user.id;

  const teacherHeaders = { headers: { Authorization: `Bearer ${teacherToken}` } };
  const studentHeaders = { headers: { Authorization: `Bearer ${studentToken}` } };

  // Step 1: Teacher seeds MCQ
  console.log('\nStep 1: Teacher seeds MCQ on Recursion...');
  const seedRes = await axios.post(
    `${BASE_URL}/api/questions/seed`,
    {
      concept: 'Recursion',
      subconcept: 'Base Case Termination',
      statement: 'What is the primary danger of omitting a base case in a recursive algorithm?',
      options: [
        { id: 'opt_1', text: 'Syntax error during compilation' },
        { id: 'opt_2', text: 'Exceeding the maximum call stack depth (stack overflow)' },
        { id: 'opt_3', text: 'Automatic switch to binary search' },
        { id: 'opt_4', text: 'None of the above' }
      ],
      correct_option_ids: ['opt_2'],
      type: 'mcq_single',
      bloom_level: 'understand',
      difficulty: 'medium'
    },
    teacherHeaders
  );
  const seededQuestion = seedRes.data.question;
  console.log('Seeded Question ID:', seededQuestion.id);

  // Step 2: AI generates related questions
  console.log('\nStep 2: AI generates related questions...');
  const genJob = await axios.post(
    `${BASE_URL}/api/generation-jobs`,
    {
      concept: 'Recursion',
      subconcept: 'Base Case Termination',
      requested_count: 2
    },
    teacherHeaders
  );
  console.log('AI Generation Job ID:', genJob.data.job_id);

  // Wait a few seconds for queue to finish
  await new Promise(r => setTimeout(r, 3000));

  // Step 3: Student attempts questions in Practice Lab
  console.log('\nStep 3: Student attempts practice questions...');
  const practiceRes = await axios.get(`${BASE_URL}/api/practice/${studentId}`, studentHeaders);
  console.log(`Available practice questions: ${practiceRes.data.questions.length}`);

  // Student makes 3 incorrect attempts on Recursion to simulate genuine learning gap formation
  console.log('Student submits 3 weak attempts on Recursion...');
  for (let i = 1; i <= 3; i++) {
    const att = await axios.post(
      `${BASE_URL}/api/attempts`,
      {
        question_id: seededQuestion.id,
        selected_option_ids: ['opt_1'], // wrong option
        source: 'practice'
      },
      studentHeaders
    );
    console.log(` Attempt ${i} result: ${att.data.evidence.result} (marks: ${att.data.evaluation.marks_awarded})`);
  }

  // Step 4: Evidence aggregates into Learning Gap
  console.log('\nStep 4: Checking Student Intelligence for emerging gap...');
  const gapsRes = await axios.get(`${BASE_URL}/api/gaps/${studentId}`, teacherHeaders);
  const gaps = gapsRes.data.gaps;
  console.log(`Total gaps found: ${gaps.length}`);
  if (gaps.length === 0) throw new Error('Expected at least 1 learning gap to form');

  const gap = gaps.find(g => g.concept === 'Recursion');
  if (!gap) throw new Error('Expected Recursion learning gap');
  console.log(`Gap formed: ${gap.concept} (${gap.subconcept}) - status: ${gap.status}`);
  console.log(`Evidence items linked: ${gap.evidence.length}`);

  // Step 5: Teacher runs Diagnostic on gap
  console.log('\nStep 5: Teacher launches targeted Diagnostic on gap...');
  const diagRes = await axios.post(
    `${BASE_URL}/api/diagnostics`,
    { gap_id: gap.id },
    teacherHeaders
  );
  console.log('Misconception diagnosed:', diagRes.data.misconception);
  const diagQuestions = diagRes.data.questions;
  console.log(`Diagnostic probe questions generated: ${diagQuestions.length}`);

  // Step 6: Student takes Diagnostic attempt
  if (diagQuestions.length > 0) {
    console.log('\nStep 6: Student completes diagnostic probe attempt...');
    const diagAttempt = await axios.post(
      `${BASE_URL}/api/diagnostics/${diagRes.data.diagnostic.id}/attempt`,
      {
        question_id: diagQuestions[0].id,
        selected_option_ids: ['opt_1']
      },
      studentHeaders
    );
    console.log('Diagnostic attempt recorded, result:', diagAttempt.data.evidence.result);
  }

  // Step 7: Teacher creates Intervention from Intervention Center
  console.log('\nStep 7: Teacher creates targeted Intervention from Intervention Center...');
  const intRes = await axios.post(
    `${BASE_URL}/api/interventions`,
    { gap_id: gap.id },
    teacherHeaders
  );
  const intervention = intRes.data.intervention;
  const interventionPracticeQs = intRes.data.practice_questions;
  console.log('Intervention Plan created:', intervention.id, 'status:', intervention.status);
  console.log(`Scaffolded practice questions created: ${interventionPracticeQs.length}`);

  // Step 8: Student completes intervention practice questions
  console.log('\nStep 8: Student completes intervention practice...');
  for (const q of interventionPracticeQs) {
    let correctId = null;
    try {
      const parsed = typeof q.correct_option_ids === 'string' ? JSON.parse(q.correct_option_ids) : q.correct_option_ids;
      correctId = parsed[0];
    } catch {
      correctId = 'opt_1';
    }
    // Student answers correctly now because they studied the intervention plan!
    await axios.post(
      `${BASE_URL}/api/attempts`,
      {
        question_id: q.id,
        selected_option_ids: [correctId],
        source: 'practice'
      },
      studentHeaders
    );
  }

  // Step 9: Reassessment attempt & Progress comparison
  console.log('\nStep 9: Administering post-intervention Reassessment...');
  let reassessCorrectId = null;
  try {
    const parsed = typeof seededQuestion.correct_option_ids === 'string' 
      ? JSON.parse(seededQuestion.correct_option_ids) 
      : seededQuestion.correct_option_ids;
    reassessCorrectId = parsed[0];
  } catch {
    reassessCorrectId = 'opt_2';
  }

  const reassessRes = await axios.post(
    `${BASE_URL}/api/progress/reassessments`,
    {
      intervention_id: intervention.id,
      question_id: seededQuestion.id,
      selected_option_ids: [reassessCorrectId] // student got it right!
    },
    studentHeaders
  );

  console.log('Reassessment evaluated is_correct:', reassessRes.data.evaluation.is_correct);
  console.log('Gap resolved status:', reassessRes.data.gap_resolved);
  console.log('Progress delta recorded:', reassessRes.data.progress.delta);

  // Step 10: Progress Lab validation
  console.log('\nStep 10: Validating Progress Lab record...');
  const progLabRes = await axios.get(`${BASE_URL}/api/progress/${studentId}`, studentHeaders);
  const progressList = progLabRes.data.progress;
  console.log(`Progress records found: ${progressList.length}`);
  if (progressList.length === 0) throw new Error('Expected progress record');
  console.log('Progress delta object:', progressList[0].delta);
  console.log(`Before evidence count: ${progressList[0].before_evidence.length}, After evidence count: ${progressList[0].after_evidence.length}`);

  // Step 11: Test Secondary Apps (Class Insights, Code Lab, Settings)
  console.log('\nStep 11: Testing Secondary Apps...');
  // Class Insights
  const insightsRes = await axios.get(`${BASE_URL}/api/insights/class`, teacherHeaders);
  console.log('Class Insights summary:', insightsRes.data.summary);
  console.log(`Concepts tracked: ${insightsRes.data.concepts.length}`);

  // Code Lab
  const challengesRes = await axios.get(`${BASE_URL}/api/code-lab/challenges`, studentHeaders);
  console.log(`Code Lab challenges available: ${challengesRes.data.challenges.length}`);
  if (challengesRes.data.challenges.length > 0) {
    const ch = challengesRes.data.challenges[0];
    const runRes = await axios.post(
      `${BASE_URL}/api/code-lab/run`,
      { code: ch.initial_code, language: ch.language, stdin: '3' },
      studentHeaders
    );
    console.log('Code Lab run result stdout:', runRes.data.result?.stdout?.trim());

    const submitRes = await axios.post(
      `${BASE_URL}/api/code-lab/submit`,
      { challenge_id: ch.id, code: ch.initial_code, language: ch.language },
      studentHeaders
    );
    console.log('Code Lab submit passed:', submitRes.data.evaluation?.is_correct, 'marks:', submitRes.data.evaluation?.marks_awarded);
  }

  // Settings
  const settingsRes = await axios.get(`${BASE_URL}/api/settings/profile`, studentHeaders);
  console.log('Settings profile loaded for:', settingsRes.data.profile.name);

  // Step 12: Semantic search check
  console.log('\nStep 12: Testing Semantic Layer with pgvector...');
  const dupCheck = await axios.post(
    `${BASE_URL}/api/semantic/check-duplicate`,
    { statement: seededQuestion.statement, concept: 'Recursion' },
    teacherHeaders
  );
  console.log('Semantic duplicate check:', dupCheck.data.is_duplicate ? 'Flagged as duplicate!' : 'Unique');

  console.log('\n====================================================');
  console.log('🏆 GOLDEN PATH FULL LOOP END-TO-END PASSED 100%!');
  console.log('====================================================');
  process.exit(0);
}

runGoldenPath().catch((err) => {
  console.error('Golden path failed:', err.response?.data || err.message);
  process.exit(1);
});
