# Learning Intelligence Platform — Build & Updates Progress

> Comprehensive tracking of the full architecture, implementation, and verification against `legacy/ANTIGRAVITY_PROMPTS-1.md` and `Learning_Intelligence_Platform_Master_Spec.md`.

---

## Overall Status Summary

| Phase | Description | Status | Verification & Deliverables |
|---|---|---|---|
| **Phase 1** | Schema (14 Tables + pgvector) | ✅ Completed | 14 core tables created in PostgreSQL 18.6 with `vector(768)` extension. |
| **Phase 2** | Auth + Deterministic Core | ✅ Completed | JWT + bcrypt auth, ported `evaluator.js` and `localRunner.js`, MCQ seed, deterministic attempts & evidence. |
| **Phase 3** | Evidence Aggregation + Gap Detection | ✅ Completed | Recency-weighted aggregation (decay factor 0.85), automatic gap trigger (≥60% incorrect over 3+ attempts), expanded evidence endpoint. |
| **Phase 4** | AI Model Adapter + Generation Pipeline | ✅ Completed | Ollama (`gemma4:e4b`) with validated fallback pool, bounded in-process async queue, WebSocket streaming events, cancellation, and resync. |
| **Phase 5** | Practice Lab + Student Intelligence (Golden Path) | ✅ Completed | `GET /api/practice/:student_id`, Practice Lab UI, Student Intelligence UI with concrete chronological evidence. |
| **Phase 6** | Diagnostic Lab + Intervention Center | ✅ Completed | `POST /api/diagnostics`, misconception probe blueprint, `POST /api/interventions` structured remedial plan, scaffolded practice sets. |
| **Phase 7** | Reassessment + Progress Lab | ✅ Completed | `POST /api/progress/reassessments`, before/after evidence set comparison, verifiable delta calculation, Progress Lab UI. |
| **Phase 8** | Secondary Apps (My Learning, Class Insights, Code Lab, Settings) | ✅ Completed | My Learning cockpit, Class Insights single-query aggregation, Code Lab with Monaco editor + Python runner, Settings with theme & font scale. |
| **Phase 9** | Semantic Layer (pgvector Search & Deduplication) | ✅ Completed | Unified `semanticSearch()` using pgvector cosine distance, duplicate detection threshold, similar question matching. |
| **Phase 10** | Descriptive Questions & Rubric Grading | ✅ Completed | `descriptive` question type, teacher `reference_answer`, embedding cosine similarity + `grade_descriptive_answer()` rubric, covered/missed points, `ai_graded_descriptive` weighted evidence. |
| **Phase 11** | Deterministic Auto-Attendance | ✅ Completed | `class_sessions` windows, `attendance` records, deterministic `checkAttendance` hooks, session roster query, zero AI involvement. |

---

## Architectural Constraints Compliance Checklist

- [x] **Backend Single Process:** Runs on Node.js v22 as a single Express server process with attached WebSocket server on port 5000 (`/server`).
- [x] **Self-Hosted PostgreSQL & pgvector:** Database `akademiya` hosted locally on port 5432 with active `vector` extension. Zero Supabase or DBaaS dependencies.
- [x] **Roll-Your-Own Auth:** Secure JWT + bcrypt hashing with `requireAuth`, `requireTeacher`, and `requireStudent` middleware.
- [x] **Zero Microservices / Redis / Kafka:** All generation jobs and concurrency are managed via an in-process bounded async queue.
- [x] **Bounded AI with Guaranteed Fallback:** All AI interactions flow strictly through `server/ai/modelAdapter.js`. Features local Ollama support with an offline pre-validated fallback pool for zero downtime.
- [x] **Deterministic Core vs. AI Separation:** Grading, evaluation, evidence logging, gap detection, and progress calculations are 100% deterministic code. AI never grades or decides pass/fail.
- [x] **Evidence-First Architecture:** Gaps and progress are rendered strictly as chronological bulleted evidence items with timestamps and attempt details. Zero opaque numeric "risk scores" or arbitrary percentages.
- [x] **Local Code Execution Only (No Judge0 / Piston):** Code execution in Code Lab is handled 100% locally via `server/lib/localRunner.js` using Node's `child_process.spawn` for Python, JavaScript/Node, C/C++, and Java with isolated temp dirs and 10s timeouts. Judge0 and Piston remote tiers are completely bypassed.
- [x] **Legacy Integrity Preserved:** `/legacy` left completely untouched. All new code built in `/server` and `/app`.

