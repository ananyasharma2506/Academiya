# Antigravity Build Instructions — Learning Intelligence Platform

> Read this entire file before writing any code. Do not skip sections.
> This file is your only source of scope. If something is not written
> here or in `MASTER_SPEC.md`, do not build it — ask instead of guessing.

---

## 0. What you have access to

1. `MASTER_SPEC.md` — the product/architecture spec. This is the source
   of truth for **what** to build and **how it behaves**.
2. `/legacy/` — the old TestForge codebase. This is a **parts bin**,
   not a starting skeleton. Most of it is the wrong product (an exam
   proctoring/integrity tool) with the wrong structure (no shared
   services, logic duplicated per-app). Section 4 below tells you
   exactly what to take from it and what to ignore.
3. This file — **how** to sequence the work, what NOT to build, and
   the reuse map.

Do all new work in a fresh top-level structure, e.g. `/app` (frontend)
and `/server` (backend) at the repo root, separate from `/legacy`.
Never edit files inside `/legacy` — only read them for reference or
copy specific named files out of them.

---

## 1. Absolute constraints — do not deviate from these

These are locked decisions. Do not "improve" on them, do not introduce
alternatives, do not ask whether a different tool would be better.

- Backend: **Express** (Node), single process. No FastAPI, no Python
  backend, no microservices.
- Database: **self-hosted PostgreSQL**. No Supabase. No managed
  DB-as-a-service.
- Auth: **roll your own** (JWT + bcrypt or equivalent). No Supabase
  Auth, no third-party auth provider.
- Semantic search: **pgvector** extension inside the same Postgres
  instance. Used only for: similar-question retrieval, duplicate
  detection, resource matching. Not used for anything else.
- Realtime/streaming: **WebSocket**, delivering events only. The
  WebSocket connection never performs generation — it only reports
  job/progress state that already lives in Postgres.
- AI generation concurrency: **in-process bounded async queue** +
  worker(s) inside the same Express process. No Redis, no external
  queue/broker, no distributed workers.
- AI model: local model via a **model adapter** interface
  (`generate_question()`, `generate_diagnostic()`, `generate_plan()`,
  `generate_explanation()`). The backend must not call the model
  directly anywhere outside this adapter.
- Never build: Kubernetes, Kafka, microservices, a Redis cluster, a
  distributed job system, a multi-instance WebSocket architecture, a
  generic API gateway, an observability platform, a six-level Bloom
  analytics engine, a general-purpose chatbot, an opaque numeric
  "risk score" of any kind.

If you think one of these constraints is blocking a feature, stop and
flag it instead of silently working around it.

---

## 2. Core data flow — memorize this, everything hangs off it

```
QUESTION → ATTEMPT → EVALUATION → LEARNING EVIDENCE → CONCEPT-LEVEL SIGNAL
  → LEARNING GAP → (DIAGNOSTIC | INTERVENTION) → PRACTICE → REASSESSMENT
  → NEW EVIDENCE (loops back into LEARNING EVIDENCE)
```

Two layers, kept separate everywhere in the codebase:

- **Deterministic core** (never touched by AI, always trustworthy):
  attempts, evaluation/scoring, evidence aggregation, gap detection,
  progress comparison, code test-case results.
- **AI layer** (bounded, replaceable, always validated before it's
  trusted): question generation, diagnostic generation, learning
  plans, hints/explanations, semantic retrieval.

A "Learning Gap" is always rendered as evidence (a list of concrete
observations with timestamps/counts), never as a single score. If you
catch yourself building a field like `risk_score: number` or
`confidence: 0.87` with nothing backing it, stop — that is the exact
pattern this project explicitly rejects.

---

## 3. Golden path — build this end-to-end before anything else

This is the only thing that must work perfectly. Everything else is
secondary.

```
Teacher seeds MCQs
  → AI generates related questions (streamed via WebSocket, teacher picks count)
  → Teacher reviews & publishes
  → Student attempts questions (Practice Lab)
  → Attempt → Evaluation → Evidence created
  → Evidence aggregates into a Learning Gap
  → Teacher opens Diagnostic Lab → runs a targeted diagnostic on the gap
  → Diagnostic reveals a specific misconception
  → Teacher creates an Intervention (targeted practice / plan) from Intervention Center
  → Student completes the intervention practice
  → Reassessment attempt → new Evidence
  → Progress Lab shows before/after comparison
```

