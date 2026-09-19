# Learning Intelligence Platform

## Product, UI/UX, System Design & Engineering Specification

> **WORK IN PROGRESS --- SINGLE HACKATHON BUILD**
>
> Nothing in this document is presented as a frozen implementation
> contract. The product scope, user experience, engineering principles,
> and behavioural contracts are defined together for the current
> hackathon build. Implementation details may evolve when development
> reveals a better solution.
>
> **Important:** This is **not** a V2/V3/V4 roadmap. There is one
> product and one implementation effort. The implementation order below
> is only dependency/order-of-work guidance.

------------------------------------------------------------------------

# 0. Executive Summary

The Learning Intelligence Platform is an AI-assisted learning and
assessment system built around a single continuous learning loop:

**Assess → Observe → Diagnose → Act → Reassess → Improve**

The core problem is not simply generating questions. The system must
turn ordinary learning activity into useful, traceable evidence about
where a student is struggling, help identify the likely underlying
concept or misconception, convert that evidence into a targeted learning
action, and then determine whether the action actually helped.

The platform therefore connects:

-   teacher-created and AI-generated MCQs,
-   student practice and assessment,
-   evidence collection,
-   concept-level learning signals,
-   candidate learning gaps,
-   targeted diagnostics,
-   AI-generated learning plans,
-   intervention activities,
-   coding diagnostics where appropriate,
-   reassessment,
-   measurable progress.

AI is deliberately bounded into explicit capabilities rather than
exposed as one giant chatbot.

The OS-style interface is a **navigation and interaction shell**, not
the product's innovation.

------------------------------------------------------------------------

# 1. Product Principles

## 1.1 The learning loop is the product

``` mermaid
flowchart TD
    A[Assess] --> B[Observe]
    B --> C[Diagnose]
    C --> D[Act]
    D --> E[Reassess]
    E --> F[Improve]
    F --> B
```

Every major feature should either:

1.  produce learning evidence,
2.  interpret existing evidence,
3.  create a learning action,
4.  execute an action,
5.  or measure its outcome.

Features that cannot connect to this loop should be questioned.

------------------------------------------------------------------------

## 1.2 Evidence before opaque scores

Do not expose an unexplained number such as:

``` text
Risk Score: 87
```

Prefer:

``` text
Emerging difficulty
Recursion termination

Evidence
• 3 recent weak attempts
• repeated base-case errors
• weak performance on application questions
• diagnostic evidence still pending
```

A learning gap is an **evidence-backed candidate for attention**, not an
unquestionable diagnosis.

------------------------------------------------------------------------

## 1.3 AI is a bounded capability

AI capabilities are explicit:

``` text
AI Layer
├── Question Generation
├── Question Variation
├── Learning Plan Generation
├── Diagnostic Generation
├── Hints / Explanations
└── Semantic Retrieval
```

There is intentionally no product-defining "Ask the AI anything" layer.

------------------------------------------------------------------------

## 1.4 Reuse proven functionality, refactor broken structure

The existing TestForge codebase is treated as a source of proven
components, not as the architecture of the new product.

### Preserve strongly

-   browser coding environment,
-   editor UX,
-   autocomplete,
-   syntax highlighting,
-   auto-indentation,
-   execution/output behaviour,
-   useful assessment primitives where clean.

### Rework heavily

-   application boundaries,
-   business logic,
-   data flow,
-   analytics,
-   AI integration,
-   question generation,
-   evidence model,
-   navigation,
-   database layer,
-   Supabase dependency.

The principle is:

> **Reuse proven functionality. Refactor broken architecture.**

------------------------------------------------------------------------

# 2. Product Architecture at a Glance

``` mermaid
flowchart TD
    UI[OS-Style React Shell]

    UI --> T[Teacher Apps]
    UI --> S[Student Apps]
    UI --> SET[Settings]

    T --> LOOP[Core Learning Loop]
    S --> LOOP

    LOOP --> ASSESS[Assessment]
    LOOP --> EVID[Learning Evidence]
    LOOP --> ACTION[Learning Actions]

    ASSESS --> PG[(PostgreSQL)]
    EVID --> PG
    ACTION --> PG

    PG --> AI[AI Capability Layer]
    PG --> CODE[Code Lab]
    PG --> SEM[Semantic Retrieval / pgvector]

    AI --> GEN[Generate]
    AI --> PLAN[Plan]
    AI --> DIAG[Diagnose]
```

### Architectural rule

The nine OS applications are **not nine independent systems**.

They are different views and actions over shared learning data and
shared domain logic.

------------------------------------------------------------------------

# 3. Application Map

## Teacher

1.  **Student Intelligence**
2.  **Class Insights**
3.  **Diagnostic Lab**
4.  **Intervention Center**

## Student

5.  **My Learning**
6.  **Practice Lab**
7.  **Code Lab**
8.  **Progress Lab**

## Shared

9.  **Settings**

These are OS-style applications/views, not necessarily separately
deployed applications.

------------------------------------------------------------------------

# 4. Shared Learning Data Flow

``` mermaid
flowchart LR
    Q[Question / Activity]
    A[Student Attempt]
    EV[Evaluation]
    LE[Learning Evidence]
    CS[Concept-Level Signal]
    GAP[Candidate Learning Gap]
    ACT[Teacher / Student Action]
    DIAG[Targeted Practice / Diagnostic]
    RE[Reassessment]
    NEW[New Evidence]

    Q --> A --> EV --> LE --> CS --> GAP --> ACT --> DIAG --> RE --> NEW
    NEW --> LE
```

This is the single backbone of the product.

------------------------------------------------------------------------

# 5. User Roles

## 5.1 Teacher

The teacher needs to:

-   create learning sessions,
-   provide seed questions,
-   generate bounded AI question variants,
-   review generated content,
-   publish questions,
-   inspect student evidence,
-   inspect class-level patterns,
-   launch diagnostics,
-   create interventions,
-   review/edit AI learning plans,
-   assign targeted activities,
-   inspect reassessment outcomes.

## 5.2 Student

The student needs to:

-   see assigned learning work,
-   understand current focus areas,
-   practice MCQs,
-   receive permitted hints/explanations,
-   complete diagnostics,
-   complete coding challenges,
-   see progress,
-   complete intervention activities,
-   complete reassessments.

------------------------------------------------------------------------

# 6. UX Architecture

## 6.1 OS shell

The shell provides:

-   app launcher/navigation,
-   current application context,
-   user/account access,
-   theme,
-   global font-size,
-   consistent window/panel behaviour,
-   persistent contextual navigation where useful.

The shell must not become a gimmick.

### UX principle

**The user should always know:**

1.  Where am I?
2.  What am I looking at?
3.  Why does this information matter?
4.  What can I do next?

------------------------------------------------------------------------

# 7. Global UI Requirements

## 7.1 Visual language

The UI should be:

-   modern,
-   information-focused,
-   clean,
-   consistent,
-   responsive,
-   accessible,
-   recognisably product-specific.

The old OS-style identity may remain, but screens should not be copied
mechanically.

### Design rule

**Less decorative UI, more useful interaction.**

------------------------------------------------------------------------

## 7.2 Typography

Typography must:

-   remain readable at all supported sizes,
-   use a consistent type hierarchy,
-   avoid excessive font weights,
-   preserve code readability in Code Lab,
-   support global font-size selection.

Global font-size setting affects the entire application.

------------------------------------------------------------------------

## 7.3 Theme

Supported:

-   Light
-   Dark

Components must remain legible in both.

------------------------------------------------------------------------

## 7.4 Global font size

Settings exposes a global font-size selection.

Changing it must update:

