-- Migration 009: Create missing tables + drop unused tables
-- Date: 2026-08-17
-- Purpose: Fix database audit gaps

-- ============================================
-- 1. CREATE nadi_whistleblower_reports
-- (Code already writes to this table but it didn't exist)
-- ============================================
CREATE TABLE IF NOT EXISTS nadi_whistleblower_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT DEFAULT 'Undisclosed',
    image TEXT,
    status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewing', 'resolved', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Allow anonymous inserts (whistleblower submissions must be anonymous)
ALTER TABLE nadi_whistleblower_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous whistleblower inserts" ON nadi_whistleblower_reports;
CREATE POLICY "Allow anonymous whistleblower inserts"
    ON nadi_whistleblower_reports FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated reads for admins" ON nadi_whistleblower_reports;
CREATE POLICY "Allow authenticated reads for admins"
    ON nadi_whistleblower_reports FOR SELECT
    USING (auth.role() = 'authenticated');

-- ============================================
-- 2. CREATE nadi_bantuan_requests
-- (Was in-memory only — data lost on every restart)
-- ============================================
CREATE TABLE IF NOT EXISTS nadi_bantuan_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secret_token TEXT NOT NULL,
    poster TEXT DEFAULT 'Anonymous Warga',
    type TEXT DEFAULT 'need' CHECK (type IN ('need', 'offer')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    contact TEXT DEFAULT '',
    fulfilled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Allow anonymous inserts + public reads (excluding secret_token via select)
ALTER TABLE nadi_bantuan_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous bantuan request inserts" ON nadi_bantuan_requests;
CREATE POLICY "Allow anonymous bantuan request inserts"
    ON nadi_bantuan_requests FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public reads of bantuan requests" ON nadi_bantuan_requests;
CREATE POLICY "Allow public reads of bantuan requests"
    ON nadi_bantuan_requests FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow anonymous bantuan request updates" ON nadi_bantuan_requests;
CREATE POLICY "Allow anonymous bantuan request updates"
    ON nadi_bantuan_requests FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 3. DROP UNUSED TABLES
-- (Exist in Supabase but no code references them)
-- ============================================
DROP TABLE IF EXISTS nadi_badges CASCADE;
DROP TABLE IF EXISTS nadi_config CASCADE;
DROP TABLE IF EXISTS nadi_export_audit CASCADE;
DROP TABLE IF EXISTS nadi_mission_attendance CASCADE;
DROP TABLE IF EXISTS nadi_mission_qr_tokens CASCADE;
DROP TABLE IF EXISTS nadi_missions CASCADE;
DROP TABLE IF EXISTS nadi_profiles CASCADE;
DROP TABLE IF EXISTS nadi_quests CASCADE;
DROP TABLE IF EXISTS nadi_spam_reports CASCADE;
DROP TABLE IF EXISTS nadi_stats CASCADE;

-- ============================================
-- 4. PUBLIC READ RLS POLICIES FOR MAP & CIVIC DATA
-- (Eliminates 403s when anonymous users browse the map layers)
-- ============================================
ALTER TABLE IF EXISTS public.nadi_bencana_centers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon read centers" ON public.nadi_bencana_centers;
DROP POLICY IF EXISTS "Public read centers" ON public.nadi_bencana_centers;
CREATE POLICY "anon read centers" ON public.nadi_bencana_centers FOR SELECT USING (true);

ALTER TABLE IF EXISTS public.nadi_bencana_sensors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon read sensors" ON public.nadi_bencana_sensors;
DROP POLICY IF EXISTS "Public read sensors" ON public.nadi_bencana_sensors;
CREATE POLICY "anon read sensors" ON public.nadi_bencana_sensors FOR SELECT USING (true);

ALTER TABLE IF EXISTS public.nadi_vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon read vendors" ON public.nadi_vendors;
DROP POLICY IF EXISTS "Public read vendors" ON public.nadi_vendors;
CREATE POLICY "anon read vendors" ON public.nadi_vendors FOR SELECT USING (true);

ALTER TABLE IF EXISTS public.nadi_bencana_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon read jobs" ON public.nadi_bencana_jobs;
DROP POLICY IF EXISTS "Public read bencana jobs" ON public.nadi_bencana_jobs;
CREATE POLICY "anon read jobs" ON public.nadi_bencana_jobs FOR SELECT USING (true);

ALTER TABLE IF EXISTS public.nadi_bencana_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon read zones" ON public.nadi_bencana_zones;
DROP POLICY IF EXISTS "Public read zones" ON public.nadi_bencana_zones;
CREATE POLICY "anon read zones" ON public.nadi_bencana_zones FOR SELECT USING (true);

ALTER TABLE IF EXISTS public.nadi_infra_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon read infra reports" ON public.nadi_infra_reports;
DROP POLICY IF EXISTS "Public read infra reports" ON public.nadi_infra_reports;
CREATE POLICY "anon read infra reports" ON public.nadi_infra_reports FOR SELECT USING (true);


