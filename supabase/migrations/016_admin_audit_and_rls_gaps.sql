-- ============================================================================
-- Migration 016: Close remaining RLS gaps + admin audit log
--
-- Officer roles live in auth.users.raw_app_meta_data.role (same source 012 uses).
-- Users cannot edit app_metadata, so it is safe to trust from the JWT.
-- Roles: super_admin | bencana_officer (PPS) | infra_officer (Aduan)
--
-- Appoint an officer (SQL editor). They must sign out and in again to pick it up:
--   UPDATE auth.users
--   SET raw_app_meta_data = raw_app_meta_data || '{"role": "super_admin"}'::jsonb
--   WHERE email = 'pegawai@example.com';
-- ============================================================================

-- 1. award_xp (008) writes to nadi_profiles, which 009 dropped: dead, and
--    SECURITY DEFINER callable by anyone. Drop it.
DROP FUNCTION IF EXISTS public.award_xp(uuid, integer, text);

-- 2. Postgres grants EXECUTE to PUBLIC by default, so anyone could force-verify
--    a cluster with p_threshold = 0. Only called server-side with the service role.
DO $$
BEGIN
  IF to_regprocedure('public.atomic_cluster_pothole(uuid,double precision,double precision,text,integer)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.atomic_cluster_pothole(uuid, double precision, double precision, text, integer) FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

-- 2b. atomic_cluster_pothole counted DISTINCT device_fingerprint, which the client
--     picks freely: one user could insert 3 reports with 3 fingerprints and
--     self-verify. Count distinct user_id instead (RLS below pins it to auth.uid()).
--     p_fingerprint is kept only so the signature (and the REVOKE above) still match.
CREATE OR REPLACE FUNCTION public.atomic_cluster_pothole(
  p_report_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_fingerprint TEXT,
  p_threshold INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_cluster_id UUID;
  v_unique_users INTEGER;
  v_is_verified BOOLEAN := false;
BEGIN
  -- Serialise clustering per ~1.2km x 0.6km geohash tile
  PERFORM pg_advisory_xact_lock(hashtext(ST_GeoHash(ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), 6)));

  SELECT cluster_id INTO v_cluster_id
  FROM public.nadi_infra_reports
  WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, 15.0)
    AND cluster_id IS NOT NULL
    AND created_at >= NOW() - INTERVAL '48 hours'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_cluster_id IS NULL THEN
    v_cluster_id := gen_random_uuid();
  END IF;

  UPDATE public.nadi_infra_reports SET cluster_id = v_cluster_id WHERE id = p_report_id;

  SELECT COUNT(DISTINCT user_id) INTO v_unique_users
  FROM public.nadi_infra_reports
  WHERE cluster_id = v_cluster_id AND user_id IS NOT NULL;

  IF v_unique_users >= p_threshold THEN
    v_is_verified := true;
    UPDATE public.nadi_infra_reports SET status = 'verified'
    WHERE cluster_id = v_cluster_id AND status = 'pending';
  END IF;

  RETURN jsonb_build_object(
    'clusterId', v_cluster_id,
    'uniqueDevices', v_unique_users,
    'threshold', p_threshold,
    'isVerified', v_is_verified
  );
END;
$$;
-- CREATE OR REPLACE keeps existing grants, but run the revoke again to be safe.
REVOKE EXECUTE ON FUNCTION public.atomic_cluster_pothole(uuid, double precision, double precision, text, integer) FROM PUBLIC, anon, authenticated;

-- 3. Infra reports: citizens could insert or update their own report as
--    'verified'. Status is now officer-only (via /api/admin).
DROP POLICY IF EXISTS "Users can insert own infra reports" ON public.nadi_infra_reports;
CREATE POLICY "Users can insert own infra reports"
  ON public.nadi_infra_reports FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND cluster_id IS NULL
    AND COALESCE(verifications, 1) <= 1
  );

-- Owners may still edit dialect feedback and attach a dashcam snapshot, nothing else.
-- (Table-level revoke first: a column grant means nothing while a table grant exists.)
REVOKE UPDATE ON public.nadi_infra_reports FROM anon, authenticated;
GRANT UPDATE (ai_analysis, snapshot_base64) ON public.nadi_infra_reports TO authenticated;

-- 4. PPS corrections: anyone could insert a row already 'approved' and move an
--    evacuation centre pin on every user's map.
DROP POLICY IF EXISTS "Authenticated users can submit pps corrections" ON public.nadi_pps_corrections;
CREATE POLICY "Authenticated users can submit pps corrections"
  ON public.nadi_pps_corrections FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

-- 5. Admin audit log. Service role only: no policies, no grants.
CREATE TABLE IF NOT EXISTS public.nadi_admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,          -- e.g. 'PPS_APPROVE', 'INFRA_RESOLVE'
  target_table TEXT NOT NULL,
  target_id TEXT NOT NULL,
  changes JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.nadi_admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON public.nadi_admin_audit_logs(admin_id);

ALTER TABLE public.nadi_admin_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nadi_admin_audit_logs FROM anon, authenticated;