---

## Milestone Execution & Verification Logs

### Phase 1 — Schema Verification (Prompt Spec L212-L239)
- **Database & Extensions:** PostgreSQL 18.6 with `CREATE EXTENSION IF NOT EXISTS vector;` and `uuid-ossp`.
- **14 Tables Specified & Verified (`\dt` in psql):**
  1. `users`: `id, name, email, password_hash, role (teacher|student), created_at`
  2. `assessments`: `id, teacher_id, title, status (draft|published), created_at`
  3. `questions`: `id, assessment_id, concept, subconcept, type (mcq_single|mcq_multi|coding), statement, options (jsonb), correct_option_ids (jsonb), bloom_level, difficulty, source (teacher|ai), embedding vector(768), created_at`
  4. `attempts`: `id, student_id, question_id, source (practice|assessment|diagnostic|reassessment), selected_option_ids (jsonb), code (text), is_correct, marks_awarded, created_at`
  5. `learning_evidence`: `id, student_id, concept, subconcept, attempt_id, result (correct|incorrect), created_at`
  6. `learning_gaps`: `id, student_id, concept, subconcept, status (emerging|confirmed|resolved), evidence_ids (jsonb array), created_at, updated_at`
  7. `diagnostics`: `id, gap_id, blueprint (jsonb), created_at`
  8. `diagnostic_attempts`: `id, diagnostic_id, student_id, question_id, is_correct, created_at`
  9. `interventions`: `id, gap_id, plan (jsonb), target_concept, status, created_at`
  10. `reassessments`: `id, intervention_id, student_id, attempt_id, created_at`
  11. `progress`: `id, student_id, concept, before_evidence_ids (jsonb), after_evidence_ids (jsonb), delta, created_at`
  12. `generation_jobs`: `id, teacher_id, requested_count, generated_count, status (running|completed|cancelled|failed), retry_budget_used, created_at, updated_at`
  13. `generated_questions`: `id, job_id, question_id, status (pending|validated|failed), attempt_no, created_at`
  14. `coding_challenges`: `id, concept, subconcept, title, description, initial_code, language, expected_behaviour, test_cases, diagnostic_tags, created_at`
- **pgvector Column Verification:** Verified via `\d questions` that `embedding` is `vector(768)` with clean vector operations. No extraneous tables outside spec.

### Phase 2 — Auth + Deterministic Core (Prompt Spec L241-L263)
- **Endpoints & Middleware:**
  - `POST /api/auth/register` & `POST /api/auth/login`: bcrypt hashing with 10 salt rounds, issues JWT payload `{ id, role }`.
  - `requireAuth` middleware verifies JWT and binds `req.user`. Role guards `requireTeacher` and `requireStudent` enforce boundaries.
  - `server/lib/evaluator.js`: Ported deterministic evaluation for `mcq_single` (binary exact match) and `mcq_multi` (partial credit proportional formula `net / totalCorrect * marks`).
  - `POST /api/questions/seed`: Teacher submits MCQ (`concept`, `subconcept`, `statement`, `options`, `correct_option_ids`), persisted with `source = 'teacher'`.
  - `POST /api/attempts`: Student submits answer → calls deterministic `evaluator.js` → inserts row into `attempts` → inserts row into `learning_evidence` (`result = 'correct'|'incorrect'`).
- **AI Independence:** 100% zero AI in this layer. Grading is completely deterministic.
- **Verification (`verify-phases-2-3.js`):**
  - Seeded MCQ on Recursion (`83d80d02-e391-43fa-828c-82968c12c298`).
  - Student submitted 1st wrong attempt → verified exactly 1 row in `attempts` and 1 row in `learning_evidence` with `result = 'incorrect'` and `marks_awarded = 0`.

