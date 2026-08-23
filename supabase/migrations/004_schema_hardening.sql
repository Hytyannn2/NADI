-- Migration 004: Schema Hardening
-- Adds foreign keys, check constraints, indexes, timestamps, and row-level security hardening.

-- ==========================================
-- 1. ADD MISSING FOREIGN KEYS & COLUMNS
-- ==========================================

-- Community posts: add user ownership
ALTER TABLE public.nadi_community_posts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Bencana jobs: add user tracking and structured fields
ALTER TABLE public.nadi_bencana_jobs
  ADD COLUMN IF NOT EXISTS posted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS tools_needed TEXT,
  ADD COLUMN IF NOT EXISTS pax_needed INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ==========================================
-- 2. ADD updated_at TO TRANSACTIONAL TABLES
-- ==========================================

ALTER TABLE public.nadi_profiles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.nadi_community_posts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.nadi_infra_reports
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ==========================================
-- 3. FIX COORDINATE DATA TYPES
-- ==========================================

-- Convert lat/lng from TEXT to DOUBLE PRECISION
-- NOTE: This will fail if any existing values are not valid numbers.
-- Run `SELECT lat, lng FROM nadi_infra_reports WHERE lat !~ '^-?[0-9]+\.?[0-9]*$'` first to check.
ALTER TABLE public.nadi_infra_reports
  ALTER COLUMN lat TYPE DOUBLE PRECISION USING lat::DOUBLE PRECISION,
  ALTER COLUMN lng TYPE DOUBLE PRECISION USING lng::DOUBLE PRECISION;

-- ==========================================
-- 4. ADD CHECK CONSTRAINTS
-- ==========================================

-- Only add if not exists (use DO block for idempotency)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_jobs_status') THEN
    ALTER TABLE public.nadi_bencana_jobs
      ADD CONSTRAINT chk_jobs_status CHECK (status IN ('open', 'accepted', 'completed', 'banned', 'cancelled'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_jobs_priority') THEN
    ALTER TABLE public.nadi_bencana_jobs
      ADD CONSTRAINT chk_jobs_priority CHECK (priority IN ('Low', 'Medium', 'High', 'Critical'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sensor_status') THEN
    ALTER TABLE public.nadi_bencana_sensors
      ADD CONSTRAINT chk_sensor_status CHECK (status IN ('safe', 'warning', 'danger'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_zone_risk') THEN
    ALTER TABLE public.nadi_bencana_zones
      ADD CONSTRAINT chk_zone_risk CHECK (risk IN ('critical', 'high', 'moderate', 'low'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_infra_status') THEN
    ALTER TABLE public.nadi_infra_reports
      ADD CONSTRAINT chk_infra_status CHECK (status IN ('pending', 'verified', 'resolved', 'rejected'));
  END IF;
END
$$;

-- ==========================================
-- 5. ADD UNIQUE CONSTRAINTS
-- ==========================================

-- Sensor name is used as a lookup key — must be unique
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_sensor_name') THEN
    ALTER TABLE public.nadi_bencana_sensors
      ADD CONSTRAINT uq_sensor_name UNIQUE (name);
  END IF;
END
$$;

-- ==========================================
-- 6. ADD PERFORMANCE INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_chat_job_created
  ON public.nadi_bencana_chat (job_name, created_at);

CREATE INDEX IF NOT EXISTS idx_community_posts_created
  ON public.nadi_community_posts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_posts_user
  ON public.nadi_community_posts (user_id);

CREATE INDEX IF NOT EXISTS idx_jobs_status_created
  ON public.nadi_bencana_jobs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_posted_by
  ON public.nadi_bencana_jobs (posted_by);

CREATE INDEX IF NOT EXISTS idx_infra_reports_created
  ON public.nadi_infra_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_infra_reports_user
  ON public.nadi_infra_reports (user_id);

-- ==========================================
-- 7. FIX RLS POLICIES
-- ==========================================

-- === Bencana Jobs: Restrict UPDATE/DELETE to job owner ===
DROP POLICY IF EXISTS "Auth users update bencana jobs" ON public.nadi_bencana_jobs;
DROP POLICY IF EXISTS "Auth users delete bencana jobs" ON public.nadi_bencana_jobs;

DROP POLICY IF EXISTS "Owner can update own jobs" ON public.nadi_bencana_jobs;
CREATE POLICY "Owner can update own jobs"
  ON public.nadi_bencana_jobs FOR UPDATE
  USING (auth.uid() = posted_by);

DROP POLICY IF EXISTS "Owner can delete own jobs" ON public.nadi_bencana_jobs;
CREATE POLICY "Owner can delete own jobs"
  ON public.nadi_bencana_jobs FOR DELETE
  USING (auth.uid() = posted_by);

-- === Bencana Sensors: Remove public write access ===
-- Service role bypasses RLS automatically, so IoT devices
-- and admin API routes can still write.
DROP POLICY IF EXISTS "Auth users update sensors" ON public.nadi_bencana_sensors;

-- === Infra Reports: Restrict UPDATE to report owner ===
DROP POLICY IF EXISTS "Auth users update infra reports" ON public.nadi_infra_reports;

DROP POLICY IF EXISTS "Owner can update own infra reports" ON public.nadi_infra_reports;
CREATE POLICY "Owner can update own infra reports"
  ON public.nadi_infra_reports FOR UPDATE
  USING (auth.uid() = user_id);

-- === Community Posts: Add owner UPDATE/DELETE policies ===
DROP POLICY IF EXISTS "Owner can update own posts" ON public.nadi_community_posts;
DROP POLICY IF EXISTS "Owner can delete own posts" ON public.nadi_community_posts;

CREATE POLICY "Owner can update own posts"
  ON public.nadi_community_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owner can delete own posts"
  ON public.nadi_community_posts FOR DELETE
  USING (auth.uid() = user_id);

-- ==========================================
-- 8. AUTO-UPDATE TIMESTAMPS
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON public.nadi_bencana_jobs;
CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON public.nadi_bencana_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.nadi_profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.nadi_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_posts_updated_at ON public.nadi_community_posts;
CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON public.nadi_community_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_infra_updated_at ON public.nadi_infra_reports;
CREATE TRIGGER trg_infra_updated_at
  BEFORE UPDATE ON public.nadi_infra_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
