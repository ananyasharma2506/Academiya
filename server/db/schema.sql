-- ============================================================================
-- Learning Intelligence Platform - Core Database Schema
-- Phase 1: Database Setup with pgvector and 14 Core Entities
-- ============================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. assessments
CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. questions
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
    concept TEXT NOT NULL,
    subconcept TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('mcq_single', 'mcq_multi', 'coding')),
    statement TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_option_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    bloom_level TEXT,
    difficulty TEXT,
    source TEXT NOT NULL CHECK (source IN ('teacher', 'ai')),
    embedding vector,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. attempts
CREATE TABLE IF NOT EXISTS attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('practice', 'assessment', 'diagnostic', 'reassessment')),
    selected_option_ids JSONB,
    code TEXT,
    is_correct BOOLEAN NOT NULL,
    marks_awarded NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. learning_evidence
CREATE TABLE IF NOT EXISTS learning_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    concept TEXT NOT NULL,
    subconcept TEXT NOT NULL,
    attempt_id UUID REFERENCES attempts(id) ON DELETE CASCADE,
    result TEXT NOT NULL CHECK (result IN ('correct', 'incorrect')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. learning_gaps
CREATE TABLE IF NOT EXISTS learning_gaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    concept TEXT NOT NULL,
    subconcept TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'emerging' CHECK (status IN ('emerging', 'confirmed', 'resolved')),
    evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. diagnostics
CREATE TABLE IF NOT EXISTS diagnostics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gap_id UUID REFERENCES learning_gaps(id) ON DELETE CASCADE,
    blueprint JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. diagnostic_attempts
CREATE TABLE IF NOT EXISTS diagnostic_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagnostic_id UUID REFERENCES diagnostics(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    is_correct BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. interventions
CREATE TABLE IF NOT EXISTS interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gap_id UUID REFERENCES learning_gaps(id) ON DELETE CASCADE,
    plan JSONB NOT NULL DEFAULT '{}'::jsonb,
    target_concept TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. reassessments
CREATE TABLE IF NOT EXISTS reassessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intervention_id UUID REFERENCES interventions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    attempt_id UUID REFERENCES attempts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. progress
CREATE TABLE IF NOT EXISTS progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    concept TEXT NOT NULL,
    before_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    after_evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    delta JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. generation_jobs
CREATE TABLE IF NOT EXISTS generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    requested_count INTEGER NOT NULL,
    generated_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'cancelled', 'failed')),
    retry_budget_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. generated_questions
CREATE TABLE IF NOT EXISTS generated_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES generation_jobs(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'failed')),
    attempt_no INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
