-- Enable pgvector and uuid generation
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('teacher', 'student')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. assessments
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  proctoring_enabled BOOLEAN NOT NULL DEFAULT false,
  integrity_rules JSONB NOT NULL DEFAULT '{"fullscreen": true, "block_tab_switch": true, "block_clipboard": true, "max_violations": 3}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


-- 3. questions
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
  concept VARCHAR(255) NOT NULL,
  subconcept VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('mcq_single', 'mcq_multi', 'coding', 'descriptive')),
  statement TEXT NOT NULL,
  options JSONB,
  correct_option_ids JSONB,
  reference_answer TEXT,
  reference_answer_embedding vector(768),
  bloom_level VARCHAR(50),
  difficulty VARCHAR(50),
  source VARCHAR(50) NOT NULL DEFAULT 'teacher' CHECK (source IN ('teacher', 'ai')),
  embedding vector(768),
  -- Scopes a self-serve AI-generated practice question to the student it was
  -- personalized for. NULL = shared pool (teacher-published / class assessment).
  generated_for_student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Idempotent for databases created before this column existed.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS generated_for_student_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- 4. attempts
CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  source VARCHAR(50) NOT NULL CHECK (source IN ('practice', 'assessment', 'diagnostic', 'reassessment')),
  selected_option_ids JSONB,
  code TEXT,
  is_correct BOOLEAN NOT NULL,
  marks_awarded NUMERIC(5, 2) NOT NULL DEFAULT 0,
  grading_details JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. learning_evidence
CREATE TABLE IF NOT EXISTS learning_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept VARCHAR(255) NOT NULL,
  subconcept VARCHAR(255) NOT NULL,
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  result VARCHAR(50) NOT NULL CHECK (result IN ('correct', 'incorrect')),
  source VARCHAR(50) NOT NULL DEFAULT 'deterministic' CHECK (source IN ('deterministic', 'ai_graded_descriptive')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. learning_gaps
CREATE TABLE IF NOT EXISTS learning_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept VARCHAR(255) NOT NULL,
  subconcept VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'emerging' CHECK (status IN ('emerging', 'confirmed', 'resolved')),
  evidence_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. diagnostics
CREATE TABLE IF NOT EXISTS diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id UUID NOT NULL REFERENCES learning_gaps(id) ON DELETE CASCADE,
  blueprint JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. diagnostic_attempts
CREATE TABLE IF NOT EXISTS diagnostic_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id UUID NOT NULL REFERENCES diagnostics(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. interventions
CREATE TABLE IF NOT EXISTS interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id UUID NOT NULL REFERENCES learning_gaps(id) ON DELETE CASCADE,
  plan JSONB NOT NULL,
  target_concept VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. reassessments
CREATE TABLE IF NOT EXISTS reassessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id UUID NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. progress
CREATE TABLE IF NOT EXISTS progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept VARCHAR(255) NOT NULL,
  before_evidence_ids JSONB NOT NULL,
  after_evidence_ids JSONB NOT NULL,
  delta JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. generation_jobs
CREATE TABLE IF NOT EXISTS generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_count INT NOT NULL,
  generated_count INT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'cancelled', 'failed')),
  retry_budget_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. generated_questions
CREATE TABLE IF NOT EXISTS generated_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'failed')),
  attempt_no INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 14. coding_challenges
CREATE TABLE IF NOT EXISTS coding_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept VARCHAR(255) NOT NULL,
  subconcept VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  initial_code TEXT NOT NULL,
  language VARCHAR(50) NOT NULL DEFAULT 'python',
  expected_behaviour TEXT NOT NULL,
  test_cases JSONB NOT NULL,
  diagnostic_tags JSONB DEFAULT '[]'::jsonb,
  -- Loosely matches a Learn window CourseSubject.id/subjectName (no FK, same
  -- free-text-by-convention pattern already used by student_topic_activity).
  course_id VARCHAR(100),
  course_name VARCHAR(255),
  difficulty VARCHAR(50) DEFAULT 'medium',
  -- Scopes a self-serve AI-generated challenge to the student it was
  -- personalized for, same convention as questions.generated_for_student_id.
  generated_for_student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE coding_challenges ADD COLUMN IF NOT EXISTS generated_for_student_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Idempotent for databases created before these columns existed.
