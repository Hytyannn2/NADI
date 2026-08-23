-- Migration 008: Master Database Security & Performance Hardening
-- Hardens RLS insert identity matching, adds foreign key indexes, enforces spatial geography constraints, and optimizes TOAST storage.


-- ==========================================
-- 1. FIX RLS INSERT SPOOFING (CRITICAL SECURITY)
-- ==========================================
-- Problem: INSERT policies from 001/002/003 check auth.role() = 'authenticated'
-- but NOT that user_id matches auth.uid(). Allows identity spoofing.

-- Community Posts: Force user_id to match auth.uid()
DROP POLICY IF EXISTS "Auth users insert community posts" ON public.nadi_community_posts;
DROP POLICY IF EXISTS "Users can insert own posts" ON public.nadi_community_posts;
CREATE POLICY "Users can insert own posts"
  ON public.nadi_community_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Bencana Jobs: Force posted_by to match auth.uid()
DROP POLICY IF EXISTS "Auth users insert bencana jobs" ON public.nadi_bencana_jobs;
DROP POLICY IF EXISTS "Users can insert own jobs" ON public.nadi_bencana_jobs;
CREATE POLICY "Users can insert own jobs"
  ON public.nadi_bencana_jobs FOR INSERT
  WITH CHECK (auth.uid() = posted_by);

-- Bencana Chat: Force user_id to match auth.uid()
DROP POLICY IF EXISTS "Auth users insert chat" ON public.nadi_bencana_chat;
DROP POLICY IF EXISTS "Users can insert own chat" ON public.nadi_bencana_chat;
CREATE POLICY "Users can insert own chat"
  ON public.nadi_bencana_chat FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Infra Reports: Force user_id to match auth.uid()
DROP POLICY IF EXISTS "Auth users insert infra reports" ON public.nadi_infra_reports;
DROP POLICY IF EXISTS "Users can insert own infra reports" ON public.nadi_infra_reports;
CREATE POLICY "Users can insert own infra reports"
  ON public.nadi_infra_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ==========================================
-- 2. ADD MISSING FOREIGN KEY INDEXES (PERFORMANCE)
-- ==========================================
-- PostgreSQL does NOT auto-index FK columns. Without these, ON DELETE CASCADE
-- triggers O(N) sequential scans that lock tables and spike CPU.
-- (004 already created idx_jobs_posted_by, idx_community_posts_user, idx_infra_reports_user)

CREATE INDEX IF NOT EXISTS idx_badges_user
  ON public.nadi_badges (user_id);

CREATE INDEX IF NOT EXISTS idx_quests_user
  ON public.nadi_quests (user_id);

CREATE INDEX IF NOT EXISTS idx_chat_user
  ON public.nadi_bencana_chat (user_id);

CREATE INDEX IF NOT EXISTS idx_jobs_accepted_by
  ON public.nadi_bencana_jobs (accepted_by);


-- ==========================================
-- 3. CHAT JOB UUID LINK (DATA INTEGRITY)
-- ==========================================
-- Problem: 003 links chat messages by job_name TEXT instead of job_id UUID.
-- If two jobs share the same name or a job is renamed, messages become orphaned.

ALTER TABLE public.nadi_bencana_chat
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.nadi_bencana_jobs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_chat_job_id
  ON public.nadi_bencana_chat (job_id);


-- ==========================================
-- 4. POSTGIS GEOGRAPHY FOR EVACUATION CENTERS (PPS)
-- ==========================================
-- Problem: 006 added lat/lng DOUBLE PRECISION to PPS centers but no PostGIS
-- geography column or GIST index. "Find nearest 3 PPS" runs O(N) Haversine.

-- Add geography column
ALTER TABLE public.nadi_bencana_centers
  ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

-- Auto-populate geography from existing lat/lng data
UPDATE public.nadi_bencana_centers
SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE location IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;

-- Trigger to auto-sync geography on INSERT/UPDATE
CREATE OR REPLACE FUNCTION populate_center_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_populate_center_location ON public.nadi_bencana_centers;
CREATE TRIGGER trg_populate_center_location
  BEFORE INSERT OR UPDATE ON public.nadi_bencana_centers
  FOR EACH ROW
  EXECUTE FUNCTION populate_center_location();

-- GIST spatial index for O(log N) nearest-neighbor queries
CREATE INDEX IF NOT EXISTS idx_bencana_centers_location
  ON public.nadi_bencana_centers USING GIST (location);