-   navigation,
-   cards,
-   tables,
-   forms,
-   buttons,
-   question UI,
-   diagnostics,
-   Code Lab surrounding UI,
-   progress views.

The code editor may retain its own practical code-font sizing if
necessary for usability, while the application chrome follows the global
setting.

------------------------------------------------------------------------

# 8. Shared UI Component System

The product should have reusable components rather than one-off styling
per screen.

## Core components

``` text
AppShell
AppLauncher
Window / Panel
PageHeader
Breadcrumb / ContextBar
PrimaryAction
SecondaryAction
EmptyState
LoadingState
ErrorState
ConfirmationDialog
Toast / StatusMessage
FilterBar
Search
Tabs
Modal
Drawer
DataTable
Card
ProgressIndicator
Timeline
```

## Product-specific components

``` text
LearningGapCard
EvidencePanel
EvidenceTimeline
ConceptStatus
ConceptHeatmap
StudentCard
QuestionReviewCard
QuestionBlueprintEditor
CountControl
BloomDistributionControl
StreamingGenerationPanel
GenerationProgress
GenerationItem
DiagnosticBuilder
LearningPlanBuilder
InterventionTimeline
ProgressComparison
AIStatusIndicator
ResourceMatchCard
```

------------------------------------------------------------------------

# 9. UI State Requirements

Every major screen must explicitly design:

``` text
Loading
Empty
Populated
Partial
Error
Disabled
Permission-restricted
Generating
Cancelled
Completed
```

Do not design only the happy path.

------------------------------------------------------------------------

# 10. Teacher App --- Student Intelligence

## Goal

Answer:

> **Who needs attention, what are they struggling with, and what
> evidence supports that?**

## UI

``` text
┌────────────────────────────────────────────────────┐
│ Student Intelligence                 Search / Filter│
├────────────────────────────────────────────────────┤
│                                                    │
│ Student Card                                       │
│ ┌──────────────────────────────────────────────┐   │
│ │ Student Name                                  │   │
│ │ Recent activity                               │   │
│ │ Focus area: Recursion termination             │   │
│ │                                               │   │
│ │ Evidence: 3 recent weak attempts              │   │
│ │           repeated base-case errors            │   │
│ │                                               │   │
│ │ [View Evidence] [Diagnose] [Intervene]        │   │
│ └──────────────────────────────────────────────┘   │
│                                                    │
└────────────────────────────────────────────────────┘
```

## Requirements

-   student search,
-   class/section filtering,
-   recent activity,
-   assessment history,
-   practice history,
-   concept performance,
-   learning gaps,
-   evidence trail,
-   diagnostic history,
-   intervention history,
-   reassessment history,
-   direct actions.

## UX rule

The teacher should reach the underlying evidence in one or two
interactions.

Do not hide the reason behind a chart.

------------------------------------------------------------------------

# 11. Teacher App --- Class Insights

## Goal

Answer:

> **What is happening across the whole class?**

## UI

``` text
┌────────────────────────────────────────────────────┐
│ Class Insights                                     │
├────────────────────────────────────────────────────┤
│ Class Health                                       │
│                                                    │
│ Concept Heatmap                                    │
│ ┌──────┬──────┬──────┬──────┐                     │
│ │Arrays│Recurs│Trees │Graphs│                     │
│ │  ●   │  ●   │  ●   │  ●   │                     │
│ └──────┴──────┴──────┴──────┘                     │
│                                                    │
│ Common Learning Gaps                               │
│ ┌──────────────────────────────────────────────┐   │
│ │ Recursion termination — affected students    │   │
│ │ [View Students] [Create Diagnostic]           │   │
│ └──────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

## Requirements

-   class-level topic health,
-   concept-level patterns,
-   common gaps,
-   affected students,
-   trends,
-   optional Bloom distribution,
-   diagnostic launch,
-   targeted class practice.

## Architectural rule

Class Insights uses the same evidence model as Student Intelligence.

There is **one intelligence pipeline**, not two.

------------------------------------------------------------------------

# 12. Teacher App --- Diagnostic Lab

## Goal

Answer:

> **What specific misconception or weak concept is behind this learning
> gap?**

Diagnostic Lab starts from an existing learning gap.

## Flow

``` mermaid
flowchart TD
    GAP[Learning Gap] --> CONFIG[Diagnostic Configuration]
    CONFIG --> GEN[Generate Diagnostic]
    GEN --> VAL[Validate]
    VAL --> STREAM[Stream Results]
    STREAM --> REVIEW[Teacher Review]
    REVIEW --> ASSIGN[Assign]
    ASSIGN --> ATTEMPT[Student Attempts]
    ATTEMPT --> EVID[New Evidence]
```

## Possible diagnostic forms

-   conceptual MCQ,
-   trace/predict question,
-   debugging question,
-   coding challenge,
-   mixed diagnostic.

The exact diagnostic mix remains implementation-flexible.

## UI requirements

-   student/class selector,
-   target concept selector,
-   evidence preview,
-   diagnostic type selector,
-   bounded question count,
-   generation progress,
-   question review,
-   assignment controls,
-   diagnostic results,
-   evidence trace.

------------------------------------------------------------------------

# 13. Teacher App --- Intervention Center

## Goal

Turn a learning gap into an actionable learning activity.

Diagnostic asks **why**.

Intervention asks **what should happen next**.

Both operate on the same underlying gap/evidence workflow.

## Example learning plan

``` text
Goal
Understand recursion termination

1. Concept explanation
2. Basic practice
3. Apply-level MCQs
4. Targeted coding task
5. Reassessment
```

## UI

``` text
┌────────────────────────────────────────────────────┐
│ Intervention                                      │
├────────────────────────────────────────────────────┤
│ Target                                             │
│ Recursion termination                              │
│                                                    │
│ Evidence                                           │
│ • 3 recent weak attempts                           │
│ • repeated base-case errors                        │
│                                                    │
│ Proposed Plan                                      │
│ ┌──────────────────────────────────────────────┐   │
│ │ 1. Explanation                               │   │
│ │ 2. Basic MCQs                                │   │
│ │ 3. Apply questions                           │   │
│ │ 4. Coding task                               │   │
│ │ 5. Reassessment                              │   │
│ └──────────────────────────────────────────────┘   │
│                                                    │
│ [Edit Plan] [Assign]                              │
└────────────────────────────────────────────────────┘
```

Teacher can review/edit before assignment.

------------------------------------------------------------------------

# 14. Student App --- My Learning

## Goal

Answer:

> **Where am I, what needs work, and what should I do next?**

## Requirements

-   active learning plan,
-   strong areas,
-   focus areas,
-   assignments,
-   active interventions,
-   recent activity,
-   next recommended action.

## UX rule

Student view should be actionable, not analytics-heavy.

Instead of:

``` text
17 charts
12 scores
8 percentages
```

prefer:

``` text
Your current focus
Recursion termination

Why?
You have struggled with base cases in recent attempts.

Next
→ Complete 5 targeted questions
```

------------------------------------------------------------------------

# 15. Student App --- Practice Lab

## Goal

Provide targeted MCQ practice.

## Question sources

``` text
Teacher-published
      +
Teacher-approved AI variants
      +
Bounded AI-generated additional practice
```

## Flow

``` mermaid
flowchart TD
    POOL[Available Question Pool] --> CHECK{Enough Questions?}
    CHECK -->|Yes| PRACTICE[Start Practice]
    CHECK -->|No| COUNT[Choose / Confirm N]
    COUNT --> GEN[Generate N]
    GEN --> VAL[Validate]
    VAL --> STREAM[Stream]
    STREAM --> PRACTICE
