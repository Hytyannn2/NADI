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
CREATE POLICY "Public read bencana sensors" ON public.nadi_bencana_sensors FOR SELECT USING (true);
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
CREATE POLICY "Public read infra reports" ON public.nadi_infra_reports FOR SELECT USING (true);
CREATE POLICY "Auth users insert infra reports" ON public.nadi_infra_reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users update infra reports" ON public.nadi_infra_reports FOR UPDATE USING (auth.role() = 'authenticated');

-- Enable realtime for both tables
begin;
  alter publication supabase_realtime drop table public.nadi_bencana_sensors;
  alter publication supabase_realtime drop table public.nadi_infra_reports;
commit;
alter publication supabase_realtime add table public.nadi_bencana_sensors;
alter publication supabase_realtime add table public.nadi_infra_reports;