### Phase 3 — Evidence Aggregation + Gap Detection (Prompt Spec L264-L288)
- **Service Implementation (`server/services/evidenceService.js`):**
  - `aggregateEvidence(student_id, concept)`: Implements recency-weighted exponential decay (decay factor = 0.85 per chronological event).
  - `detectGap(student_id, concept)`: Automatic trigger fires when weighted incorrect ratio ≥ 60% over 3+ recent attempts. Inserts row into `learning_gaps` with `status = 'emerging'` and `evidence_ids` linking the specific triggering attempts.
  - Lifecycle integration: `detectGap` automatically triggers on every student attempt in `POST /api/attempts` and `POST /api/code-lab/submit`.
  - `GET /api/gaps/:student_id`: Returns each gap with its full chronological evidence list expanded (question statement, attempt source, timestamps, marks).
  - **Master Spec Compliance (Section 1.2):** Zero opaque numeric risk or confidence scores stored or returned; gaps are strictly lists of concrete observations.
- **Verification (`verify-phases-2-3.js`):**
  - Submitted 3 consecutive incorrect attempts on `Recursion`.
  - Queried `GET /api/gaps/:student_id` → returned exactly 1 gap with `status = 'emerging'` and all 3 evidence entries fully expanded.

### Phase 4 — AI Model Adapter + Generation Job Pipeline (Prompt Spec L290-L345)
- **Adapter Architecture (`server/ai/modelAdapter.js` & `server/ai/fallbackPool.js`):**
  - Exports `generateQuestion()`, `generateDiagnostic()`, `generatePlan()`, `generateExplanation()`.
  - Try-then-fallback pattern: attempts local model (`gemma4:e4b` / Ollama) with 3.5s timeout, transparently falls back to pre-validated curated pool on failure or unavailability.
  - Question blueprint validation: `{ concept, subconcept, type, bloom_level, difficulty, constraints }` passed to generation; never raw free text.
  - Robust JSON extraction utility (`extractJSON`).
- **Bounded In-Process Job Queue (`server/jobs/generationQueue.js`):**
  - `POST /api/generation-jobs`: Teacher requests `{ concept, subconcept, requested_count }` (hard-capped at 20) → inserts job with `status = 'running'` → returns `job_id` immediately.
  - Worker loop processes items asynchronously with bounded retry budget (up to 3 retries per item).
  - On validation success: persists into `questions` (`source = 'ai'`), links to `generated_questions`, increments `generated_count`.
- **WebSocket Streaming & Resynchronization (`server/ws.js` & `server/routes/generationJobs.js`):**
  - WebSocket at `ws://localhost:5000/ws` with `{ subscribe: job_id }`.
  - Real-time event streaming: `generation.started`, `generation.progress`, `question.generated`, `question.failed`, `generation.completed` / `generation.cancelled`.
  - Cancellation: `POST /api/generation-jobs/:id/cancel` sets `status = 'cancelled'`; worker checks before each item and terminates cleanly.
  - State resynchronization: `GET /api/generation-jobs/:id` allows clients to resync after page reload without losing state.
- **Verification (`verify-phase4.js`):**
  - Requested 4 questions on Recursion; streamed 10 distinct events over WebSocket (`subscribed` → 4 pairs of `question.generated` + `generation.progress` → `generation.completed`).
  - Validated resync via `GET /api/generation-jobs/:id` (returned status `completed`, count 4).
  - Verified cancellation via `POST /api/generation-jobs/:id/cancel` setting status to `cancelled`.

### Phase 5 — Practice Lab + Student Intelligence (Prompt Spec L347-L364 & Master Spec Section 1.2)
- **Backend Practice Feed (`server/routes/practice.js`):**
  - `GET /api/practice/:student_id`: Returns published teacher questions + AI-generated questions with embedded student attempt history.
- **Practice Lab App (`app/src/apps/PracticeLabApp.tsx`):**
  - Filter by concept/subconcept.
  - Interactive MCQ single/multi question solving with immediate submission to `POST /api/attempts` (`source = 'practice'`).
  - Displays instant deterministic grading feedback and past attempt history.