```

## Requirements

-   teacher-published questions,
-   teacher-approved generated variants,
-   bounded AI generation,
-   explicit question count,
-   concept targeting where allowed,
-   Bloom targeting where useful,
-   difficulty,
-   progress,
-   hints/explanations.

Teacher-approved questions should be reused where possible rather than
regenerating equivalent material.

------------------------------------------------------------------------

# 16. Student App --- Code Lab

## Goal

Retain the strongest programming experience from TestForge.

The browser coding environment is a quality-of-life feature for defined
programming practice and diagnostics.

## Required editor features

-   syntax highlighting,
-   autocomplete / IntelliSense-like suggestions,
-   auto-indentation,
-   bracket matching,
-   error highlighting,
-   line numbers,
-   tabs,
-   multiple files where required,
-   run,
-   compile,
-   output,
-   terminal/output panel,
-   language selection,
-   resizable editor/output,
-   keyboard shortcuts.

## Code diagnostic architecture

``` mermaid
flowchart TD
    C[Challenge Metadata] --> CODE[Student Code]
    CODE --> RUN[Compile / Execute]
    RUN --> TEST[Test Cases]
    TEST --> RESULT[Concrete Result]
    RESULT --> SIGNAL[Diagnostic Signals]
    SIGNAL --> EVID[Learning Evidence]
```

## Challenge metadata

``` text
Challenge
├── Concept
├── Sub-concept
├── Expected behaviour
├── Test cases
└── Diagnostic tags
```

## Evidence sources

-   compilation failure,
-   test-case failure,
-   output mismatch,
-   defined diagnostic condition,
-   known error pattern.

An LLM may help explain or classify a signal, but unrestricted LLM
interpretation must not be the sole source of learning evidence.

------------------------------------------------------------------------

# 17. Student App --- Progress Lab

## Goal

Answer:

> **Did the learning action actually help?**

## Flow

``` mermaid
flowchart TD
    BASE[Baseline Evidence] --> INT[Intervention]
    INT --> PRACTICE[Targeted Practice]
    PRACTICE --> RE[Reassessment]
    RE --> NEW[New Evidence]
    BASE --> COMP[Comparison]
    NEW --> COMP
    COMP --> PROG[Progress]
```

## UI requirements

-   before/after concept performance,
-   reassessment result,
-   concept progress,
-   completed interventions,
-   remaining focus areas,
-   learning history,
-   limited Bloom information where useful.

Do not imply causal certainty from a simple before/after comparison.
Present the evidence and context.

------------------------------------------------------------------------

# 18. Settings App

Settings intentionally remains small.

## Account

-   name,
-   login/account information,
-   change password,
-   logout.

## Appearance

-   light,
-   dark.

## Global UI

-   font-size selection.

No oversized preference system.

------------------------------------------------------------------------

# 19. AI Question Generation

Question generation is a core workflow.

## Teacher flow

``` mermaid
flowchart TD
    SESSION[Create Learning Session]
    SESSION --> TOPIC[Add Topic]
    TOPIC --> SEED[Add Seed MCQs]
    SEED --> ANALYZE[Analyze Seeds]
    ANALYZE --> BLUEPRINT[Create Blueprint]
    BLUEPRINT --> COUNT[Choose Count]
    COUNT --> BLOOM[Optional Bloom Distribution]
    BLOOM --> GENERATE[Generate]
    GENERATE --> VALIDATE[Validate]
    VALIDATE --> STREAM[Stream]
    STREAM --> REVIEW[Teacher Review]
    REVIEW --> PUBLISH[Publish]
```

## Question blueprint

``` text
Question Blueprint
├── Concept
├── Sub-concept
├── Question type
├── Bloom target
├── Difficulty
├── Constraints
├── Expected knowledge
└── Correct answer
```

The blueprint is the contract that prevents topic drift.

------------------------------------------------------------------------

# 20. Bloom Taxonomy

Bloom is useful, but it is not the backbone of the intelligence engine.

## Levels

-   Remember
-   Understand
-   Apply
-   Analyze
-   Evaluate
-   Create

## Primary use

Question generation targeting.

Example:

``` text
Generate 20 questions

Remember    4
Understand  4
Apply       6
Analyze     4
Evaluate    2
```

## Secondary use

Bloom metadata can appear in:

-   question review,
-   performance views,
-   diagnostics,
-   progress.

It should not determine the student's entire intelligence profile.

Bloom classification is interpretive metadata and should therefore be
treated as a signal rather than absolute truth.

------------------------------------------------------------------------

# 21. Streaming Generation --- Core UX Contract

## Bad UX

``` text
Generate 20
     ↓
Wait
     ↓
Show 20
```

## Required UX

``` text
Generate 20

Q1 ✓ → UI
Q2 ✓ → UI
Q3 ✓ → UI
Q4 ✓ → UI
...
```

The user should be able to inspect useful results while generation
continues.

------------------------------------------------------------------------

# 22. Mandatory Generation Controls

Every generation operation must have an explicit count.

Example:

``` text
Questions to generate

[-] 20 [+]

[Generate]
```

No generation action may silently mean "generate as much as needed."

## Required constraints

-   explicit count,
-   hard maximum,
-   backend enforcement,
-   cancellation,
-   incremental persistence,
-   progress,
-   bounded retries,
-   retry individual failed item,
-   generate more after completion.

This is both a UX and compute-control requirement.

------------------------------------------------------------------------

# 23. Streaming Generation UX States

``` text
Before
────────────────
Questions: 20
[ Generate ]


Running
────────────────
✓ Q01
✓ Q02
✓ Q03
⟳ Q04
○ Q05
○ Q06

3 / 20 generated

[ Stop Generation ]


Completed
────────────────
✓ 20 / 20 generated

[Review Questions]
[Generate More]


Partial / Cancelled
────────────────
✓ 8 / 20 generated
Generation stopped.

[Review 8]
[Generate Remaining]


Failed Item
────────────────
Q04 failed validation.

[Retry Q04]
```

------------------------------------------------------------------------

# 24. Real-Time Generation Architecture

The streaming path is not a generic API gateway problem.

It is a job-oriented real-time system.

``` mermaid
flowchart TD
    CLIENT[React Client]
    WS[WebSocket Session]
    MANAGER[WebSocket Connection Manager]
    JOB[Generation Job]
    QUEUE[Generation Queue]
    WORKER[AI Worker]
    VALIDATE[Validation]
    DB[(PostgreSQL)]
    EVENTS[Realtime Events]

    CLIENT -->|start_generation| WS
    WS --> MANAGER
    MANAGER --> JOB
    JOB --> QUEUE
    QUEUE --> WORKER
    WORKER --> VALIDATE

    VALIDATE -->|pass| DB
    VALIDATE -->|bounded failure| QUEUE

    DB --> EVENTS
    VALIDATE --> EVENTS
    EVENTS --> MANAGER
    MANAGER --> WS
    WS --> CLIENT