Do not start building secondary apps (Class Insights, Code Lab,
Settings) until this full loop runs, in order, without manual DB
edits, from a clean database.

### Build-depth priority (in order)

🔥 Full, must be excellent: Student Intelligence, Diagnostic Lab,
Intervention Center, Practice Lab, My Learning, Progress Lab,
Question Generation, Streaming, Evidence pipeline.

🟡 Functional, don't over-invest: Class Insights, Code Lab.

🟢 Minimal: Settings (account, light/dark, global font size — nothing
more).

---

## 4. Reuse map for `/legacy`

For every file below, do exactly what its action says. Do not deviate.

### PORT — copy the file, adapt imports/DB calls, keep the logic

| Legacy path | What it is | Adaptation needed |
|---|---|---|
| `server/lib/evaluator.js` | MCQ + debugging evaluation logic | None to the logic itself — this is the deterministic-core evaluation step. Just wire it to the new schema/tables. |
| `server/routes/execute.js` | Multi-tier code execution fallback (Judge0 → local runner → Piston) | **Do not port this file directly — it mixes Supabase queries into the fallback logic.** Reimplement fresh: use this file only to copy the *shape* (try Judge0 → try local runner → try Piston → hard error), and write the DB access (attempt lookup, test_cases lookup) clean against the new Postgres schema from scratch. This is the template for the AI model adapter's fallback too — same rule applies there: copy the shape, not the file. |
| `server/lib/localRunner.js` | Local code execution via `spawn` | Keep, but note it has **no sandboxing** (runs directly on host). Acceptable for hackathon demo scope, but do not silently expand its use beyond Code Lab's defined coding challenges. Flag if asked to run arbitrary/untrusted code elsewhere. |
| Root-level `extractJSON()` function inside `server/routes/ai.js` | Robust JSON extraction from messy LLM text output | Copy this function as a shared utility (e.g. `server/lib/aiOutput.js`). It's a solid building block for the AI Output Trust Model (schema validation step). |
| `client/src/os/Desktop.tsx`, `Dock.tsx`, `WindowManager.tsx`, `MenuBar.tsx`, `LockScreen.tsx`, `AppWindow.tsx` | The OS-style shell (window management via react-rnd, dock, menu bar) | Port directly. This already matches the spec's "OS-style React shell." Only change: the app registry it points to (Section 5 below), not the shell mechanics. |
| `client/src/os/store/useOSStore.ts`, `useOSSettings.ts` | Window state + settings state (zustand) | Port directly, extend with new app IDs as needed. |
| `client/src/os/components/*` (DockIcon, TrafficLights, WindowTitleBar, WindowSwitcher, VSCodeLayout, Terminal, CodingEditorOverlay) | Shared shell UI components | Port directly. |
| Monaco editor integration (`@monaco-editor/react` usage in `CodeEditorApp.tsx`) | Code editor UX | Port the editor setup/config (autocomplete, syntax highlighting, indentation). Rebuild the app logic around it fresh for Code Lab's new challenge model. |

**General rule, applies beyond the table above:** if a file marked PORT
turns out to have Supabase (or any old-stack) calls woven into the
logic you're keeping — not cleanly separable by deleting a few
lines — do not edit that file in place. Reimplement the logic fresh
against the new schema, using the old file only as a reference for
the *shape* of the logic. A weaker model asked to "port and adapt" a
file with two paradigms tangled together tends to produce a half-
converted file with a bug that doesn't surface until runtime. Treat
"port" as meaning pure-logic files only; anything with DB access
mixed in gets rewritten clean, not edited.

### REFERENCE ONLY — look at it for UI/UX patterns, do not copy the code