-- KNN spatial RPC: find nearest evacuation centers from a citizen's GPS
CREATE OR REPLACE FUNCTION get_nearest_evac_centers(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  district TEXT,
  capacity INTEGER,
  type TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.district,
    c.capacity,
    c.type,
    c.lat,
    c.lng,
    ROUND(
      (ST_Distance(
        c.location,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
      ) / 1000.0)::numeric,
      2
    )::DOUBLE PRECISION AS distance_km
  FROM public.nadi_bencana_centers c
  WHERE c.location IS NOT NULL
  ORDER BY c.location <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  LIMIT p_limit;
END;
$$;


-- ==========================================
-- 5. GAMIFICATION LOCKDOWN (CRITICAL SECURITY)
-- ==========================================
-- Problem: "Users can update own profile" lets users SET xp = 999999 from client.
-- "Users can insert own badges" lets users INSERT arbitrary badges.
-- XP, trust_score, and badges must only be mutated by server-side logic.

-- 5a. Replace permissive profile UPDATE with column-restricted policy
-- Users can only update safe fields (mukim). XP/trust/CRS are server-only.
DROP POLICY IF EXISTS "Users can update own profile" ON public.nadi_profiles;
DROP POLICY IF EXISTS "Users can update safe profile fields" ON public.nadi_profiles;
CREATE POLICY "Users can update safe profile fields"
  ON public.nadi_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Ensure XP, trust_score, CRS, streak are NOT being changed by the client
    xp = (SELECT xp FROM public.nadi_profiles WHERE id = auth.uid())
    AND trust_score = (SELECT trust_score FROM public.nadi_profiles WHERE id = auth.uid())
    AND crs = (SELECT crs FROM public.nadi_profiles WHERE id = auth.uid())
    AND streak = (SELECT streak FROM public.nadi_profiles WHERE id = auth.uid())
  );

-- 5b. Lock down badges — only server-side (service role) can grant badges
DROP POLICY IF EXISTS "Users can insert own badges" ON public.nadi_badges;
-- No replacement INSERT policy for authenticated users.
-- Service role bypasses RLS and can still insert badges.

-- 5c. Lock down stats — only server-side can update stats
DROP POLICY IF EXISTS "Users can update own stats" ON public.nadi_stats;
-- No replacement UPDATE policy for authenticated users.
-- Service role bypasses RLS and can still update stats.

-- 5d. Server-side RPC for awarding XP (called from Edge Functions or API routes)
CREATE OR REPLACE FUNCTION award_xp(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT DEFAULT 'action'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with table owner privileges, bypassing RLS
AS $$
DECLARE
  v_new_xp INTEGER;
BEGIN
  -- Validate: only positive XP awards
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'XP amount must be positive');
  END IF;

  -- Atomically increment XP
  UPDATE public.nadi_profiles
  SET xp = xp + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING xp INTO v_new_xp;

  IF v_new_xp IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  RETURN jsonb_build_object(
    'userId', p_user_id,
    'awarded', p_amount,
    'newXp', v_new_xp,
    'reason', p_reason
  );
END;
$$;


-- ==========================================
-- 6. HARDENED SENSOR & INFRA CONSTRAINTS (DATA INTEGRITY)
-- ==========================================
-- API validates these ranges, but the DB must be the final source of truth.

DO $$
BEGIN
  -- Sensor constraints & uniqueness
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_sensor_name') THEN
    ALTER TABLE public.nadi_bencana_sensors
      ADD CONSTRAINT uq_sensor_name UNIQUE (name);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sensor_battery') THEN
    ALTER TABLE public.nadi_bencana_sensors
      ADD CONSTRAINT chk_sensor_battery CHECK (battery_pct IS NULL OR (battery_pct >= 0 AND battery_pct <= 100));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sensor_humidity') THEN
    ALTER TABLE public.nadi_bencana_sensors
      ADD CONSTRAINT chk_sensor_humidity CHECK (humidity_pct IS NULL OR (humidity_pct >= 0 AND humidity_pct <= 100));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sensor_rssi') THEN
    ALTER TABLE public.nadi_bencana_sensors
      ADD CONSTRAINT chk_sensor_rssi CHECK (rssi_dbm IS NULL OR (rssi_dbm >= -140 AND rssi_dbm <= 0));
  END IF;

  -- Infra report constraints
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_infra_confidence') THEN
    ALTER TABLE public.nadi_infra_reports
      ADD CONSTRAINT chk_infra_confidence CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_infra_speed') THEN
    ALTER TABLE public.nadi_infra_reports
      ADD CONSTRAINT chk_infra_speed CHECK (speed_kmh IS NULL OR speed_kmh >= 0);
  END IF;
END
$$;