```

------------------------------------------------------------------------

# 25. Why WebSocket?

The generation experience requires bidirectional, real-time
communication.

The client must be able to:

-   start a job,
-   receive progress,
-   receive generated items,
-   receive failures,
-   cancel generation,
-   retry individual items,
-   receive completion state.

A request/response-only model would make this interaction unnecessarily
awkward.

WebSocket therefore represents the **real-time control and event
channel**.

------------------------------------------------------------------------

# 26. WebSocket Reliability Requirements

The real-time layer should not be treated as "just open a socket."

Required behaviour:

-   authenticated connection,
-   reconnect support,
-   heartbeat/ping-pong,
-   connection lifecycle tracking,
-   event IDs,
-   job IDs,
-   acknowledgement where required,
-   duplicate-event tolerance,
-   resynchronisation after reconnect,
-   server-side authorization,
-   clean cancellation semantics.

A reconnect must not cause the client to lose already-persisted results.

------------------------------------------------------------------------

# 27. WebSocket Event Contract

Conceptual event envelope:

``` json
{
  "event_id": "evt_123",
  "event": "question.generated",
  "job_id": "job_456",
  "sequence": 7,
  "timestamp": "2026-09-17T12:00:00Z",
  "payload": {}
}
```

## Events

``` text
generation.started
generation.progress
question.generated
question.failed
generation.cancelled
generation.completed
generation.error
```

## Example

``` json
{
  "event": "generation.progress",
  "job_id": "job_456",
  "sequence": 8,
  "payload": {
    "requested": 20,
    "generated": 7,
    "failed": 1,
    "remaining": 12
  }
}
```

------------------------------------------------------------------------

# 28. Generation Job State Machine

``` mermaid
stateDiagram-v2
    [*] --> QUEUED
    QUEUED --> RUNNING
    RUNNING --> VALIDATING
    VALIDATING --> PERSISTING
    PERSISTING --> RUNNING
    VALIDATING --> RETRYING
    RETRYING --> RUNNING
    RUNNING --> CANCELLING
    CANCELLING --> CANCELLED
    RUNNING --> COMPLETED
    RUNNING --> FAILED
    VALIDATING --> FAILED
    PERSISTING --> FAILED
    COMPLETED --> [*]
    CANCELLED --> [*]
    FAILED --> [*]
```

------------------------------------------------------------------------

# 29. GenerationJob Contract

Conceptual fields:

``` text
GenerationJob
├── job_id
├── user_id
├── requested_count
├── generated_count
├── failed_count
├── status
├── current_item
├── cancellation_state
├── retry_information
├── created_at
├── started_at
├── completed_at
└── error_information
```

The backend must enforce the count and maximum regardless of what the
frontend sends.

------------------------------------------------------------------------

# 30. Queue Design

The queue exists to separate:

``` text
Real-time connection handling
        from
AI generation work
```

This prevents an AI generation task from blocking the WebSocket
connection itself.

## Queue responsibilities

-   accept bounded generation jobs,
-   control concurrency,
-   schedule workers,
-   support cancellation,
-   isolate failures,
-   expose job state,
-   prevent uncontrolled parallel generation.

## Scale-aware implementation principle

The queue abstraction should remain clean enough that the backing
implementation can be:

-   lightweight/in-process for small known deployments,
-   Redis-backed when multi-worker or multi-instance coordination
    requires it.

Do not introduce Kafka or a microservice fleet merely for architectural
theatre.

------------------------------------------------------------------------

# 31. Multi-Instance Real-Time Design

If the backend runs multiple instances:

``` mermaid
flowchart LR
    CLIENT[Clients] --> LB[Load Balancer]
    LB --> WS1[Backend Instance 1]
    LB --> WS2[Backend Instance 2]

    WS1 --> REDIS[(Redis Pub/Sub / Queue)]
    WS2 --> REDIS

    REDIS --> WORKERS[AI Workers]
    WORKERS --> PG[(PostgreSQL)]

    PG --> WS1
    PG --> WS2
```

The important separation is:

-   PostgreSQL = durable source of truth,
-   Redis/queue = coordination and transient real-time/job state,
-   WebSocket = client-facing event transport.

Sticky sessions should not be the only mechanism protecting job state.

------------------------------------------------------------------------

# 32. Persistence Rule

Generated questions must be persisted incrementally.

Example:

``` text
Q1 validated
   ↓
persist Q1
   ↓
emit Q1

Q2 validated
   ↓
persist Q2
   ↓
emit Q2
```

If the browser disconnects after Q7, Q1--Q7 must not disappear.

------------------------------------------------------------------------

# 33. Cancellation Semantics

Cancellation has two layers:

### User-facing cancellation

The user presses:

``` text
[Stop Generation]
```

### Worker-side cancellation

The job receives a cancellation signal.

Workers must check cancellation between generation units.

Already persisted valid results remain valid.

Cancellation must not roll back successful earlier questions.

------------------------------------------------------------------------

# 34. Retry Policy

Validation failure must never create an infinite loop.

``` mermaid
flowchart TD
    GEN[Generate Item] --> VAL{Valid?}
    VAL -->|Yes| SAVE[Persist + Stream]
    VAL -->|No| RETRY{Retry Budget Left?}
    RETRY -->|Yes| REGEN[Regenerate]
    REGEN --> GEN
    RETRY -->|No| FLAG[Flag / Skip Item]
```

Retry budget is per item.

A failed question must not consume the entire generation job.

------------------------------------------------------------------------

# 35. Validation Rules

Generated questions should be validated before they become trusted
product content.

Validation may include:

-   schema validity,
-   exactly one correct option,
-   valid option structure,
-   no duplicate options,
-   concept alignment,
-   sub-concept alignment,
-   requested Bloom target,
-   difficulty target,
-   ambiguity checks,
-   explanation presence where required,
-   semantic duplicate checks,
-   source/blueprint consistency.

------------------------------------------------------------------------

# 36. Question Generation Pipeline

``` mermaid
flowchart LR
    SEED[Seed Questions]
    UNDERSTAND[Understand]
    BLUEPRINT[Blueprint]
    RETRIEVE[Retrieve Context if Useful]
    GENERATE[Generate]
    VALIDATE[Validate]
    DEDUP[Deduplicate]
    PERSIST[Persist]
    STREAM[Stream]

    SEED --> UNDERSTAND --> BLUEPRINT --> RETRIEVE --> GENERATE --> VALIDATE --> DEDUP --> PERSIST --> STREAM
```

The retrieval stage is optional and should only run when it improves
quality.

------------------------------------------------------------------------

# 37. Semantic Layer --- PostgreSQL + pgvector

PostgreSQL is the primary source of truth.

pgvector is used only where semantic similarity creates a concrete
product benefit.

## One semantic capability

``` mermaid
flowchart TD
    EMB[Embedding Model] --> INDEX[Semantic Index]
    INDEX --> VEC[pgvector Similarity]

    VEC --> SIM[Similar Question Retrieval]
    VEC --> DUP[Duplicate Detection]
    VEC --> RES[Resource Matching]
```

These are not three separate AI services.

------------------------------------------------------------------------

# 38. Semantic Use Case --- Similar Questions

``` text
Seed Question
      ↓
Embedding
      ↓
pgvector search
      ↓
Relevant approved questions
      ↓
Generation context
```

Purpose:

Keep generated content close to the intended concept and existing
approved material.

------------------------------------------------------------------------

# 39. Semantic Use Case --- Duplicate Detection

``` text
Generated Question
      ↓
Embedding
      ↓
Existing approved questions
      ↓
Similarity
      ↓
Possible duplicate
      ↓
Flag / review
```

A high similarity signal should be explainable as a review signal, not
silently destroy content without trace.

------------------------------------------------------------------------

# 40. Semantic Use Case --- Resource Matching

``` text
Learning Gap
      ↓
Embedding
      ↓
pgvector
      ↓
Relevant learning resources
```

This connects learning evidence to relevant learning material.

------------------------------------------------------------------------

# 41. AI Model Abstraction

The application should not be hard-coded to one model.

``` mermaid
flowchart LR
    CAP[AI Capability]
    ADAPTER[Model Adapter]
    LOCAL[Local LLM]
    OTHER[Alternative Model]

    CAP --> ADAPTER
    ADAPTER --> LOCAL
    ADAPTER --> OTHER
