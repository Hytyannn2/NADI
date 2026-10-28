-- ================================================================
-- NADI Migration 020: Close policy drift found in the live database (2026-10-28 dump)
--
-- These policies were made by hand in the dashboard, not by any migration.
-- Permissive policies are OR-ed together, so one loose policy cancels a strict
-- one beside it. Every write below belongs to a service-role API route, which
-- bypasses RLS and grants, so nothing in the app depends on these policies.
-- ================================================================

-- 1. nadi_infra_reports: "infra_reports_insert_own" only checked user_id, so any
--    signed-in user could insert a report already 'verified' with 99 verifications,
--    skipping the 016 guard. The two extra public reads duplicate "anon read infra reports".
DROP POLICY IF EXISTS "infra_reports_insert_own" ON public.nadi_infra_reports;
DROP POLICY IF EXISTS "anon read infra" ON public.nadi_infra_reports;
DROP POLICY IF EXISTS "infra_reports_public_read" ON public.nadi_infra_reports;

-- 2. nadi_jobs / nadi_vendors: USING (true) reads cancelled the hidden = false spam
--    filter, and CHECK (true) inserts let users post with any user_id and any link.
DROP POLICY IF EXISTS "Public read jobs" ON public.nadi_jobs;
DROP POLICY IF EXISTS "jobs_insert_auth" ON public.nadi_jobs;
DROP POLICY IF EXISTS "anon read vendors" ON public.nadi_vendors;
DROP POLICY IF EXISTS "vendors_insert_auth" ON public.nadi_vendors;

--    Columns /api/komuniti writes but the live tables never had: every post failed
--    and fell into the old in-memory fallback, so listings vanished on cold start.
ALTER TABLE public.nadi_jobs
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "applyUrl" TEXT DEFAULT '';
ALTER TABLE public.nadi_vendors
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION DEFAULT 0;

-- 3. nadi_pps_corrections: CHECK (true) let any signed-in user insert a row already
--    'approved', which moves that shelter's pin for everyone. USING (true) exposed
--    every citizen's notes and user_id. The strict policies beside them stay.
DROP POLICY IF EXISTS "Public insert pps_corrections" ON public.nadi_pps_corrections;
DROP POLICY IF EXISTS "Public read pps_corrections" ON public.nadi_pps_corrections;

-- 4. Direct writes that skipped the API's validation, rate limits and AI moderation.
DROP POLICY IF EXISTS "Allow anonymous bantuan request inserts" ON public.nadi_bantuan_requests;
DROP POLICY IF EXISTS "readings_ingest_insert" ON public.nadi_bencana_sensor_readings;
DROP POLICY IF EXISTS "anon insert sensors" ON public.nadi_bencana_sensors;
DROP POLICY IF EXISTS "Users can insert own jobs" ON public.nadi_bencana_jobs;
DROP POLICY IF EXISTS "Owner can update own jobs" ON public.nadi_bencana_jobs;
DROP POLICY IF EXISTS "Owner can delete own jobs" ON public.nadi_bencana_jobs;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.nadi_bencana_jobs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.nadi_bencana_sensors FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.nadi_bencana_sensor_readings FROM anon, authenticated;

-- Duplicate public reads on sensors ("anon read sensors" stays)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.nadi_bencana_sensors;
DROP POLICY IF EXISTS "Public read bencana sensors" ON public.nadi_bencana_sensors;