- `client/src/os/apps/TestManagerApp.tsx`, `QuestionBankApp.tsx`,
  `ResultsApp.tsx`, `AnalyticsApp.tsx`, `AdminAnalyticsApp.tsx`,
  `StudentAnalyticsApp.tsx`, `TestSessionApp.tsx`, `TestSettingsApp.tsx`
  — these are the old product's apps (exam/proctoring tool). Their
  business logic does not map to the new 9-app learning-loop product.
  Look at them only for table/chart/form UI patterns if useful, then
  build the new apps' logic from scratch against the new schema.
- `server/routes/admin.js`, `analytics.js`, `attempts.js`,
  `questions.js`, `tests.js` — same as above: reference for query
  shapes/patterns only, not a source to copy route-for-route. The new
  backend is organized around shared domain services (evidence,
  gap-detection, generation-job-manager), not one file per old app.

### DO NOT USE — do not port, do not reference as a pattern to follow

- `server/lib/auditor.js` — this generates a numeric `suspicion_score`
  (an opaque risk score) via an LLM prompt. This is the exact
  anti-pattern the spec rejects for learning gaps. Do not use this
  file's approach anywhere in the evidence/gap system, even adapted.
- `server/supabase.js` and every `@supabase/supabase-js` call
  throughout the old routes — being replaced by direct Postgres
  access. Do not import the Supabase client into new code.
- `server/routes/ai.js`'s `generate-variants-stream` endpoint as a
  whole (SSE-based, no persisted job state, no retry budget, no
  cancellation) — the *idea* of incremental generation is right, but
  it must be rebuilt as a proper `GenerationJob` behind a WebSocket,
  per Section 24–29 of `MASTER_SPEC.md`. Don't reuse the SSE endpoint
  itself.
- Any file under `.kiro/`, `.agent/`, old `documentation/*.md` in
  `/legacy` — these describe the old product's architecture and will
  actively mislead you about what you're building now. Ignore them.

---

## 5. New application registry (what to actually build)

Teacher: `StudentIntelligenceApp`, `ClassInsightsApp`,
`DiagnosticLabApp`, `InterventionCenterApp`.

Student: `MyLearningApp`, `PracticeLabApp`, `CodeLabApp`,
`ProgressLabApp`.

Shared: `SettingsApp`.

These replace the old app registry entirely. Do not keep old app IDs
around "just in case."

---

## 6. Build order (do these phases strictly in sequence)

For each phase: do every numbered step in order, run the "Verify"
check, and do not start the next phase until that check passes. If a
step references a table/column/endpoint name, use that exact name —
do not invent your own naming.

The table/column names below are a concrete minimum shape to build
against. If `MASTER_SPEC.md` sections 46–47 (Conceptual Data Model)
specify different column names for the same concept, follow the spec
instead — but keep the same tables and the same relationships.

---

### Phase 1 — Schema

1. Create a Postgres database and run `CREATE EXTENSION IF NOT EXISTS vector;`.
2. Create `users`: `id, name, email, password_hash, role (teacher|student), created_at`.
3. Create `assessments`: `id, teacher_id, title, status (draft|published), created_at`.
4. Create `questions`: `id, assessment_id (nullable), concept, subconcept, type (mcq_single|mcq_multi|coding), statement, options (jsonb), correct_option_ids (jsonb), bloom_level, difficulty, source (teacher|ai), embedding (vector), created_at`.
5. Create `attempts`: `id, student_id, question_id, source (practice|assessment|diagnostic|reassessment), selected_option_ids (jsonb, nullable), code (text, nullable), is_correct, marks_awarded, created_at`.
6. Create `learning_evidence`: `id, student_id, concept, subconcept, attempt_id, result (correct|incorrect), created_at`.
7. Create `learning_gaps`: `id, student_id, concept, subconcept, status (emerging|confirmed|resolved), evidence_ids (jsonb array), created_at, updated_at`.
8. Create `diagnostics`: `id, gap_id, blueprint (jsonb), created_at`.
9. Create `diagnostic_attempts`: `id, diagnostic_id, student_id, question_id, is_correct, created_at`.
10. Create `interventions`: `id, gap_id, plan (jsonb), target_concept, status, created_at`.
11. Create `reassessments`: `id, intervention_id, student_id, attempt_id, created_at`.
12. Create `progress`: `id, student_id, concept, before_evidence_ids (jsonb), after_evidence_ids (jsonb), delta, created_at`.
13. Create `generation_jobs`: `id, teacher_id, requested_count, generated_count, status (running|completed|cancelled|failed), retry_budget_used, created_at, updated_at`.
14. Create `generated_questions`: `id, job_id, question_id (nullable, set once persisted), status (pending|validated|failed), attempt_no, created_at`.
15. Do not add any table not listed here without checking `MASTER_SPEC.md` first.

