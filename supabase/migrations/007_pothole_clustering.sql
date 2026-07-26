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

-- 7. RPC function for spatial clustering queries
-- Called by the clustering API: find all reports within N meters of a point
CREATE OR REPLACE FUNCTION find_nearby_infra_reports(
  target_lng DOUBLE PRECISION,
  target_lat DOUBLE PRECISION,
  radius_meters INTEGER,
  since TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  lat TEXT,
  lng TEXT,
  device_fingerprint TEXT,
  user_id UUID,
  cluster_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    r.id,
    r.lat,
    r.lng,
    r.device_fingerprint,
    r.user_id,
    r.cluster_id,
    r.created_at
  FROM public.nadi_infra_reports r
  WHERE r.location IS NOT NULL
    AND r.created_at >= since
    AND ST_DWithin(
      r.location,
      ST_SetSRID(ST_MakePoint(target_lng, target_lat), 4326)::geography,
      radius_meters
    )
  ORDER BY r.created_at DESC;
$$;
