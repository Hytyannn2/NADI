-- Migration 011: Enable RLS on All NADI Tables
-- Fixes Supabase Security Advisor "rls_disabled_in_public" warning.
-- Note: System/Extension catalogs like spatial_ref_sys are managed by PostGIS and do not need manual ALTER.

-- 1. Enable RLS on nadi_jobs
ALTER TABLE IF EXISTS public.nadi_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read jobs" ON public.nadi_jobs;
DROP POLICY IF EXISTS "Public read jobs" ON public.nadi_jobs;
CREATE POLICY "Public read jobs" 
  ON public.nadi_jobs FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Service role manage jobs" ON public.nadi_jobs;
CREATE POLICY "Service role manage jobs" 
  ON public.nadi_jobs FOR ALL 
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2. Forcefully enable RLS on ALL active application tables
ALTER TABLE IF EXISTS public.nadi_bantuan_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.nadi_bencana_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.nadi_bencana_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.nadi_bencana_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.nadi_bencana_sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.nadi_bencana_sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.nadi_bencana_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.nadi_dialect_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.nadi_infra_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.nadi_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.nadi_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.nadi_whistleblower_reports ENABLE ROW LEVEL SECURITY;