**Verify:** all 14 tables exist, `\d questions` in psql shows an
`embedding vector` column, no errors on `CREATE EXTENSION vector`.

---

### Phase 2 — Auth + deterministic core

1. Build `POST /api/auth/register` and `POST /api/auth/login` — bcrypt-hash
   passwords, issue a JWT containing `{ id, role }`.
2. Build an `requireAuth` middleware that verifies the JWT and attaches
   `req.user`.
3. Port `evaluator.js` unchanged into `server/lib/evaluator.js`.
4. Build `POST /api/questions/seed` — teacher submits an MCQ (concept,
   subconcept, statement, options, correct_option_ids) → inserted into
   `questions` with `source = 'teacher'`.
5. Build `POST /api/attempts` — student submits an answer to a
   `question_id` → call `evaluator.js` → insert into `attempts` → then
   insert one row into `learning_evidence` (`result = 'correct'` or
   `'incorrect'`, copying `concept`/`subconcept` from the question).
6. No AI anywhere in this phase.

**Verify:** seed one MCQ via the endpoint, submit a wrong answer as a
student, confirm by direct query that exactly one new row exists in
`attempts` and exactly one new row exists in `learning_evidence` with
`result = 'incorrect'`.

---

### Phase 3 — Evidence aggregation + gap detection

1. Write a function `aggregateEvidence(student_id, concept)` that reads
   all `learning_evidence` rows for that student+concept, weighted so
   more recent rows count more (e.g. exponential decay by `created_at`
   age, or a simple "last N attempts" window — pick one, document which
   one you used at the top of the file).
2. Write `detectGap(student_id, concept)`: if the weighted incorrect
   ratio crosses a threshold (pick a number, e.g. ≥60% incorrect over
   the last 3+ attempts) and no open gap already exists for that
   student+concept, insert a row into `learning_gaps` with
   `status = 'emerging'` and `evidence_ids` set to the evidence rows
   that triggered it.
3. Call `detectGap` automatically every time a new `learning_evidence`
   row is inserted (hook it into the end of the Phase 2 attempt
   endpoint).
4. Build `GET /api/gaps/:student_id` — returns each gap with its full
   evidence list expanded (not just IDs) so the UI can render evidence,
   never a bare score.
5. Do not add any numeric "confidence" or "risk" field to `learning_gaps`
   beyond `status`. If you're tempted to add one, re-read Section 2.

**Verify:** submit 3 wrong attempts on the same concept for one student
→ query `GET /api/gaps/:student_id` → confirm exactly one gap row
comes back with 3 evidence entries visible in the response body.

---

### Phase 4 — AI model adapter + generation job pipeline

