-- ============================================
-- NADI Migration 002
-- Creates tables for LoRaWAN sensors and Infra anomaly reports
-- ============================================

-- 1. Create Bencana Sensors Table (LoRaWAN)
CREATE TABLE IF NOT EXISTS public.nadi_bencana_sensors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  water_level REAL NOT NULL DEFAULT 0.0,
  status TEXT DEFAULT 'safe',
  last_reading TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.nadi_bencana_sensors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read bencana sensors" ON public.nadi_bencana_sensors;
CREATE POLICY "Public read bencana sensors" ON public.nadi_bencana_sensors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth users update sensors" ON public.nadi_bencana_sensors;
CREATE POLICY "Auth users update sensors" ON public.nadi_bencana_sensors FOR ALL USING (auth.role() = 'authenticated');

-- Insert a default sensor for the simulation
INSERT INTO public.nadi_bencana_sensors (name, location, water_level, status)
SELECT 'Sungai Kelantan Node A', 'Kota Bharu', 2.1, 'safe'
WHERE NOT EXISTS (SELECT 1 FROM public.nadi_bencana_sensors WHERE name = 'Sungai Kelantan Node A');


-- 2. Create Infra Reports Table
CREATE TABLE IF NOT EXISTS public.nadi_infra_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lat TEXT NOT NULL,
  lng TEXT NOT NULL,
  z_dropped REAL NOT NULL,
  verifications INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  ai_analysis JSONB,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.nadi_infra_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read infra reports" ON public.nadi_infra_reports;
CREATE POLICY "Public read infra reports" ON public.nadi_infra_reports FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth users insert infra reports" ON public.nadi_infra_reports;
CREATE POLICY "Auth users insert infra reports" ON public.nadi_infra_reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth users update infra reports" ON public.nadi_infra_reports;
CREATE POLICY "Auth users update infra reports" ON public.nadi_infra_reports FOR UPDATE USING (auth.role() = 'authenticated');

-- Enable realtime for both tables safely and idempotently
DO $$
BEGIN
  -- Add nadi_bencana_sensors if not already present in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' 
      AND c.relname = 'nadi_bencana_sensors'
      AND n.nspname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.nadi_bencana_sensors;
  END IF;

  -- Add nadi_infra_reports if not already present in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' 
      AND c.relname = 'nadi_infra_reports'
      AND n.nspname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.nadi_infra_reports;
  END IF;
END $$;
