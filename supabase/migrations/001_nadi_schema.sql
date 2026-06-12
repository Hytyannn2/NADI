-- ============================================
-- NADI Unified Schema Migration 001
-- This replaces all legacy migrations and creates
-- the active schema used by NADI Civic OS.
-- ============================================

-- 1. Create Profiles Table
CREATE TABLE IF NOT EXISTS public.nadi_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  xp INTEGER DEFAULT 0,
  trust_score INTEGER DEFAULT 50,
  crs INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  mukim TEXT DEFAULT 'Kota Bharu',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Stats Table
CREATE TABLE IF NOT EXISTS public.nadi_stats (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  reports INTEGER DEFAULT 0,
  volunteers_accepted INTEGER DEFAULT 0,
  community_posts INTEGER DEFAULT 0,
  quest_days_complete INTEGER DEFAULT 0
);

-- 3. Create Badges Table
CREATE TABLE IF NOT EXISTS public.nadi_badges (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id TEXT,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

-- 4. Create Quests Table
CREATE TABLE IF NOT EXISTS public.nadi_quests (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_date DATE DEFAULT CURRENT_DATE,
  quests_data JSONB NOT NULL,
  bonus_collected BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (user_id, quest_date)
);

-- 5. Community Posts Table
CREATE TABLE IF NOT EXISTS public.nadi_community_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  author TEXT DEFAULT 'Anonymous Warga',
  type TEXT DEFAULT 'general',
  upvotes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Bencana Volunteer Jobs Table
CREATE TABLE IF NOT EXISTS public.nadi_bencana_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  dist TEXT DEFAULT 'Unknown',
  req TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  bounty INTEGER DEFAULT 30,
  area TEXT DEFAULT 'Unknown',
  priority TEXT DEFAULT 'Medium',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Bencana Flood Zones Table
CREATE TABLE IF NOT EXISTS public.nadi_bencana_zones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  district TEXT NOT NULL,
  risk TEXT NOT NULL,
  river TEXT NOT NULL,
  historic_level TEXT NOT NULL,
  population INTEGER NOT NULL
);

-- 8. Bencana Evacuation Centers Table
CREATE TABLE IF NOT EXISTS public.nadi_bencana_centers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  type TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.nadi_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nadi_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nadi_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nadi_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nadi_community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nadi_bencana_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nadi_bencana_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nadi_bencana_centers ENABLE ROW LEVEL SECURITY;

-- Setup Security Policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.nadi_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.nadi_profiles;
CREATE POLICY "Users can read own profile" ON public.nadi_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.nadi_profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can read own stats" ON public.nadi_stats;
DROP POLICY IF EXISTS "Users can update own stats" ON public.nadi_stats;
CREATE POLICY "Users can read own stats" ON public.nadi_stats FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own stats" ON public.nadi_stats FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can read own badges" ON public.nadi_badges;
DROP POLICY IF EXISTS "Users can insert own badges" ON public.nadi_badges;
CREATE POLICY "Users can read own badges" ON public.nadi_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own badges" ON public.nadi_badges FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own quests" ON public.nadi_quests;
DROP POLICY IF EXISTS "Users can update own quests" ON public.nadi_quests;
DROP POLICY IF EXISTS "Users can insert own quests" ON public.nadi_quests;
CREATE POLICY "Users can read own quests" ON public.nadi_quests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own quests" ON public.nadi_quests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quests" ON public.nadi_quests FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read community posts" ON public.nadi_community_posts FOR SELECT USING (true);
CREATE POLICY "Public read bencana jobs" ON public.nadi_bencana_jobs FOR SELECT USING (true);
CREATE POLICY "Public read bencana zones" ON public.nadi_bencana_zones FOR SELECT USING (true);
CREATE POLICY "Public read bencana centers" ON public.nadi_bencana_centers FOR SELECT USING (true);

CREATE POLICY "Auth users insert community posts" ON public.nadi_community_posts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users insert bencana jobs" ON public.nadi_bencana_jobs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users update bencana jobs" ON public.nadi_bencana_jobs FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth users delete bencana jobs" ON public.nadi_bencana_jobs FOR DELETE USING (auth.role() = 'authenticated');

-- Auto-create Profile and Stats when a user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.nadi_profiles (id) VALUES (new.id) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.nadi_stats (id) VALUES (new.id) ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- SEED DATA: Insert default Kelantan Flood Zones if empty
INSERT INTO public.nadi_bencana_zones (district, risk, river, historic_level, population)
SELECT * FROM (VALUES 
    ('Kuala Krai', 'critical', 'Sungai Kelantan', '2014: 35m', 110000),
    ('Gua Musang', 'critical', 'Sungai Galas', '2014: 28m', 92000),
    ('Tanah Merah', 'high', 'Sungai Kelantan', '2014: 22m', 121000),
    ('Pasir Mas', 'high', 'Sungai Kelantan', '2022: 18m', 189000),
    ('Tumpat', 'high', 'Sungai Kelantan Delta', '2022: 15m', 155000),
    ('Kota Bharu', 'moderate', 'Sungai Kelantan', '2022: 12m', 491000),
    ('Machang', 'moderate', 'Sungai Kelantan tributary', '2021: 10m', 95000),
    ('Bachok', 'moderate', 'Coastal', '2022: 8m', 137000),
    ('Pasir Puteh', 'low', 'Sungai Semerak', '2021: 6m', 117000),
    ('Jeli', 'low', 'Sungai Pergau', '2020: 5m', 43000)
) AS v(district, risk, river, historic_level, population)
WHERE NOT EXISTS (SELECT 1 FROM public.nadi_bencana_zones);

-- SEED DATA: Insert default Kelantan Evac Centers if empty
INSERT INTO public.nadi_bencana_centers (name, district, capacity, type)
SELECT * FROM (VALUES 
    ('SK Kubang Kerian', 'Kota Bharu', 500, 'Sekolah'),
    ('Dewan MPKB', 'Kota Bharu', 300, 'Dewan'),
    ('SK Kuala Krai', 'Kuala Krai', 400, 'Sekolah'),
    ('Masjid Muhammadi', 'Kota Bharu', 800, 'Masjid'),
    ('SK Pasir Mas', 'Pasir Mas', 350, 'Sekolah'),
    ('Dewan Tanah Merah', 'Tanah Merah', 250, 'Dewan'),
    ('SK Gua Musang', 'Gua Musang', 300, 'Sekolah'),
    ('Dewan Tumpat', 'Tumpat', 200, 'Dewan'),
    ('SK Machang', 'Machang', 280, 'Sekolah'),
    ('Masjid Bachok', 'Bachok', 350, 'Masjid')
) AS v(name, district, capacity, type)
WHERE NOT EXISTS (SELECT 1 FROM public.nadi_bencana_centers);