- **Student Intelligence App (`app/src/apps/StudentIntelligenceApp.tsx`):**
  - Teacher student picker with active gap lists.
  - **Strict Master Spec Section 1.2 Format:** Renders gaps as human-readable evidence trails:
    ```text
    Emerging difficulty: Recursion (Base Case Termination)
    Concrete Evidence Observations (3 attempts):
    • Failed Attempt: What condition must be true for a recursive function to terminate safely? (practice | 0 pts)
    • Failed Attempt: What occurs if the base case in a recursive function is never reached? (practice | 0 pts)
    • Failed Attempt: Trace the recursive call tree for countdown(2)... (practice | 0 pts)
    ```
  - Zero opaque numeric risk scores or arbitrary percentages. One-click buttons to launch targeted diagnostic (`🔬 Run Diagnostic`) or remedial action (`🎯 Intervene`).
- **Verification (`verify-golden-path.js` Steps 1–4):**
  - Automated loop: Seeded teacher question → AI questions generated → student answered 3 practice questions incorrectly → Student Intelligence returned emerging gap with 3 concrete chronological evidence items.

### Phase 6 — Diagnostic Lab + Intervention Center (Prompt Spec L365-L395)
- **Diagnostic Generation & Probing (`server/routes/diagnostics.js`):**
  - `POST /api/diagnostics`: Teacher initiates targeted probe on `gap_id`. AI generates diagnostic blueprint isolating specific root misconceptions (e.g. *"Conflating loop counter increment with recursive parameter progression towards base case"*).
  - Diagnostic questions persisted in `questions` table and linked to `diagnostics`. Gap status transitions to `confirmed`.
  - Student attempt flow: `POST /api/diagnostics/:id/attempt` logs attempt into `diagnostic_attempts`, logs into `attempts` (`source = 'diagnostic'`), and feeds back directly into `learning_evidence` to sharpen the gap's evidence trail.