1. Build `server/ai/modelAdapter.js` exporting `generateQuestion()`,
   `generateDiagnostic()`, `generatePlan()`, `generateExplanation()`.
   Each function internally tries the local model first, then falls
   back to the pre-generated validated pool (see step 8) on
   timeout/failure — same try-then-fallback *shape* as the old
   `execute.js`, written fresh (see Section 4's general rule).
2. Build the question blueprint step: before generation, construct
   `{ concept, subconcept, type, bloom_level, difficulty, constraints }`
   from the teacher's request — this object is what gets passed to
   `generateQuestion()`, never a raw free-text prompt straight from the
   teacher.
3. Build `POST /api/generation-jobs` — teacher sends
   `{ concept, subconcept, requested_count }` (hard cap this, e.g. max
   20) → insert a row into `generation_jobs` with `status = 'running'`
   → return the `job_id` immediately (do not block the HTTP response
   on generation finishing).
4. Build the in-process bounded queue: a worker loop that pulls pending
   generation items, calls `modelAdapter.generateQuestion()`, validates
   the result (valid schema, exactly one correct option for
   `mcq_single`, concept/Bloom alignment) — on invalid output, retry up
   to a fixed bound (e.g. 3 attempts) then mark that item `failed` and
   move on, never loop indefinitely.
5. On each successful item: insert into `questions` (`source = 'ai'`),
   insert into `generated_questions` linking it to the job, increment
   `generation_jobs.generated_count`.
6. Build a WebSocket endpoint. On connect, client sends
   `{ subscribe: job_id }`. Server emits, per item processed:
   `generation.started`, `generation.progress`, `question.generated`,
   `question.failed`, and on completion `generation.completed`
   (or `generation.cancelled` if cancelled).
7. Build `POST /api/generation-jobs/:id/cancel` — sets
   `status = 'cancelled'`, worker checks this flag before processing
   each remaining item and stops.
8. Build the demo fallback pool: a small set of pre-written, already-
   validated questions per concept, stored the same way generated
   questions are stored, used automatically by `modelAdapter` when the
   local model is unavailable — routed through the exact same
   validate → persist → stream path as real generations, not a
   separate code branch in the UI.
9. Build `GET /api/generation-jobs/:id` — returns current job state, so
   a client that reconnects after a refresh can resync instead of
   losing the job.

**Verify:** request 10 questions → confirm questions appear one at a
time over the WebSocket, not all at once → refresh the browser mid-job
and confirm `GET /api/generation-jobs/:id` still shows correct
progress → click cancel and confirm no further questions are generated
after that point → kill/disconnect the local model and confirm
generation still completes via the fallback pool without a visible
error to the teacher.

---

### Phase 5 — Practice Lab + Student Intelligence (golden path core)

1. Build `GET /api/practice/:student_id` — returns published teacher
   questions + AI-generated questions available to that student.
2. Build the Practice Lab UI app: student answers a question → calls
   the Phase 2 attempt endpoint (`source = 'practice'`).
3. Build the Student Intelligence UI app: teacher picks a student →
   calls `GET /api/gaps/:student_id` from Phase 3 → renders each gap as
   evidence text, exactly matching the format in Section 1.2 of
   `MASTER_SPEC.md` ("Emerging difficulty / Recursion termination /
   Evidence: • 3 recent weak attempts ..."), never a percentage or
   score.

**Verify:** as a student, answer questions until a gap forms; switch to
the teacher view of that student and confirm the gap and its evidence
render correctly with no manual DB steps in between.

---

### Phase 6 — Diagnostic Lab + Intervention Center

1. Build `POST /api/diagnostics` — teacher selects a `gap_id` → build a
   diagnostic blueprint from the gap's concept/subconcept → call
   `modelAdapter.generateDiagnostic()` → insert into `diagnostics`,
   generate its targeted questions the same way Phase 4 generates
   practice questions (reuse that pipeline, don't build a second one).
2. Build the student-facing diagnostic attempt flow →
   `diagnostic_attempts` rows → these also feed back into
   `learning_evidence` (same insert path as Phase 2, tagged with the
   diagnostic source) so the gap's evidence sharpens rather than a
   second, disconnected evidence trail being created.
3. Build `POST /api/interventions` — teacher selects a `gap_id`
   (typically after a diagnostic has narrowed it) → call
   `modelAdapter.generatePlan()` → insert into `interventions` with a
   `plan` (targeted practice question set + description) and
   `status = 'active'`.
4. Build the student-facing intervention practice flow — same attempt
   pipeline as Practice Lab, tagged so it's traceable to the
   intervention.

**Verify:** run the full chain — gap exists → diagnostic launched →
student completes it → misconception visible in the diagnostic's
evidence → intervention created from that same gap → student completes
intervention practice — with no step requiring you to manually touch
the database.

---

### Phase 7 — Reassessment + Progress Lab

1. Build `POST /api/reassessments` — after an intervention's practice
   is complete, generate/administer a reassessment attempt on the same
   concept → insert into `reassessments`, linking the new
   `attempt_id` and the `intervention_id`.
2. On reassessment attempt, evidence is written the normal way (Phase
   2's path), then compare the evidence set from before the
   intervention to the evidence set after it → insert into `progress`
   with both evidence-ID sets and a `delta` (e.g. accuracy before vs.
   after, not a mysterious single number — show the two raw figures).
3. Build the Progress Lab UI: render before/after evidence and the
   delta for a given student+concept.

**Verify:** complete the full golden path from Section 3 start to
finish once, end to end, without any manual database intervention, and
confirm Progress Lab shows a real before/after comparison at the end.

---

### Phase 8 — Secondary apps (🟡/🟢 depth — functional, not polished)

1. **My Learning:** student home screen — pull the student's current
   gaps (Phase 3), assigned interventions (Phase 6), and recent
   progress (Phase 7) into one summary view. No new backend logic —
   this app only reads from endpoints that already exist.
2. **Class Insights:** teacher view — aggregate `learning_gaps` across
   all students in a class by concept (e.g. "12 students showing
   emerging difficulty in Recursion"). One aggregation query over the
   existing `learning_gaps` table — do not build a second
   analytics/intelligence pipeline for this.
3. **Code Lab:** define a `coding_challenges` table (concept,
   subconcept, expected_behaviour, test_cases jsonb, diagnostic_tags).
   Port the Monaco editor setup. Port `localRunner.js` for execution
   (documented lack of sandboxing still applies — do not expand its use
   beyond this app). Test results map directly to
   `learning_evidence` the same way MCQ attempts do. AI
   (`generateExplanation()`) may explain a failure; it never decides
   pass/fail — that's always the deterministic test-case result.
4. **Settings:** account info, light/dark theme toggle, global font-size
   selector. Nothing beyond what's listed in Section 7.4 of
   `MASTER_SPEC.md`.

**Verify:** each app loads and performs its one stated job using only
endpoints built in earlier phases (plus the one new Code Lab table).

---

### Phase 9 — Semantic layer

1. Add an embedding-generation step (via the model adapter) that fills
   `questions.embedding` whenever a question is created or published.
2. Build one shared function `semanticSearch(embedding, filter)` that
   does a pgvector similarity query — this is the single semantic
   retrieval capability.
3. Similar-question retrieval: call `semanticSearch` filtered by
   concept, used when generating new questions for context.
4. Duplicate detection: call `semanticSearch` with a high similarity
   threshold before persisting a newly generated question; flag
   near-duplicates instead of persisting them.
5. Resource matching (if built): call `semanticSearch` against a
   separate `resources` table with its own `embedding` column.
6. Do not create three separate services/files for these three uses —
   one `semanticSearch` function, three call sites.

**Verify:** generate a question near-identical to an existing one and
confirm it's flagged as a duplicate rather than silently persisted.

---

## 7. Rules to re-check before every phase

- Does this feature produce evidence, interpret evidence, create an
  action, execute an action, or measure an outcome? If not, question
  whether it belongs in this phase at all.
- Is AI output going straight into something a teacher/student trusts
  as fact? If yes, it must pass through validation and (where it's a
  graded/evidence-producing step) not silently replace deterministic
  evaluation.
- Did a generation request get an explicit count and a hard maximum?
- Does every AI generation attempt have a bounded retry count, not an
  open-ended retry loop?
- Is any new numeric field being added that isn't backed by visible,
  inspectable evidence? If yes, stop and reconsider it.

---

## 8. What "done" looks like for this build

You can explain the whole system in this paragraph and it's true of
what you built:

> "React frontend, single Express backend, PostgreSQL as the single
> source of truth. Student attempts produce traceable learning
> evidence, aggregated into concept-level learning gaps. Teachers
> diagnose gaps and create targeted interventions; students are
> reassessed and new evidence closes the loop. AI is used for bounded
> tasks — question and diagnostic generation, learning plans, hints —
> run asynchronously through an in-process queue and streamed over
> WebSocket. pgvector provides semantic retrieval where useful. AI
> assists the learning system; it doesn't own the truth."

If any part of that sentence isn't true of the actual codebase, the
build isn't done yet — go fix that part before adding anything new.
