import http from 'http';
import { app } from './index.js';
import { query, pool } from './db/index.js';

async function runPhases7to9Verification() {
  console.log('--- Starting Verification for Phases 7, 8, and 9 ---');

  // Clean test tables
  await query('DELETE FROM progress');
  await query('DELETE FROM reassessments');
  await query('DELETE FROM coding_challenges');
  await query('DELETE FROM diagnostic_attempts');
  await query('DELETE FROM diagnostics');
  await query('DELETE FROM interventions');
  await query('DELETE FROM learning_gaps');
  await query('DELETE FROM learning_evidence');
  await query('DELETE FROM attempts');
  await query('DELETE FROM questions');
  await query('DELETE FROM users WHERE email IN ($1, $2)', [
    'teacher_golden@platform.local',
    'student_golden@platform.local',
  ]);

  const server = http.createServer(app);
  const testPort = 5094;
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
    // 1. Auth Setup
    console.log('1. Setting up users (Teacher & Student)...');
    const teacherRes = await post('/api/auth/register', {
      name: 'Teacher Golden',
      email: 'teacher_golden@platform.local',
      password: 'password123',
      role: 'teacher',
    });
    const teacherToken = teacherRes.data.token;

    const studentRes = await post('/api/auth/register', {
      name: 'Student Golden',
      email: 'student_golden@platform.local',
      password: 'password123',
      role: 'student',
    });
    const studentToken = studentRes.data.token;
    const studentId = studentRes.data.user.id;

    // 2. Full Golden Path Chain: Seed -> Practice -> Evidence -> Gap
    console.log('2. Golden Path Chain: Seeding question with semantic embedding...');
    const seedQ = await post(
      '/api/questions/seed',
      {
        concept: 'Recursion',
        subconcept: 'Base Case Termination',
        statement: 'What is the purpose of a recursive base case?',
        options: [
          { id: 'opt_a', text: 'To terminate recursive calls and avoid infinite stack growth' },
          { id: 'opt_b', text: 'To increase runtime execution heap allocation' },
        ],
        correct_option_ids: ['opt_a'],
        type: 'mcq_single',
      },
      teacherToken
    );
    console.log('Seeded question ID:', seedQ.data.question.id);

    // Verify embedding was created in pgvector
    const embedCheck = await query('SELECT embedding FROM questions WHERE id = $1', [seedQ.data.question.id]);
    console.log('pgvector embedding populated:', embedCheck.rows[0]?.embedding !== null);
    if (!embedCheck.rows[0]?.embedding) throw new Error('Question embedding vector was not populated');

    // Submit 3 wrong attempts to form an emerging gap
    console.log('Student submitting 3 incorrect practice attempts...');
    for (let i = 0; i < 3; i++) {
      await post(
        '/api/attempts',
        {
          question_id: seedQ.data.question.id,
          selected_option_ids: ['opt_b'],
          source: 'practice',
        },
        studentToken
      );
    }

    const gapRes = await get(`/api/gaps/${studentId}`, teacherToken);
    const gap = gapRes.data.gaps[0];
    console.log(`Gap formed: ${gap.id} on ${gap.concept} with ${gap.evidence.length} evidence items.`);

    // 3. Diagnostic Lab -> Misconception
    console.log('3. Diagnostic Lab: Launching diagnostic probe...');
    const diagRes = await post('/api/diagnostics', { gap_id: gap.id }, teacherToken);
    const diagnostic = diagRes.data.diagnostic;
    const probeQuestion = diagRes.data.questions[0];

    await post(
      `/api/diagnostics/${diagnostic.id}/attempt`,
      {
        question_id: probeQuestion.id,
        selected_option_ids: [probeQuestion.options[0].id],
      },
      studentToken
    );
    console.log('Diagnostic probe completed.');

    // 4. Intervention Center -> Plan & Practice
    console.log('4. Intervention Center: Creating remediation plan & student practice...');
    const intRes = await post('/api/interventions', { gap_id: gap.id }, teacherToken);
    const intervention = intRes.data.intervention;
    const intPracticeQuestions = intRes.data.questions;

    // Student completes intervention practice with correct answers
    for (const ipq of intPracticeQuestions) {
      await post(
        `/api/interventions/${intervention.id}/attempt`,
        {
          question_id: ipq.id,
          selected_option_ids: [ipq.correct_option_ids[0]],
        },
        studentToken
      );
    }
    console.log('Intervention practice completed successfully.');

    // 5. Phase 7 Reassessment & Progress Lab: POST /api/reassessments
    console.log('5. Phase 7 Reassessment: Administering reassessment on same concept...');
    const reassessQ = await post(
      '/api/questions/seed',
      {
        concept: 'Recursion',
        subconcept: 'Base Case Termination',
        statement: 'In binary tree recursion, what serves as the base case?',
        options: [
          { id: 'opt_r1', text: 'When the current node is null / empty' },
          { id: 'opt_r2', text: 'When the tree height equals integer max' },
        ],
        correct_option_ids: ['opt_r1'],
        type: 'mcq_single',
      },
      teacherToken
    );

    const reassessRes = await post(
      '/api/reassessments',
      {
        intervention_id: intervention.id,
        question_id: reassessQ.data.question.id,
        selected_option_ids: ['opt_r1'], // Correct!
      },
      studentToken
    );

    if (reassessRes.status !== 201) throw new Error('Reassessment failed: ' + JSON.stringify(reassessRes.data));

    const progressRecord = reassessRes.data.progress;
    const delta = reassessRes.data.delta;

    console.log('\n--- PHASE 7 PROGRESS LAB DELTA ---');
    console.log(`Concept: ${delta.concept}`);
    console.log(`Before Intervention: ${delta.before.accuracy_percent}% accuracy (${delta.before.correct}/${delta.before.total} correct)`);
    console.log(`After Intervention:  ${delta.after.accuracy_percent}% accuracy (${delta.after.correct}/${delta.after.total} correct)`);
    console.log(`Mastery Improved: ${delta.mastery_improved}`);
    console.log('----------------------------------');

    if (!delta.mastery_improved) throw new Error('Expected mastery improvement in progress delta');

    // 6. Phase 8 Secondary Apps: Class Insights & Code Lab
    console.log('6. Phase 8 Secondary Apps Verification:');
    // Class Insights check:
    const insightsRes = await get('/api/insights/class', teacherToken);
    console.log(`Class insights aggregations count: ${insightsRes.data.insights.length}`);
    if (insightsRes.data.insights.length === 0) throw new Error('Class insights returned empty');
    console.log(`Class Insight Item 1: Concept = ${insightsRes.data.insights[0].concept}, Affected Students = ${insightsRes.data.insights[0].affected_students_count}`);

    // Code Lab check:
    const seedChallengeRes = await post(
      '/api/code-lab/seed',
      {
        concept: 'Recursion',
        subconcept: 'Factorial Debugging',
        title: 'Recursive Factorial',
        description: 'Fix the base condition to return 1 when n <= 1',
        expected_behaviour: 'Returns n * fact(n-1) with base case returning 1',
        test_cases: [
          { id: 'tc1', input: '0', expected_output: '1', is_hidden: false },
          { id: 'tc2', input: '3', expected_output: '6', is_hidden: false },
        ],
      },
      teacherToken
    );
    const challengeId = seedChallengeRes.data.challenge.id;

    // Run python solution in Code Lab
    const codeRunRes = await post(
      '/api/code-lab/run',
      {
        challenge_id: challengeId,
        language: 'python',
        code: `import sys\nn = int(sys.stdin.read().strip() or "0")\ndef fact(x):\n  return 1 if x <= 1 else x * fact(x - 1)\nprint(fact(n))\n`,
      },
      studentToken
    );
    console.log(`Code Lab run result: passed = ${codeRunRes.data.is_passed}`);
    if (!codeRunRes.data.is_passed) throw new Error('Code lab test cases failed');

    // 7. Phase 9 Semantic Layer: pgvector Search & Duplicate Detection
    console.log('7. Phase 9 Semantic Layer Verification:');
    // Test duplicate detection
    const dupCheck = await post(
      '/api/semantic/check-duplicate',
      {
        concept: 'Recursion',
        statement: 'What is the purpose of a recursive base case?', // Exactly identical statement
      },
      teacherToken
    );
    console.log(`Semantic duplicate detection result: is_duplicate = ${dupCheck.data.is_duplicate}`);
    if (!dupCheck.data.is_duplicate) throw new Error('Expected duplicate detection to flag identical question');

    // Test semantic search similarity retrieval
    const searchRes = await post(
      '/api/semantic/search',
      {
        concept: 'Recursion',
        query: 'recursive call stack termination condition',
        limit: 3,
      },
      teacherToken
    );
    console.log(`Semantic search results found: ${searchRes.data.results.length}`);
    if (searchRes.data.results.length === 0) throw new Error('Semantic search returned no results');

    console.log('====================================================');
    console.log('>>> PHASES 7, 8, AND 9 FULLY VERIFIED! <<<');
    console.log('>>> COMPLETE 9-PHASE BUILD RUNS END-TO-END! <<<');
    console.log('====================================================');
  } finally {
    server.close();
    await pool.end();
  }
}

runPhases7to9Verification().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