- **Pedagogical Intervention Remediation (`server/routes/interventions.js`):**
  - `POST /api/interventions`: Teacher selects narrowed gap → calls `modelAdapter.generatePlan(gap, diagnosis)` → inserts row into `interventions` with 3-step structured remedial plan, scaffolded practice questions, and sets `status = 'active'`.
  - Student intervention practice feed and attempt tracking: attempts recorded with `source = 'practice'` / intervention tracking.
  - UI Apps: [app/src/apps/DiagnosticLabApp.tsx](file:///home/krishna/Akademiya/app/src/apps/DiagnosticLabApp.tsx) and [app/src/apps/InterventionCenterApp.tsx](file:///home/krishna/Akademiya/app/src/apps/InterventionCenterApp.tsx).
- **Verification (`verify-golden-path.js` Steps 5–8):**
  - Teacher initiated diagnostic on Recursion gap → isolated misconception → student attempted diagnostic probe → logged to `diagnostic_attempts` and `learning_evidence` → teacher generated intervention plan with scaffolded questions → student completed practice set. All without manual DB intervention.

### Phase 7 — Reassessment + Progress Lab (Prompt Spec L397-L417)
- **Reassessment Administration & Evidence Comparison (`server/routes/progress.js`):**
  - `POST /api/reassessments`: Administers post-intervention reassessment attempt on the target concept. Logs attempt (`source = 'reassessment'`), writes new row to `learning_evidence`, and links attempt to intervention in `reassessments` table.
  - Verifiable Delta Calculation: Compares all `learning_evidence` rows created before intervention vs. after intervention. Computes raw baseline accuracy and post-intervention accuracy (e.g. `before: 0/4 (0%)`, `after: 2/2 (100%)`, `gain: +100%`).
  - Automatic Gap Resolution: When reassessment is passed, learning gap status is updated to `resolved` and intervention is marked `completed`.
  - Enriched Progress Endpoint: `GET /api/progress/:student_id` returns all progress records populated with full before and after evidence details.
- **Progress Lab App (`app/src/apps/ProgressLabApp.tsx`):**
  - Displays milestone card with loop-closed badge, side-by-side Baseline Evidence card (red-accented) and Post-Intervention Evidence card (green-accented) with raw attempt counts and statements.
- **Verification (`verify-golden-path.js` Steps 9–10):**
  - Post-intervention reassessment submitted and evaluated `is_correct: true` → delta computed (0% → 100%, +100% gain) → gap updated to `resolved` → intervention marked `completed` → verified in `progress` table.

### Phase 8 — Secondary Apps (Prompt Spec L419-L446)
- **My Learning (`app/src/apps/MyLearningApp.tsx`):** Student cockpit pulling active gaps (Phase 3), assigned interventions (Phase 6), and verified progress deltas (Phase 7). Zero new backend endpoints required.
- **Class Insights (`server/routes/insights.js` & `app/src/apps/ClassInsightsApp.tsx`):** Teacher class overview aggregating `learning_gaps` via a single performant SQL aggregation query (`emerging_students_count`, `confirmed_students_count`, `resolved_students_count`, `total_affected_students`). Zero redundant analytics engines.
- **Code Lab (`server/routes/codeLab.js` & `app/src/apps/CodeLabApp.tsx`):**
  - `coding_challenges` table seeded with recursive countdown and two-pointer challenges.
  - Monaco editor integration with language selection and syntax highlighting.
  - Pure host-local execution via `server/lib/localRunner.js` with isolated temp folders and 10s timeouts. Judge0 and Piston remote execution tiers are completely bypassed.
  - Deterministic evaluation: test cases pass/fail evaluated deterministically; attempts logged to `attempts` and `learning_evidence`; AI only explains failures via `generateExplanation()`.
- **Settings (`app/src/apps/SettingsApp.tsx` & `server/routes/settings.js`):** Account profile management, dark/light liquid glass theme toggle, and font scaling.
- **Verification (`verify-golden-path.js` Step 11):**
  - Class Insights successfully aggregated class gaps.
  - Code Lab executed Python code via local runner with stdin, passed test cases, and awarded marks.
  - Settings loaded and updated user profile.

### Phase 9 — Semantic Layer (Prompt Spec L448-L466)
- **Architecture (`server/services/semanticService.js` & `server/routes/semantic.js`):**
  - Single unified `semanticSearch(embedding, filter, limit, threshold)` function utilizing PostgreSQL pgvector cosine distance `1 - (embedding <=> $1::vector)`.
  - Question Embeddings: Question generation fills `questions.embedding` vector(768).
  - Duplicate Detection: Checks candidate question statement against existing questions with threshold 0.90 to flag duplicates before persistence.
  - Similar Question Retrieval: Finds semantically similar questions across concepts (threshold 0.50).
- **Verification (`verify-golden-path.js` Step 12):**
  - Ran semantic duplicate check with high cosine similarity threshold → confirmed duplicate detection operates as specified.

### Phase 10 — Descriptive-Answer Questions (Milestone Spec & Verification)
- **Schema & Database Enhancements:**
  - `questions` table: added `type = 'descriptive'`, `reference_answer` (TEXT, teacher-written), and `reference_answer_embedding` (`vector(768)`).
  - `attempts` table: added `grading_details` (`JSONB`) storing semantic similarity score, verdict, and structured covered/missed breakdown.
  - `learning_evidence` table: added `source` column (`VARCHAR(50) NOT NULL DEFAULT 'deterministic' CHECK (source IN ('deterministic', 'ai_graded_descriptive'))`).
- **AI Model Adapter (`server/ai/modelAdapter.js`):**
  - Added `grade_descriptive_answer(questionStatement, referenceAnswer, studentAnswer)` returning structured `{ verdict: 'correct'|'partial'|'incorrect', covered: [...], missed: [...] }`. Never returns just a number or score.
  - Features local Ollama execution with deterministic heuristic keyword & concept fallback.
- **Grading Flow in `server/routes/attempts.js`:**
  1. Fast first pass: embeds student's answer using `generateEmbedding()` and calculates cosine similarity against `reference_answer_embedding`.
  2. Second pass: calls `grade_descriptive_answer()` to analyze conceptual coverage.
  3. Structured persistence: persists both similarity score and structured covered/missed arrays on the attempt.
  4. Writes to `learning_evidence` with `source = 'ai_graded_descriptive'` (deterministic MCQ/coding stays tagged `source = 'deterministic'`).
- **Trust-Weighted Evidence Aggregation (`server/services/evidenceService.js`):**
  - In `aggregateEvidence(studentId, concept)`, `ai_graded_descriptive` evidence is weighted at `0.6x` compared to deterministic evidence `1.0x`, ensuring AI-graded answers are treated with appropriate trust when calculating gap triggers.
- **UI Integration in Practice Lab:**
  - Full interactive textarea for descriptive explanations; displays verdict badges, similarity metrics, and concrete covered/missed concept lists.
- **Verification (`server/test/verify-phases-10-11.js`):**
  - Submitted comprehensive correct explanation: received `verdict = 'partial'/'correct'`, marks awarded, similarity recorded, and 4 covered key concepts.
  - Submitted unrelated wrong explanation: received `verdict = 'incorrect'`, 0 marks, and missing concept alerts.
  - Verified learning evidence logged as `source = 'ai_graded_descriptive'`.

### Phase 11 — Auto Attendance (Deterministic, No AI)
- **Schema Implementation:**
  - `class_sessions`: `id, teacher_id, title, start_time, end_time, created_at` with window indexing.
  - `attendance`: `id, student_id, session_id, marked_at, source ('assignment_completion'|'assessment_completion'|'video_completion')` with `UNIQUE (student_id, session_id)` constraint.
- **Deterministic Service (`server/services/attendanceService.js`):**
  - `checkAttendance(student_id, timestamp, source)`: Purely deterministic timestamp check against active `class_sessions`. If timestamp falls within the window and no attendance exists yet, records attendance automatically with source. Never marked manually by teacher or directly by student.
  - `getSessionAttendanceRoster(sessionId)`: Generates full class roster with present/absent status, attendance rate percentage, and trigger source.
- **Activity Hooks:**
  - Hooked into `POST /api/attempts` (on assignment/practice completion).
  - Hooked into `POST /api/code-lab/submit` (on coding challenge completion).
- **API Endpoints (`server/routes/attendance.js`):**
  - `POST /api/attendance/sessions`: Teacher creates class session window.
  - `GET /api/attendance/sessions`: Lists sessions with active indicator and attendance counters.
  - `GET /api/attendance/session/:id`: Returns session details with full student roster.
- **UI Integration in Class Insights:**
  - Added dedicated **"Deterministic Auto-Attendance"** tab.
  - Quick 1-hour session creation button.
  - Live session switcher and student roster table showing present/absent badges and deterministic trigger source (`assignment_completion`).
- **Verification (`server/test/verify-phases-10-11.js`):**
  - Created session window `now - 15m` to `now + 45m`.
  - Student submitted assignment during the window → attendance row inserted automatically with source `assignment_completion`.
  - Student submitted second assignment in same window → verified idempotency (0 duplicate attendance rows).
  - Queried `GET /api/attendance/session/:id` → confirmed full roster reflected 50% attendance with exact trigger source.

---

### Golden Path End-to-End Automated Verification Summary
- Automated verification script: `server/test/verify-golden-path.js`
- Test run results:
  ```text
  ====================================================
  🚀 STARTING FULL GOLDEN PATH END-TO-END VERIFICATION
  ====================================================
  Step 0: Registering/logging in users...
  Step 1: Teacher seeds MCQ on Recursion (ID: eea999d9-3c5a-4642-99e7-805c887fc1c6)
  Step 2: AI generates related questions (Job ID: 9088baa3-84e5-40be-8db1-dbd47f3647c5)
  Step 3: Student attempts practice questions; submits 3 weak attempts on Recursion
  Step 4: Checking Student Intelligence for emerging gap (status: emerging, 3 evidence items)
  Step 5: Teacher launches targeted Diagnostic on gap; isolated misconception:
          "Conflating loop counter increment with recursive parameter progression towards base case"
  Step 6: Student takes diagnostic probe attempt -> evidence recorded
  Step 7: Teacher creates targeted Intervention from Intervention Center (Plan ID: e482e2bd-d4e9-4c3b-a54a-8638b95f3fd1)
  Step 8: Student completes intervention practice questions
  Step 9: Administering post-intervention Reassessment -> evaluated is_correct: true
  Step 10: Validating Progress Lab record: 0% baseline (0/4) -> 100% post-intervention (2/2), +100% gain!
           Learning gap status updated to 'resolved' and intervention marked 'completed'.
  Step 11: Testing Secondary Apps:
           - Class Insights aggregated gaps across class
           - Code Lab executed Python code via local runner with stdin and passed test cases
           - Settings loaded and updated user profile
  Step 12: Testing Semantic Layer with pgvector: duplicate detection & similarity confirmed.
  ====================================================
  🏆 GOLDEN PATH FULL LOOP END-TO-END PASSED 100%!
  ====================================================
  ```

---

## Sections 7 & 8 — System Definition & Integrity Check

> **System Statement Verification (Spec Section 8):**
> "React frontend, single Express backend, PostgreSQL as the single source of truth. Student attempts produce traceable learning evidence, aggregated into concept-level learning gaps. Teachers diagnose gaps and create targeted interventions; students are reassessed and new evidence closes the loop. AI is used for bounded tasks — question and diagnostic generation, learning plans, hints — run asynchronously through an in-process queue and streamed over WebSocket. pgvector provides semantic retrieval where useful. AI assists the learning system; it doesn't own the truth."

- [x] **Every feature connects to the learning loop:** Produces evidence, interprets evidence, creates an action, executes an action, or measures an outcome.
- [x] **Zero unvalidated AI output:** All AI generation validated against schema and bounds.
- [x] **Hard caps on generation:** Maximum 20 questions per job.
- [x] **Bounded retries:** 3 retries maximum per queue item.
- [x] **Zero unbacked numeric risk scores:** All gaps, diagnostics, and progress are inspectable concrete evidence lists.

---

## Section 5 — Application Registry Verification (Prompt Spec L189-L200)

The legacy application registry (`TestManagerApp`, `QuestionBankApp`, `ResultsApp`, `AnalyticsApp`, `AdminAnalyticsApp`, `StudentAnalyticsApp`, `TestSessionApp`, `TestSettingsApp`) has been completely replaced with zero leftover legacy app IDs.

All 9 new applications are registered in `app/src/os/apps/registry.ts`, rendered via `app/src/os/WindowManager.tsx`, and state-managed via `app/src/os/store/useOSStore.ts`:

### 👩‍🏫 Teacher Applications
1. **`StudentIntelligenceApp` (`student-intelligence`):** Inspect individual student learning gaps with full chronological evidence trails.
2. **`ClassInsightsApp` (`class-insights`):** Class-wide conceptual heatmap and single-query aggregation of emerging and confirmed gaps.
3. **`DiagnosticLabApp` (`diagnostic-lab`):** Formulate targeted diagnostic probes and misconception isolation blueprints.
4. **`InterventionCenterApp` (`intervention-center`):** Formulate scaffolded remedial plans with assigned practice sets.

### 🎓 Student Applications
5. **`MyLearningApp` (`my-learning`):** Central student cockpit showing active gaps, assigned plans, and current progress.
6. **`PracticeLabApp` (`practice-lab`):** Interactive MCQ practice by concept with deterministic grading and instant evidence feedback.
7. **`CodeLabApp` (`code-lab`):** Algorithmic challenges with Monaco editor, local execution runner, and AI hints.
8. **`ProgressLabApp` (`progress-lab`):** Side-by-side before/after evidence comparison demonstrating measurable learning gains.

### ⚙️ Shared Application
9. **`SettingsApp` (`settings`):** Account profile management, dark/light liquid glass theme toggle, and font scaling.

---

## How to Run the Platform

### 1. Backend Server
```bash
cd /home/krishna/Akademiya/server
node index.js
# Running at http://localhost:5000 (WebSocket at /ws)
```

### 2. Frontend Application
```bash
cd /home/krishna/Akademiya/app
bun run dev --host 0.0.0.0 --port 5173
# Running at http://localhost:5173
```

### 3. Demo Credentials
- **Teacher:** Click "👩‍🏫 Teacher" on the LockScreen or use `teacher.golden@akademiya.io` / `password123`.
- **Student:** Click "🎓 Student" on the LockScreen or use `student.golden@akademiya.io` / `password123`.
