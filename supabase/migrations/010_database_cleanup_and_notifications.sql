-- Migration 010: Database Cleanup & Notifications Setup
-- 1. Drops the outdated/dead table (nadi_community_posts)
-- 2. Drops the orphan auth trigger that was causing signup errors
-- 3. Creates the missing nadi_notifications table with public read RLS

-- ============================================
-- 1. DROP OUTDATED TABLE
-- ============================================
DROP TABLE IF EXISTS public.nadi_community_posts CASCADE;

-- ============================================
-- 2. FIX ORPHAN AUTH TRIGGER
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================
-- 3. CREATE MISSING NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.nadi_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT DEFAULT 'info', -- 'info' | 'warning' | 'alert' | 'bencana'
  district TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.nadi_notifications ENABLE ROW LEVEL SECURITY;

-- Allow public read access
DROP POLICY IF EXISTS "anon read notifications" ON public.nadi_notifications;
DROP POLICY IF EXISTS "Public read notifications" ON public.nadi_notifications;
CREATE POLICY "anon read notifications"
  ON public.nadi_notifications FOR SELECT
  USING (true);

-- Allow service role full write access
DROP POLICY IF EXISTS "Service role manage notifications" ON public.nadi_notifications;
CREATE POLICY "Service role manage notifications"
  ON public.nadi_notifications FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Seed initial welcome & system notification
INSERT INTO public.nadi_notifications (title, body, type, district)
VALUES 
  ('Selamat Datang ke NADI Kelantan', 'Sistem operasi sivik dan pemantauan bencana pintar sedia berkhidmat.', 'info', 'Kota Bharu'),
  ('Status Cuaca & Paras Air', 'Sistem pemantauan telemetri IoT sungai beroperasi dalam mod pemantauan aktif.', 'info', 'Kelantan')
ON CONFLICT DO NOTHING;
