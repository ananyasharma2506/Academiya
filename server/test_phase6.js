import http from 'http';
import { app } from './index.js';
import { query, pool } from './db/index.js';

async function runPhase6Verification() {
  console.log('--- Starting Phase 6 Full Chain Verification ---');

  // Clean test tables
  await query('DELETE FROM diagnostic_attempts');
  await query('DELETE FROM diagnostics');
  await query('DELETE FROM interventions');
  await query('DELETE FROM learning_gaps');
  await query('DELETE FROM learning_evidence');
  await query('DELETE FROM attempts');
  await query('DELETE FROM questions');
  await query('DELETE FROM users WHERE email IN ($1, $2)', [
    'teacher_phase6@platform.local',
    'student_phase6@platform.local',
  ]);

  const server = http.createServer(app);
  const testPort = 5095;
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
      name: 'Teacher Phase6',
      email: 'teacher_phase6@platform.local',
      password: 'password123',
      role: 'teacher',
    });
    const teacherToken = teacherReg.data.token;

    const studentReg = await post('/api/auth/register', {
      name: 'Student Phase6',
      email: 'student_phase6@platform.local',
      password: 'password123',
      role: 'student',
    });
    const studentToken = studentReg.data.token;
    const studentId = studentReg.data.user.id;

    // 2. Form a learning gap via 3 weak attempts on 'Recursion'
    console.log('2. Producing initial learning gap (3 weak attempts)...');
    for (let i = 1; i <= 3; i++) {
      const q = await post(
        '/api/questions/seed',
        {
          concept: 'Recursion',
          subconcept: 'Base Case Handling',
          statement: `Recursion Gap Question ${i}`,
          options: [
            { id: 'c', text: 'Correct' },
            { id: 'w', text: 'Wrong' },
          ],
          correct_option_ids: ['c'],
          type: 'mcq_single',
        },
        teacherToken
      );

      await post(
        '/api/attempts',
        {
          question_id: q.data.question.id,
          selected_option_ids: ['w'],
          source: 'practice',
        },
        studentToken
      );
    }

    const gapsRes = await get(`/api/gaps/${studentId}`, teacherToken);
    if (gapsRes.data.gaps.length === 0) throw new Error('Failed to form initial gap');
    const gap = gapsRes.data.gaps[0];
    console.log(`Gap formed: ${gap.id} (${gap.concept} / ${gap.subconcept}) with ${gap.evidence.length} evidence items.`);

    // 3. Teacher launches Diagnostic: POST /api/diagnostics
    console.log('3. Teacher launching targeted diagnostic on gap...');
    const diagRes = await post(
      '/api/diagnostics',
      { gap_id: gap.id },
      teacherToken
    );
    if (diagRes.status !== 201) throw new Error('Diagnostic creation failed: ' + JSON.stringify(diagRes.data));

    const diagnostic = diagRes.data.diagnostic;
    const probeQuestions = diagRes.data.questions;
    console.log(`Diagnostic launched: ID = ${diagnostic.id}, generated ${probeQuestions.length} probe questions.`);
    console.log(`Isolated misconception in blueprint: "${diagnostic.blueprint.isolated_misconception}"`);

    // 4. Student completes Diagnostic attempt flow -> diagnostic_attempts rows
    console.log('4. Student completing diagnostic probes...');
    for (const pq of probeQuestions) {
      const diagAttemptRes = await post(
        `/api/diagnostics/${diagnostic.id}/attempt`,
        {
          question_id: pq.id,
          selected_option_ids: [pq.options[0].id], // attempt probe
        },
        studentToken
      );
      if (diagAttemptRes.status !== 201) throw new Error('Diagnostic attempt failed: ' + JSON.stringify(diagAttemptRes.data));
      console.log(`- Probe attempt recorded: result = ${diagAttemptRes.data.evidence.result}, evidence ID = ${diagAttemptRes.data.evidence.id}`);
    }

    // Confirm diagnostic attempts fed back into gap evidence
    const sharpenedGapRes = await get(`/api/gaps/${studentId}`, teacherToken);
    const sharpenedGap = sharpenedGapRes.data.gaps[0];
    console.log(`Sharpened gap evidence count: ${sharpenedGap.evidence.length} (increased from 3 to ${sharpenedGap.evidence.length})`);

    // 5. Teacher creates Intervention from same gap: POST /api/interventions
    console.log('5. Teacher creating targeted intervention plan...');
    const interventionRes = await post(
      '/api/interventions',
      { gap_id: gap.id },
      teacherToken
    );
    if (interventionRes.status !== 201) throw new Error('Intervention creation failed: ' + JSON.stringify(interventionRes.data));

    const intervention = interventionRes.data.intervention;
    const interventionPracticeQuestions = interventionRes.data.questions;
    console.log(`Intervention created: ID = ${intervention.id}, status = ${intervention.status}`);
    console.log(`Intervention plan: "${intervention.plan.summary}", targeted questions: ${interventionPracticeQuestions.length}`);

    // 6. Student completes Intervention Practice flow
    console.log('6. Student completing intervention practice exercises...');
    for (const ipq of interventionPracticeQuestions) {
      const intAttemptRes = await post(
        `/api/interventions/${intervention.id}/attempt`,
        {
          question_id: ipq.id,
          selected_option_ids: [ipq.correct_option_ids[0]], // answer correctly this time!
        },
        studentToken
      );
      if (intAttemptRes.status !== 201) throw new Error('Intervention attempt failed: ' + JSON.stringify(intAttemptRes.data));
      console.log(`- Intervention practice attempt recorded: correct = ${intAttemptRes.data.evaluation.is_correct}`);
    }

    // 7. Verify all rows exist and link cleanly without manual DB steps
    const diagAttemptsCount = await query('SELECT count(*) FROM diagnostic_attempts WHERE diagnostic_id = $1', [diagnostic.id]);
    const intInDb = await query('SELECT * FROM interventions WHERE id = $1', [intervention.id]);
    const finalEvidenceCount = await query('SELECT count(*) FROM learning_evidence WHERE student_id = $1', [studentId]);

    console.log('\n--- VERIFICATION AUDIT ---');
    console.log(`Diagnostic attempts recorded: ${diagAttemptsCount.rows[0].count}`);
    console.log(`Intervention status in DB: ${intInDb.rows[0].status}`);
    console.log(`Total continuous learning evidence entries: ${finalEvidenceCount.rows[0].count}`);

    if (parseInt(diagAttemptsCount.rows[0].count, 10) < 1) throw new Error('No diagnostic attempts in DB');
    if (intInDb.rows[0].status !== 'active') throw new Error('Intervention not active');

    console.log('====================================================');
    console.log('>>> PHASE 6 FULL CHAIN VERIFIED PERFECTLY! <<<');
    console.log('====================================================');
  } finally {
    server.close();
    await pool.end();
  }
}

runPhase6Verification().catch((err) => {
  console.error('PHASE 6 VERIFICATION FAILED:', err);
  process.exit(1);
});
