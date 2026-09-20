/**
 * Verification Script: Phase 10 (Descriptive-Answer Questions) & Phase 11 (Deterministic Auto Attendance)
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

async function verifyPhases10And11() {
  console.log('🚀 Starting Verification for Phase 10 & Phase 11...\n');

  // 1. Auth Login (Teacher & Student)
  console.log('Step 1: Logging in as Teacher and Student...');
  const teacherLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: 'teacher.golden@akademiya.io',
    password: 'password123'
  });
  const teacherToken = teacherLogin.data.token;
  const teacherId = teacherLogin.data.user.id;

  const studentLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: 'student.golden@akademiya.io',
    password: 'password123'
  });
  const studentToken = studentLogin.data.token;
  const studentId = studentLogin.data.user.id;
  console.log('✅ Logged in successfully.\n');

  // ==========================================
  // PHASE 10 VERIFICATION: Descriptive Questions
  // ==========================================
  console.log('==========================================');
  console.log('PHASE 10: Descriptive Questions Verification');
  console.log('==========================================');

  // 2. Teacher seeds a descriptive question with reference answer
  console.log('Step 2: Seeding a descriptive question with reference answer...');
  const seedRes = await axios.post(
    `${BASE_URL}/api/questions/seed`,
    {
      concept: 'Recursion',
      subconcept: 'Call Stack & Base Case',
      statement: 'Explain why a recursive function without a proper base case leads to a stack overflow error.',
      type: 'descriptive',
      reference_answer: 'Each recursive function call allocates a new stack frame on the execution call stack to store local variables and return addresses. Without a base case to terminate recursion, the function continues to call itself indefinitely until the allocated call stack memory exceeds its limit, resulting in a stack overflow error.',
      bloom_level: 'analyze',
      difficulty: 'medium'
    },
    { headers: { Authorization: `Bearer ${teacherToken}` } }
  );
  const descriptiveQ = seedRes.data.question;
  console.log(`✅ Seeded descriptive question ID: ${descriptiveQ.id}`);
  console.log(`   Type: ${descriptiveQ.type}`);
  console.log(`   Reference Answer preview: "${descriptiveQ.reference_answer.slice(0, 80)}..."`);
  console.log(`   Has embedding: ${Boolean(descriptiveQ.reference_answer_embedding)}\n`);

  // 3. Student submits a clearly CORRECT descriptive answer
  console.log('Step 3: Student submits a comprehensive CORRECT descriptive answer...');
  const correctSubmission = await axios.post(
    `${BASE_URL}/api/attempts`,
    {
      question_id: descriptiveQ.id,
      answer: 'A recursive function pushes a new stack frame onto the call stack for every call. When there is no base case, the termination condition is never reached, so frames keep accumulating until stack memory is exhausted and a stack overflow occurs.'
    },
    { headers: { Authorization: `Bearer ${studentToken}` } }
  );
  const correctRes = correctSubmission.data;
  console.log('✅ Correct answer evaluation result:');
  console.log(`   is_correct: ${correctRes.evaluation.is_correct}`);
  console.log(`   verdict: ${correctRes.evaluation.verdict}`);
  console.log(`   marks_awarded: ${correctRes.evaluation.marks_awarded}`);
  console.log(`   semantic similarity: ${correctRes.evaluation.grading_details?.similarity_score}`);
  console.log(`   covered points:`, correctRes.evaluation.grading_details?.covered);
  console.log(`   missed points:`, correctRes.evaluation.grading_details?.missed);
  console.log(`   evidence source tag: "${correctRes.evidence.source}" (ai_graded_descriptive)\n`);

  if (!['correct', 'partial'].includes(correctRes.evaluation.verdict)) {
    throw new Error('Expected correct or partial verdict for comprehensive answer');
  }
  if (correctRes.evidence.source !== 'ai_graded_descriptive') {
    throw new Error('Expected learning_evidence source to be ai_graded_descriptive');
  }

  // 4. Student submits a clearly WRONG / IRRELEVANT descriptive answer
  console.log('Step 4: Student submits a clearly WRONG descriptive answer...');
  const wrongSubmission = await axios.post(
    `${BASE_URL}/api/attempts`,
    {
      question_id: descriptiveQ.id,
      answer: 'Bananas are yellow tropical fruits that grow on trees and contain potassium.'
    },
    { headers: { Authorization: `Bearer ${studentToken}` } }
  );
  const wrongRes = wrongSubmission.data;
  console.log('✅ Wrong answer evaluation result:');
  console.log(`   is_correct: ${wrongRes.evaluation.is_correct}`);
  console.log(`   verdict: ${wrongRes.evaluation.verdict}`);
  console.log(`   marks_awarded: ${wrongRes.evaluation.marks_awarded}`);
  console.log(`   semantic similarity: ${wrongRes.evaluation.grading_details?.similarity_score}`);
  console.log(`   covered points:`, wrongRes.evaluation.grading_details?.covered);
  console.log(`   missed points:`, wrongRes.evaluation.grading_details?.missed);
  console.log(`   evidence source tag: "${wrongRes.evidence.source}" (ai_graded_descriptive)\n`);

  if (wrongRes.evaluation.verdict !== 'incorrect') {
    throw new Error('Expected incorrect verdict for completely unrelated answer');
  }

  // ==========================================
  // PHASE 11 VERIFICATION: Deterministic Auto Attendance
  // ==========================================
  console.log('==========================================');
  console.log('PHASE 11: Auto Attendance Verification');
  console.log('==========================================');

  // 5. Teacher creates an active session window (current time ± 30 mins)
  console.log('Step 5: Teacher creates an active class session window...');
  const now = new Date();
  const startTime = new Date(now.getTime() - 15 * 60 * 1000); // started 15 mins ago
  const endTime = new Date(now.getTime() + 45 * 60 * 1000);   // ends in 45 mins

  const sessionRes = await axios.post(
    `${BASE_URL}/api/attendance/sessions`,
    {
      title: 'CS101: Recursion & Data Structures Lab',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString()
    },
    { headers: { Authorization: `Bearer ${teacherToken}` } }
  );
  const activeSession = sessionRes.data.session;
  console.log(`✅ Created session ID: ${activeSession.id}`);
  console.log(`   Title: "${activeSession.title}"`);
  console.log(`   Window: ${activeSession.start_time} -> ${activeSession.end_time}\n`);

  // 6. Student completes an assignment/practice attempt inside the session window
  console.log('Step 6: Student performs activity during the active window...');
  const attemptInsideWindow = await axios.post(
    `${BASE_URL}/api/attempts`,
    {
      question_id: descriptiveQ.id,
      answer: 'Stack frames overflow the call stack memory.'
    },
    { headers: { Authorization: `Bearer ${studentToken}` } }
  );

  const autoAtt = attemptInsideWindow.data.auto_attendance;
  console.log('✅ Attempt response auto_attendance:', autoAtt);
  if (!autoAtt || autoAtt.length === 0) {
    throw new Error('Expected auto_attendance to record student attendance inside active window');
  }
  console.log(`   Attendance marked with source: "${autoAtt[0].source}" (assignment_completion)\n`);

  // 7. Student performs another activity in the same window (test idempotency)
  console.log('Step 7: Student performs a second activity in same window (idempotency check)...');
  const secondAttempt = await axios.post(
    `${BASE_URL}/api/attempts`,
    {
      question_id: descriptiveQ.id,
      answer: 'Second activity test.'
    },
    { headers: { Authorization: `Bearer ${studentToken}` } }
  );
  console.log('✅ Duplicate check: auto_attendance count =', secondAttempt.data.auto_attendance?.length);
  if (secondAttempt.data.auto_attendance?.length !== 0) {
    throw new Error('Expected 0 new attendance records (idempotent unique student_id + session_id constraint)');
  }

  // 8. Teacher inspects the Session Roster
  console.log('Step 8: Teacher checks GET /api/attendance/session/:id roster...');
  const rosterRes = await axios.get(
    `${BASE_URL}/api/attendance/session/${activeSession.id}`,
    { headers: { Authorization: `Bearer ${teacherToken}` } }
  );
  const rosterData = rosterRes.data;
  console.log(`✅ Session: "${rosterData.session.title}"`);
  console.log(`   Total students: ${rosterData.stats.total_students}`);
  console.log(`   Present count: ${rosterData.stats.present_count}`);
  console.log(`   Attendance rate: ${rosterData.stats.attendance_rate_pct}%`);
  console.log(`   Roster preview:`);
  rosterData.roster.forEach(r => {
    console.log(`   - ${r.student_name} (${r.student_email}): ${r.is_present ? '✓ PRESENT' : '✗ ABSENT'} [source: ${r.attendance_source || 'none'}]`);
  });

  const studentRow = rosterData.roster.find(r => r.student_id === studentId);
  if (!studentRow || !studentRow.is_present || studentRow.attendance_source !== 'assignment_completion') {
    throw new Error('Student should be present with source = assignment_completion');
  }

  console.log('\n====================================================');
  console.log('🏆 PHASE 10 & PHASE 11 ALL VERIFICATION CHECKS PASSED!');
  console.log('====================================================');
}

verifyPhases10And11().catch(err => {
  console.error('\n❌ Verification failed:', err.response?.data || err.message);
  process.exit(1);
});