-- ==========================================
-- 7. FIX CLUSTERING RPC DEVICE COUNT LOOPHOLE (ANTI-SYBIL)
-- ==========================================
-- Problem: COALESCE(device_fingerprint, user_id::text, id::text) means every
-- unfingerprinted anonymous report counts as a unique device (via id fallback).
-- Fix: Only count DISTINCT device_fingerprint where it's NOT NULL.
-- Anonymous reports still cluster but don't inflate the verification count.

CREATE OR REPLACE FUNCTION atomic_cluster_pothole(
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
  v_radius_meters FLOAT := 15.0;
  v_unique_devices INTEGER;
  v_is_verified BOOLEAN := false;
BEGIN
  -- Lock the spatial grid tile using an advisory transaction lock.
  -- hashtext on a 6-character geohash serializes transactions for a ~1.2km x 0.6km area.
  PERFORM pg_advisory_xact_lock(hashtext(ST_GeoHash(ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), 6)));

  -- 1. Find if a pothole cluster already exists within 15 meters (last 48 hours)
  SELECT cluster_id INTO v_cluster_id
  FROM public.nadi_infra_reports
  WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    v_radius_meters
  )
  AND cluster_id IS NOT NULL
  AND created_at >= NOW() - INTERVAL '48 hours'
  ORDER BY created_at ASC
  LIMIT 1;

  -- 2. If no cluster exists, generate a new one
  IF v_cluster_id IS NULL THEN
    v_cluster_id := gen_random_uuid();
  END IF;

  -- 3. Assign this report to the cluster
  UPDATE public.nadi_infra_reports
  SET cluster_id = v_cluster_id
  WHERE id = p_report_id;

  -- 4. Count STRICTLY unique device fingerprints (no id::text fallback)
  -- Anonymous/unfingerprinted reports still cluster but don't inflate count
  SELECT COUNT(DISTINCT device_fingerprint) INTO v_unique_devices
  FROM public.nadi_infra_reports
  WHERE cluster_id = v_cluster_id
    AND device_fingerprint IS NOT NULL;

  -- 5. Auto-verify if threshold is met
  IF v_unique_devices >= p_threshold THEN
    v_is_verified := true;
    UPDATE public.nadi_infra_reports
    SET status = 'verified'
    WHERE cluster_id = v_cluster_id;
  END IF;

  -- 6. Return structured result
  RETURN jsonb_build_object(
    'clusterId', v_cluster_id,
    'uniqueDevices', v_unique_devices,
    'threshold', p_threshold,
    'isVerified', v_is_verified
  );
END;
$$;


-- ==========================================
-- 8. TOAST STORAGE OPTIMIZATION (PERFORMANCE)
-- ==========================================
-- Problem: snapshot_base64 TEXT (200KB–1MB Base64 images) stored inline in the
-- main table heap. Every SELECT * scans massive payloads, degrading PostGIS
-- spatial query performance.
-- Fix: EXTERNAL storage forces out-of-line TOAST without inline compression.

ALTER TABLE public.nadi_infra_reports
  ALTER COLUMN snapshot_base64 SET STORAGE EXTERNAL;


-- ==========================================
-- 9. DIALECT AI LEARNED FEEDBACK STORE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.nadi_dialect_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dialect_text TEXT NOT NULL,
  correct_meaning TEXT,
  region TEXT DEFAULT 'kelantan',
  is_positive BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nadi_dialect_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public select feedback" ON public.nadi_dialect_feedback;
CREATE POLICY "Public select feedback" ON public.nadi_dialect_feedback FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert feedback" ON public.nadi_dialect_feedback;
CREATE POLICY "Public insert feedback" ON public.nadi_dialect_feedback FOR INSERT WITH CHECK (true);



-- =============================================================================
-- MIGRATION 008 COMPLETE
-- =============================================================================
-- Summary:
-- [1] RLS Spoofing     — 4 INSERT policies now enforce auth.uid() = owner_column
-- [2] FK Indexes       — 4 missing B-Tree indexes prevent CASCADE table locks
-- [3] Chat UUID Link   — job_id FK column + index replaces fragile job_name TEXT
-- [4] PPS PostGIS      — Geography column, GIST index, KNN RPC for O(log N) search
-- [5] Gamification     — XP/trust/badges locked to server-side only via SECURITY DEFINER RPC
-- [6] Sensor Guards    — CHECK constraints on battery, humidity, RSSI, confidence, speed
-- [7] Clustering Fix   — Removed id::text fallback loophole in device count
-- [8] TOAST            — snapshot_base64 moved to out-of-line storage
-- =============================================================================