ALTER TABLE coding_challenges ADD COLUMN IF NOT EXISTS course_id VARCHAR(100);
ALTER TABLE coding_challenges ADD COLUMN IF NOT EXISTS course_name VARCHAR(255);
ALTER TABLE coding_challenges ADD COLUMN IF NOT EXISTS difficulty VARCHAR(50) DEFAULT 'medium';

-- 15. integrity_events (Deterministic forensic anticheat tracking)
CREATE TABLE IF NOT EXISTS integrity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('tab_switch', 'window_blur', 'fullscreen_exit', 'paste_attempt', 'copy_attempt', 'context_menu', 'ctrl_c_attempt', 'ctrl_v_attempt', 'typing_anomaly', 'flag_threshold_exceeded')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 16. class_sessions (Phase 11: Auto attendance class windows)
CREATE TABLE IF NOT EXISTS class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 17. attendance (Phase 11: Deterministic auto-attendance records)
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  marked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(50) NOT NULL CHECK (source IN ('assignment_completion', 'assessment_completion', 'video_completion')),
  CONSTRAINT unique_student_session UNIQUE (student_id, session_id)
);

-- 17b. daily_checkins — self-service "I studied today" button on the desktop
-- Attendance widget. Deliberately decoupled from class_sessions: that table
-- only has rows during a teacher-scheduled window, which won't exist most
-- days, so a manual check-in needs its own path. The dashboard widgets
-- endpoint unions this with `attendance` into one calendar/streak.
CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_student_checkin_date UNIQUE (student_id, checkin_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_student ON daily_checkins(student_id);

-- 18. student_topic_activity (Active webpage tracking & struggle intelligence)
CREATE TABLE IF NOT EXISTS student_topic_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id VARCHAR(100) NOT NULL,
  subject_name VARCHAR(255) NOT NULL,
  topic_id VARCHAR(100) NOT NULL,
  topic_title VARCHAR(255) NOT NULL,
  active_seconds INT NOT NULL DEFAULT 0,
  total_seconds INT NOT NULL DEFAULT 0,
  scroll_distance INT NOT NULL DEFAULT 0,
  scroll_events_count INT NOT NULL DEFAULT 0,
  scroll_reversals_count INT NOT NULL DEFAULT 0,
  max_scroll_depth_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
  idle_seconds INT NOT NULL DEFAULT 0,
  rapid_scroll_detected BOOLEAN NOT NULL DEFAULT false,
  is_considered_read BOOLEAN NOT NULL DEFAULT false,
  struggle_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
  struggle_level VARCHAR(50) NOT NULL DEFAULT 'normal' CHECK (struggle_level IN ('normal', 'moderate_struggle', 'high_struggle')),
  struggle_reason TEXT,
  last_active_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_student_topic UNIQUE (student_id, topic_id)
);

-- Helpful indexes for rapid deterministic querying
CREATE INDEX IF NOT EXISTS idx_questions_concept ON questions(concept, subconcept);
CREATE INDEX IF NOT EXISTS idx_questions_generated_for_student ON questions(generated_for_student_id);
CREATE INDEX IF NOT EXISTS idx_coding_challenges_course ON coding_challenges(course_id);
CREATE INDEX IF NOT EXISTS idx_coding_challenges_generated_for_student ON coding_challenges(generated_for_student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id, question_id);
CREATE INDEX IF NOT EXISTS idx_evidence_student_concept ON learning_evidence(student_id, concept);
CREATE INDEX IF NOT EXISTS idx_gaps_student_status ON learning_gaps(student_id, status);
CREATE INDEX IF NOT EXISTS idx_interventions_gap ON interventions(gap_id);
CREATE INDEX IF NOT EXISTS idx_gen_jobs_teacher ON generation_jobs(teacher_id);
CREATE INDEX IF NOT EXISTS idx_integrity_events_assess_student ON integrity_events(assessment_id, student_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_window ON class_sessions(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_topic_activity_student ON student_topic_activity(student_id);
CREATE INDEX IF NOT EXISTS idx_topic_activity_struggle ON student_topic_activity(student_id, struggle_level);
-- 14. user_sessions (Persistent credential & session management)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(500) UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  user_agent TEXT,
  ip_address VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);

-- 15. system_settings (System-wide configuration such as active AI provider)
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