```

This allows model replacement without rewriting the product domain.

------------------------------------------------------------------------

# 42. AI Assistance Policy

## Practice

Allowed:

-   hints,
-   explanations,
-   guided help.

## Graded assessment

AI assistance is disabled.

Reason:

The purpose of the attempt is to collect assessment evidence. Assistance
would change the meaning of that evidence.

## Diagnostics

AI assistance is disabled by default.

If an assisted attempt is ever explicitly permitted, it must be marked
as assisted and should not be treated as equivalent to a clean
assessment attempt.

------------------------------------------------------------------------

# 43. Evidence Model

Conceptual entity:

``` text
LearningEvidence
├── student
├── concept
├── source
├── result
├── timestamp
├── relevant metadata
└── confidence / signal strength
```

Sources may include:

-   assessment,
-   practice,
-   diagnostic,
-   coding challenge,
-   reassessment.

------------------------------------------------------------------------

# 44. Recency-Aware Evidence

Old and new evidence should not be treated identically.

``` mermaid
flowchart TD
    E[Recent Evidence] --> R[Recency Weighting]
    R --> P[Repeated Pattern Detection]
    P --> G[Candidate Learning Gap]
```

The first implementation should use a simple recency-aware aggregation
rather than a complex predictive model.

The goal is not to pretend to have perfect prediction.

The goal is to make the evidence more useful and current.

------------------------------------------------------------------------

# 45. Learning Gap Semantics

A learning gap is:

> **A candidate explanation of a repeated weakness that is supported by
> observable learning evidence.**

It is not:

-   a secret risk score,
-   a permanent label,
-   a diagnosis that cannot be challenged,
-   an LLM hallucination.

The teacher must be able to inspect evidence before taking action.

------------------------------------------------------------------------

# 46. Conceptual Data Model

``` mermaid
erDiagram
    USER ||--o{ CLASS_MEMBERSHIP : joins
    CLASS ||--o{ CLASS_MEMBERSHIP : contains
    USER ||--o{ LEARNING_SESSION : creates

    LEARNING_SESSION ||--o{ QUESTION : contains
    QUESTION ||--o{ QUESTION_VARIANT : has

    QUESTION ||--o{ ATTEMPT : receives
    USER ||--o{ ATTEMPT : makes

    ATTEMPT ||--o{ LEARNING_EVIDENCE : produces
    USER ||--o{ LEARNING_EVIDENCE : owns
    LEARNING_EVIDENCE }o--|| CONCEPT : targets

    USER ||--o{ LEARNING_GAP : has
    LEARNING_GAP }o--o{ LEARNING_EVIDENCE : supported_by

    LEARNING_GAP ||--o{ DIAGNOSTIC : triggers
    DIAGNOSTIC ||--o{ QUESTION : contains

    LEARNING_GAP ||--o{ INTERVENTION : drives
    INTERVENTION ||--o{ ACTIVITY : contains

    INTERVENTION ||--o{ REASSESSMENT : measured_by
    REASSESSMENT ||--o{ LEARNING_EVIDENCE : produces
```

------------------------------------------------------------------------

# 47. Conceptual Domain Entities

``` text
User
├── Role
├── Profile
└── Preferences

Class
├── Teacher
└── Students

LearningSession
├── Topic
├── Objectives
├── Questions
└── LearningPlan

Question
├── Concept
├── Sub-concept
├── Bloom
├── Difficulty
├── Options
└── Source

QuestionVariant
└── Blueprint reference

Assessment
└── Questions

Attempt
├── Student
├── Question
├── Answer
├── Result
└── Timestamp

LearningEvidence
├── Student
├── Concept
├── Source
├── Result
├── Timestamp
└── Signal metadata

LearningGap
├── Student
├── Concept
└── Evidence references

Diagnostic
└── Diagnostic Questions

Intervention
├── LearningGap
├── LearningPlan
└── Activities

Reassessment
└── New Evidence
```

This is conceptual, not a frozen SQL schema.

------------------------------------------------------------------------

# 48. Backend Domain Structure

``` mermaid
flowchart TD
    API[Application API / Realtime Layer]
    API --> AUTH[Auth]
    API --> ASSESS[Assessment]
    API --> LEARN[Learning]
    API --> DIAG[Diagnostics]
    API --> INT[Intervention]
    API --> AI[AI Jobs]

    AUTH --> PG[(PostgreSQL)]
    ASSESS --> PG
    LEARN --> PG
    DIAG --> PG
    INT --> PG
    AI --> PG
```

Business logic belongs in domain services, not React components.

------------------------------------------------------------------------

# 49. Frontend Architecture

Conceptual organization:

``` text
src/
├── apps/
│   ├── teacher/
│   │   ├── student-intelligence/
│   │   ├── class-insights/
│   │   ├── diagnostic-lab/
│   │   └── intervention-center/
│   │
│   ├── student/
│   │   ├── my-learning/
│   │   ├── practice-lab/
│   │   ├── code-lab/
│   │   └── progress-lab/
│   │
│   └── settings/
│
├── shared/
│   ├── components/
│   ├── design-system/
│   ├── hooks/
│   ├── types/
│   └── utilities/
│
└── domain/
    ├── learning/
    ├── assessment/
    ├── diagnostics/
    ├── intervention/
    └── ai/
```

Exact folder structure remains flexible.

The important rule is clear ownership of business logic and reusable UI.

------------------------------------------------------------------------

# 50. UI State Architecture

UI components should consume domain state rather than own complex
business decisions.

Bad:

``` text
React Component
 ├── calls LLM
 ├── calculates learning gap
 ├── decides retry count
 ├── writes database
 └── renders UI
```

Preferred:

``` text
UI
 ↓
Application / Domain Service
 ↓
Repository / Job Service
 ↓
PostgreSQL / Queue / AI
 ↓
Domain Result
 ↓
UI
```

------------------------------------------------------------------------

# 51. API and Realtime Boundary

HTTP is appropriate for durable request/response operations such as:

-   authentication,
-   fetching students,
-   fetching questions,
-   saving edits,
-   publishing,
-   loading evidence,
-   creating assignments.

WebSocket is appropriate for:

-   generation progress,
-   generated item events,
-   cancellation,
-   live job status,
-   realtime job errors.

This avoids forcing every interaction through WebSocket.

------------------------------------------------------------------------

# 52. Example Generation Lifecycle

``` mermaid
sequenceDiagram
    participant U as Teacher UI
    participant WS as WebSocket
    participant J as Job Manager
    participant Q as Queue
    participant W as AI Worker
    participant V as Validator
    participant DB as PostgreSQL

    U->>WS: start_generation(count=20)
    WS->>J: create job
    J->>Q: enqueue job
    WS-->>U: generation.started

    loop Until complete/cancelled
        Q->>W: generate item
        W->>V: validate
        alt Valid
            V->>DB: persist question
            DB-->>WS: item persisted
            WS-->>U: question.generated
        else Invalid
            V->>Q: retry if budget remains
            WS-->>U: question.failed / progress
        end
    end

    WS-->>U: generation.completed
```

------------------------------------------------------------------------

# 53. End-to-End Product Flow

## Teacher

``` text
Create learning session
        ↓
Add seed MCQs
        ↓
Choose generation count
        ↓
Optional Bloom distribution
        ↓
Generate
        ↓
Questions stream in
        ↓
Review / edit
        ↓
Publish
        ↓
Assign
```

## Student

``` text
My Learning
      ↓
Practice / Assessment
      ↓
MCQ Attempts
      ↓
Learning Evidence
```

## Intelligence

``` text
Evidence
   ↓
Recency + repeated pattern
   ↓
Candidate learning gap
   ↓
Student Intelligence / Class Insights
```

## Diagnosis

``` text
Learning Gap
      ↓
Diagnostic Lab
      ↓
Targeted MCQs / Coding
      ↓
Evidence
```

## Intervention

``` text
Gap + Evidence
      ↓
AI Learning Plan
      ↓
Teacher Review
      ↓
Targeted Practice
      ↓
Reassessment
      ↓
Progress Lab
```

------------------------------------------------------------------------

# 54. Full System Diagram

``` mermaid
flowchart TB
    subgraph UI["UI / OS SHELL"]
        T[Teacher]
        S[Student]
        SET[Settings]
    end

    subgraph APPS["APPLICATION VIEWS"]
        SI[Student Intelligence]
        CI[Class Insights]
        DL[Diagnostic Lab]
        IC[Intervention Center]
        ML[My Learning]
        PL[Practice Lab]
        CL[Code Lab]
        PR[Progress Lab]
    end

    subgraph CORE["CORE LEARNING DOMAIN"]
        ASS[Assessment]
        ATT[Attempts]
        EVI[Evidence]
        GAP[Learning Gaps]
        ACT[Learning Actions]
        REA[Reassessment]
    end

    subgraph REALTIME["REAL-TIME GENERATION"]
        WS[WebSocket]
        JM[Job Manager]
        Q[Queue]
        W[AI Workers]
        V[Validator]
    end

    PG[(PostgreSQL)]
    VEC[(pgvector)]
    AI[Model Adapter / Local LLM]

    T --> SI
    T --> CI
    T --> DL
    T --> IC

    S --> ML
    S --> PL
    S --> CL
    S --> PR

    SI --> EVI
    CI --> EVI
    DL --> GAP
    IC --> GAP
    ML --> EVI
    PL --> ASS
    CL --> ATT
    PR --> REA

    ASS --> ATT --> EVI --> GAP --> ACT --> REA --> EVI

    T --> WS
    S --> WS
    WS --> JM --> Q --> W --> AI
    W --> V --> PG
    V --> WS

    EVI --> PG
    ASS --> PG
    ATT --> PG
    GAP --> PG
    ACT --> PG
    REA --> PG

    PG <--> VEC
```

------------------------------------------------------------------------

# 55. UX Requirements by Principle

## P1 --- Explainability

Whenever the UI surfaces a learning gap, it should provide:

-   concept,
-   recent evidence,
-   source activity,
-   time context,
-   relevant attempt/error information,
-   available action.

## P2 --- Actionability

A teacher should not have to manually navigate across five apps to act
on a gap.

Gap cards should expose contextual actions:

``` text
[View Evidence]
[Diagnose]
[Create Intervention]
[Assign Practice]
```

## P3 --- Progressive disclosure

Do not show every piece of evidence simultaneously.

Default:

``` text
Gap → summary → action
```

Expand:

``` text
Evidence → attempts → timestamps → detailed signals
```

## P4 --- Preserve user control

AI proposes.

Teacher approves/edits.

Student performs.

System measures.

The platform should not silently assign consequential learning actions.

------------------------------------------------------------------------

# 56. Generation UX Requirements

The generation interface must make four things visible:

1.  **What is being generated?**
2.  **How many?**
3.  **How far along is it?**
4.  **Can I stop it?**

Minimum UI:

``` text
Target: Recursion
Count: 20
Bloom: 4 / 4 / 6 / 4 / 2
Difficulty: Mixed

[Generate]
```

During generation:

``` text
7 / 20

✓ 01
✓ 02
✓ 03
✓ 04
✓ 05
✓ 06
⟳ 07
○ 08
...

[Stop]
```

------------------------------------------------------------------------

# 57. Question Review UX

Each generated question should be independently reviewable.

``` text
┌────────────────────────────────────────────┐
│ Q07                         ✓ Validated     │
│                                            │
│ Which condition terminates the recursion?  │
│                                            │
│ ○ A                                        │
│ ● B                                        │
│ ○ C                                        │
│ ○ D                                        │
│                                            │
│ Concept: Recursion termination             │
│ Bloom: Apply                               │
│ Difficulty: Medium                         │
│                                            │
│ [Edit] [Approve] [Regenerate]              │
└────────────────────────────────────────────┘
```

This also makes streaming useful: questions can be reviewed before the
entire batch finishes.

------------------------------------------------------------------------

# 58. Error UX

Never expose raw stack traces as the primary user experience.

Instead:

``` text
Generation could not complete Q07.

Reason
The generated question did not pass validation.

[Retry Q07]
```

Developer logs may contain the full diagnostic detail.

------------------------------------------------------------------------

# 59. Empty-State UX

Every app needs a useful empty state.

Example Student Intelligence:

``` text
No learning gaps detected yet.

Complete assessments or practice activities
to start building learning evidence.
```

Example Class Insights:

``` text
Not enough evidence yet.

More student attempts are required before
class-level patterns can be shown.
```

Avoid fake analytics.

------------------------------------------------------------------------

# 60. Accessibility Requirements

The application should support:

-   keyboard navigation,
-   visible focus states,
-   readable contrast,
-   semantic controls,
-   labels for form elements,
-   non-colour-only status indicators,
-   screen-reader-friendly status messages where practical,
-   scalable text,
-   reduced-motion consideration,
-   accessible editor controls where possible.

------------------------------------------------------------------------

# 61. Responsive UX

The primary environment may be desktop-oriented because teachers need
dense information and students need Code Lab.

Still:

-   no critical action should disappear on smaller screens,
-   cards should reflow,
-   tables should support horizontal overflow,
-   generation status must remain visible,
-   dialogs must remain usable.

------------------------------------------------------------------------

# 62. Performance Requirements

## UI

-   render incremental generation without freezing,
-   virtualise long lists where needed,
-   avoid unnecessary re-renders,
-   preserve editor responsiveness.

## Backend

-   do not block WebSocket handlers with model inference,
-   use background workers for generation,
-   use bounded concurrency,
-   persist incrementally.

## Database

-   index common student/concept/time queries,
-   keep evidence queryable,
-   avoid loading entire histories when only recent evidence is
    required.

------------------------------------------------------------------------

# 63. Reliability Requirements

The system should tolerate:

-   browser refresh,
-   WebSocket disconnect,
-   worker failure,
-   individual question generation failure,
-   model timeout,
-   validation failure,
-   cancellation,
-   partial completion.

The user must not lose successfully persisted generated content.

------------------------------------------------------------------------

# 64. Security Requirements

At minimum:

-   authenticated users,
-   role-based authorization,
-   server-side permission checks,
-   teacher/student data isolation,
-   no trusting client-supplied role,
-   generation count validation server-side,
-   job ownership checks,
-   WebSocket authentication,
-   input validation,
-   safe code execution isolation for Code Lab,
-   secrets outside source control.

------------------------------------------------------------------------

# 65. Code Execution Safety

Code Lab must execute student code in a constrained environment.

Conceptually:

``` mermaid
flowchart LR
    CODE[Student Code] --> SANDBOX[Execution Sandbox]
    SANDBOX --> LIMITS[CPU / Memory / Time Limits]
    LIMITS --> TESTS[Test Cases]
    TESTS --> RESULT[Result]
```

The execution environment must not expose unrestricted host access.

------------------------------------------------------------------------

# 66. Observability

Important events should be logged:

``` text
generation_started
generation_item_generated
generation_item_failed
generation_cancelled
generation_completed

question_validated
question_rejected

assessment_started
attempt_submitted

evidence_created
learning_gap_created

diagnostic_created
intervention_created
reassessment_completed
```

Logs should make it possible to trace:

``` text
User
 → Job
 → Generated Item
 → Validation
 → Persistence
 → Evidence
```

------------------------------------------------------------------------

# 67. AI Auditability

For generated content, preserve enough metadata to answer:

-   who requested it?
-   what seed/topic was used?
-   what blueprint was used?
-   what count was requested?
-   which model generated it?
-   did validation pass?
-   how many retries occurred?
-   was it approved?
-   when was it published?

This makes AI output traceable rather than ephemeral.

------------------------------------------------------------------------

# 68. Non-Goals / Scope Protection

Explicitly avoid:

-   giant general-purpose chatbot,
-   unlimited AI generation,
-   unbounded retry loops,
-   arbitrary free-form answer grading,
-   oversized Settings,
-   mandatory vector search everywhere,
-   separate duplicated intelligence pipelines,
-   a separate AI service for every tiny semantic operation,
-   forcing agents into every workflow,
-   analytics that exist only to make the product look larger.

------------------------------------------------------------------------

# 69. Engineering Decisions

  -------------------------------------------------------------------------
  Decision                Direction                 Reason
  ----------------------- ------------------------- -----------------------
  Database                PostgreSQL                Relational source of
                                                    truth and local control

  Vector search           pgvector where useful     Semantic similarity
                                                    without separate vector
                                                    infrastructure

  AI models               Adapter abstraction       Replaceable
                                                    model/provider

  Generation transport    WebSocket                 Bidirectional realtime
                                                    UX

  Generation execution    Queue + workers           Prevent inference from
                                                    blocking connections

  Persistence             Incremental PostgreSQL    Partial results survive
                          writes                    disconnect/failure

  Validation              Before                    AI output cannot be
                          persistence/publication   blindly trusted

  Retry                   Bounded per item          Avoid infinite loops
                                                    and runaway compute

  UI                      React                     Existing direction and
                                                    component ecosystem

  OS metaphor             Shell only                Navigation identity
                                                    without becoming
                                                    gimmick

  Code editor             Reuse TestForge strengths Proven QoL and editor
                                                    behaviour

  Intelligence            Evidence-backed           Explainability over
                                                    opaque score

  Bloom                   Metadata / generation     Useful but not
                          target                    intelligence backbone

  Semantic features       One retrieval capability  Avoid service
                                                    fragmentation

  Supabase                Removed                   PostgreSQL is the
                                                    chosen source of truth
  -------------------------------------------------------------------------

------------------------------------------------------------------------

# 70. Why Not a Generic API Gateway Architecture?

A generic diagram such as:

``` text
Frontend
   ↓
API Gateway
   ↓
Backend
   ↓
AI
```

does not describe the actual problem.

The generation workflow has:

-   long-running jobs,
-   multiple generated items,
-   incremental validation,
-   cancellation,
-   retries,
-   progress,
-   persistence,
-   realtime delivery.

Therefore the relevant architecture is:

``` text
Client
  ↓
WebSocket
  ↓
Job Manager
  ↓
Queue
  ↓
AI Worker
  ↓
Validation
  ↓
PostgreSQL
  ↓
Realtime Event
  ↓
Client
```

The API layer still exists for ordinary CRUD operations. It simply is
not the central abstraction for the streaming generation path.

------------------------------------------------------------------------

# 71. Scale Strategy

The architecture should be sized to known requirements rather than
intentionally crippled.

## Small deployment

``` text
FastAPI
 ├── WebSocket
 ├── HTTP
 └── lightweight queue

AI worker
PostgreSQL
```

## Multi-worker deployment

``` text
Load Balancer
      ↓
Multiple Backend Instances
      ↓
Redis-backed coordination
      ↓
Multiple AI Workers
      ↓
PostgreSQL
```

## Principle

Scale the components that actually become bottlenecks:

-   WebSocket connection management,
-   generation workers,
-   queue depth,
-   model inference,
-   database connections.

Do not add Kafka, Kubernetes, service meshes, or dozens of microservices
simply because they exist.

------------------------------------------------------------------------

# 72. Known Bottlenecks

Likely bottlenecks:

1.  local model inference,
2.  concurrent generation jobs,
3.  database writes,
4.  WebSocket fan-out,
5.  code execution,
6.  embedding generation.

The architecture isolates these so they can be scaled independently
where required.

------------------------------------------------------------------------

# 73. Concurrency Control

Generation must not become:

``` text
100 users
× 20 questions
× uncontrolled parallel model calls
```

Instead:

``` text
Incoming Jobs
     ↓
Queue
     ↓
Concurrency Limit
     ↓
Workers
     ↓
Validation
```

This protects:

-   model memory,
-   CPU/GPU,
-   database,
-   response latency,
-   overall system stability.

------------------------------------------------------------------------

# 74. Resource Budgeting

Every generation request has:

``` text
requested_count
hard_maximum
retry_budget
worker_concurrency
```

Therefore compute consumption is bounded by design.

Conceptually:

``` text
Maximum model attempts
≈ requested_count × bounded retry allowance
```

The exact numeric limits are deployment configuration, not UI
assumptions.

------------------------------------------------------------------------

# 75. Implementation Order

This is **not a product roadmap** and does not imply V1/V2/V3.

It is simply a dependency-aware build order for the one hackathon
implementation.

## Foundation

-   PostgreSQL,
-   authentication,
-   roles,
-   OS shell,
-   Settings,
-   shared design system,
-   Code Lab extraction/reuse.

## Assessment

-   MCQ model,
-   question bank,
-   sessions,
-   assessments,
-   attempts,
-   results,
-   question metadata.

## AI Generation

-   seed analysis,
-   blueprint,
-   count controls,
-   Bloom targeting,
-   WebSocket,
-   job management,
-   queue,
-   workers,
-   validation,
-   streaming,
-   persistence,
-   review.

## Learning Intelligence

-   evidence,
-   recency-aware aggregation,
-   concept signals,
-   candidate learning gaps,
-   Student Intelligence,
-   Class Insights.

## Diagnosis and Intervention

-   Diagnostic Lab,
-   diagnostic generation,
-   evidence collection,
-   Intervention Center,
-   learning-plan generation,
-   targeted practice.

## Reassessment

-   reassessment,
-   before/after evidence,
-   Progress Lab,
-   updated learning profile.

## Semantic Layer

Only where concrete use cases justify it:

-   embeddings,
-   pgvector retrieval,
-   similar-question retrieval,
-   duplicate detection,
-   resource matching.

------------------------------------------------------------------------

# 76. Acceptance Criteria --- Product

The build should demonstrate this complete loop:

``` text
Teacher creates seed questions
        ↓
AI generates bounded variants
        ↓
Questions stream live
        ↓
Teacher reviews
        ↓
Student practices
        ↓
Attempts create evidence
        ↓
System surfaces candidate learning gap
        ↓
Teacher inspects evidence
        ↓
Diagnostic is generated
        ↓
Student completes diagnostic
        ↓
Intervention plan is generated
        ↓
Teacher reviews/assigns
        ↓
Student completes targeted activities
        ↓
Student reassesses
        ↓
Progress is shown
```

If this loop works, the product's core proposition is demonstrable.

------------------------------------------------------------------------

# 77. Acceptance Criteria --- Streaming

A generation job is considered correctly implemented when:

-   user chooses an explicit count,
-   backend enforces a hard maximum,
-   job enters a queue,
-   AI workers process items,
-   each valid item is persisted,
-   each valid item is streamed to the UI,
-   progress updates arrive,
-   invalid items receive bounded retries,
-   failed items can be retried individually,
-   user can cancel,
-   already generated items remain available after cancellation,
-   completion state is emitted,
-   reconnect does not erase persisted results.

------------------------------------------------------------------------

# 78. Acceptance Criteria --- Intelligence

A learning gap is correctly surfaced when:

-   evidence comes from actual attempts,
-   concept association is known,
-   evidence has timestamps,
-   recent evidence is considered,
-   repeated patterns are considered,
-   the UI shows supporting evidence,
-   the teacher can inspect the source attempts,
-   the gap is presented as a candidate for attention.

------------------------------------------------------------------------

# 79. Acceptance Criteria --- Code Diagnostics

A coding diagnostic is correctly implemented when:

-   challenge metadata identifies the target concept,
-   test cases define expected behaviour,
-   student code is executed in a constrained environment,
-   concrete failures are captured,
-   failures become diagnostic signals,
-   signals become learning evidence,
-   LLM explanation is optional rather than the sole evidence source.

------------------------------------------------------------------------

# 80. Acceptance Criteria --- AI Quality

Generated questions must:

-   conform to the schema,
-   have a valid correct answer,
-   have valid options,
-   avoid duplicate options,
-   remain aligned with the target concept,
-   respect the requested constraints,
-   meet the requested Bloom target where specified,
-   respect difficulty targeting,
-   pass validation,
-   be bounded by retry policy.

------------------------------------------------------------------------

# 81. Testing Strategy

## Unit tests

Test:

-   evidence aggregation,
-   recency logic,
-   gap detection,
-   blueprint validation,
-   question validation,
-   retry counters,
-   generation state transitions,
-   authorization.

## Integration tests

Test:

-   generation job → queue → worker → validation → DB,
-   WebSocket event flow,
-   reconnect/resync,
-   cancellation,
-   incremental persistence,
-   assessment → evidence,
-   evidence → gap,
-   gap → diagnostic,
-   intervention → reassessment.

## UI tests

Test:

-   generation count control,
-   streaming list updates,
-   stop generation,
-   failed item retry,
-   evidence expansion,
-   action buttons,
-   role-specific navigation,
-   theme/font settings.

## End-to-end demo test

Execute the complete learning loop from teacher seed question to student
reassessment.

------------------------------------------------------------------------

# 82. Failure Scenarios

## Model timeout

``` text
Worker
 ↓
Timeout
 ↓
Retry within budget
 ↓
If exhausted → item failed
```

## WebSocket disconnect

``` text
Socket lost
 ↓
Job continues
 ↓
Results persist
 ↓
Client reconnects
 ↓
Client requests job state
 ↓
UI resynchronises
```

## Browser refresh

The job does not disappear.

Persisted questions remain accessible.

## Worker crash

The queue/job system must allow unfinished work to be retried according
to the job's failure policy.

------------------------------------------------------------------------

# 83. Data Ownership Rules

The database owns durable truth.

The client does not own:

-   generation status,
-   authorization,
-   final question validity,
-   learning gap state,
-   assessment result.

The client displays server-authoritative state.

------------------------------------------------------------------------

# 84. AI Output Trust Model

``` text
AI Output
   ↓
Schema Validation
   ↓
Semantic / Constraint Validation
   ↓
Duplicate Detection
   ↓
Persistence
   ↓
Teacher Review
   ↓
Publication
```

AI output is a proposal until it passes the required controls.

------------------------------------------------------------------------

# 85. Product Differentiation

The product is not differentiated merely by:

-   having an LLM,
-   generating MCQs,
-   having a chatbot,
-   having charts,
-   having an OS-style UI.

The differentiating system behaviour is the connected loop:

``` text
Teacher Content
      ↓
Structured Assessment
      ↓
Student Evidence
      ↓
Concept-Level Signal
      ↓
Candidate Learning Gap
      ↓
Diagnosis
      ↓
Targeted Intervention
      ↓
Reassessment
      ↓
Measured Change
```

AI accelerates the loop.

The loop itself is the product.

------------------------------------------------------------------------

# 86. Decisions Made in Response to Earlier Critique

This section explicitly records the substantive corrections made during
iteration.

## Critique: "Evidence is better than an opaque risk score"

**Decision:** Adopted.

The system exposes supporting evidence, timestamps, attempts, patterns
and concept context instead of a magic risk score.

------------------------------------------------------------------------

## Critique: "Evidence needs recency"

**Decision:** Adopted.

Evidence aggregation is recency-aware and considers repeated patterns.

------------------------------------------------------------------------

## Critique: "Bloom is overused"

**Decision:** Corrected.

Bloom is primarily a generation target and optional metadata. It is not
the foundation of student intelligence.

------------------------------------------------------------------------

## Critique: "Diagnostic and Intervention overlap"

**Decision:** Clarified.

They remain separate UX applications because they answer different user
questions:

``` text
Diagnostic
"What exactly is wrong?"

Intervention
"What should we do next?"
```

They share the same gap/evidence domain and do not duplicate
intelligence pipelines.

------------------------------------------------------------------------

## Critique: "Three semantic services are unnecessary"

**Decision:** Corrected.

Similar-question retrieval, duplicate detection and resource matching
are treated as use cases over one semantic retrieval capability.

------------------------------------------------------------------------

## Critique: "Retry cap is missing"

**Decision:** Adopted.

Every generated item has a bounded retry budget.

------------------------------------------------------------------------

## Critique: "Code evidence mapping is thin"

**Decision:** Corrected.

Code diagnostics now explicitly map:

``` text
Challenge metadata
 → Execution
 → Test cases
 → Concrete diagnostic signals
 → Learning evidence
```

------------------------------------------------------------------------

## Critique: "The system may be over-engineered"

**Decision:** Refined rather than blindly reduced.

The build intentionally includes the requested product surface, but the
implementation is kept coherent through:

-   one shared learning pipeline,
-   shared domain services,
-   bounded AI jobs,
-   queue abstraction,
-   explicit concurrency control,
-   PostgreSQL source of truth,
-   one semantic capability,
-   reusable UI components.

The applications are not separate backends.

------------------------------------------------------------------------

## Critique: "Streaming could be simpler"

**Decision:** Streaming remains a first-class architectural requirement.

Because streaming is a deliberate UX requirement, the architecture
explicitly supports:

``` text
WebSocket
 → Job
 → Queue
 → Worker
 → Validation
 → Persistence
 → Realtime event
```

The implementation can use a lightweight queue for a small deployment or
a Redis-backed queue when concurrency/multi-instance requirements
justify it.

------------------------------------------------------------------------

# 87. Final Architectural Contract

The implementation is free to change internal technology choices, but
these behavioural contracts should remain intact:

``` text
ONE PRODUCT
     ↓
ONE LEARNING LOOP
     ↓
SHARED EVIDENCE MODEL
     ↓
BOUNDED AI CAPABILITIES
     ↓
REAL-TIME GENERATION
     ↓
TRACEABLE VALIDATION
     ↓
TARGETED ACTION
     ↓
REASSESSMENT
```

### Hard requirements

-   explicit generation count,
-   hard generation maximum,
-   real-time streaming,
-   queue-backed generation,
-   bounded concurrency,
-   incremental persistence,
-   cancellation,
-   bounded retry,
-   evidence traceability,
-   recency-aware evidence,
-   teacher review,
-   PostgreSQL source of truth,
-   concrete code diagnostic signals,
-   replaceable model adapter,
-   pgvector only where useful,
-   shared domain logic,
-   no duplicated intelligence pipelines.

------------------------------------------------------------------------

# 88. Final Product Statement

> **From a small set of teacher-created questions, the system builds a
> structured learning experience, observes student performance,
> identifies evidence-backed learning difficulties, helps diagnose the
> underlying concept, delivers targeted learning actions, and measures
> whether those actions improved learning.**

AI makes content creation, diagnosis, planning and support faster.

The OS shell makes the system understandable to navigate.

The coding environment preserves a proven learning interaction.

PostgreSQL provides durable truth.

WebSocket + queue + workers provide bounded real-time generation.

pgvector provides semantic retrieval where it actually helps.

And the central principle remains:

> **The learning loop is the product.**
