-- ============================================
-- NADI Migration 007
-- Pothole Detection: Sensor Fusion + Crowdsource Clustering
-- Adds columns for speed, gyroscope, confidence scoring,
-- spatial clustering via PostGIS, and dashcam snapshots
-- ============================================

-- 1. Enable PostGIS for ultra-fast spatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add sensor fusion columns to infra reports
ALTER TABLE public.nadi_infra_reports
  ADD COLUMN IF NOT EXISTS speed_kmh REAL,
  ADD COLUMN IF NOT EXISTS gyro_max_rotation REAL,
  ADD COLUMN IF NOT EXISTS waveform_duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cluster_id UUID,
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS snapshot_base64 TEXT;

-- 3. Add PostGIS geography column for spatial clustering
-- This enables ST_DWithin queries (e.g., find all reports within 15 meters)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'nadi_infra_reports' 
      AND column_name = 'location'
  ) THEN
    ALTER TABLE public.nadi_infra_reports 
      ADD COLUMN location geography(POINT, 4326);
  END IF;
END $$;

-- 4. Backfill location column from existing lat/lng text columns
UPDATE public.nadi_infra_reports
SET location = ST_SetSRID(ST_MakePoint(lng::double precision, lat::double precision), 4326)::geography
WHERE location IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;

-- 5. Create trigger to auto-populate location on INSERT/UPDATE
CREATE OR REPLACE FUNCTION populate_infra_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng::double precision, NEW.lat::double precision), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_populate_infra_location ON public.nadi_infra_reports;
CREATE TRIGGER trg_populate_infra_location
  BEFORE INSERT OR UPDATE ON public.nadi_infra_reports
  FOR EACH ROW
  EXECUTE FUNCTION populate_infra_location();

-- 6. Create indexes for fast spatial and cluster queries
CREATE INDEX IF NOT EXISTS idx_infra_reports_location
  ON public.nadi_infra_reports USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_infra_reports_cluster
  ON public.nadi_infra_reports (cluster_id);

CREATE INDEX IF NOT EXISTS idx_infra_reports_status_created
  ON public.nadi_infra_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_infra_reports_confidence
  ON public.nadi_infra_reports (confidence_score);

-- 7. Atomic RPC for Spatial Clustering
-- Atomically groups a new report into an existing cluster within 15 meters,
-- or creates a new cluster ID if none exist.
-- Enforces concurrency control to prevent duplicate clusters.
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
  -- Lock the spatial grid lookup using an advisory transaction lock.
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

  -- 4. Count unique devices in this cluster
  SELECT COUNT(DISTINCT COALESCE(device_fingerprint, user_id::text, id::text)) INTO v_unique_devices
  FROM public.nadi_infra_reports
  WHERE cluster_id = v_cluster_id;

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
