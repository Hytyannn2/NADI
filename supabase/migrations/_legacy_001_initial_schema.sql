
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USER PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    mykad_number TEXT UNIQUE,
    mykad_verified BOOLEAN DEFAULT FALSE,
    district TEXT DEFAULT 'Kota Bharu',
    mukim TEXT,
    pin_hash TEXT, -- hashed PIN for wallet security

    -- Gamification
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    streak INTEGER DEFAULT 0,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_reports INTEGER DEFAULT 0,
    total_volunteer_hours REAL DEFAULT 0,

    -- Civic Reputation
    crs INTEGER DEFAULT 0, -- Civic Reputation Score (0-1000)
    trust_score INTEGER DEFAULT 50, -- Trust score (0-100)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_new_user();

-- ============================================
-- 2. WALLET (E-Dinar / NadiPass)
-- ============================================
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    balance REAL DEFAULT 0.00,
    co2_saved REAL DEFAULT 0.0,
    total_rides INTEGER DEFAULT 0,
    ride_streak INTEGER DEFAULT 0,
    last_ride TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================
-- 3. WALLET TRANSACTIONS (Ledger)
-- ============================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('topup', 'spend', 'reward', 'transit')),
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT DEFAULT 'General',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. CIVIC REPORTS (Suara + Infra)
-- ============================================
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('suara', 'infra', 'bencana')),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT, -- e.g. 'pothole', 'flood', 'road_damage'
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),

    -- Location
    latitude REAL,
    longitude REAL,
    address TEXT,
    district TEXT,

    -- Media
    image_url TEXT,
    ai_analysis TEXT, -- Gemini/Groq analysis result

    -- AI metadata
    dialect_detected TEXT, -- for Suara voice reports
    ai_category TEXT,
    ai_priority TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. VOLUNTEER JOBS (Bencana)
-- ============================================
CREATE TABLE IF NOT EXISTS public.volunteer_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    posted_by UUID REFERENCES public.profiles(id),
    name TEXT NOT NULL, -- household or org name
    requirement TEXT NOT NULL,
    distance TEXT,
    area TEXT NOT NULL,
    priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'completed', 'cancelled')),
    accepted_by UUID REFERENCES public.profiles(id),
    bounty INTEGER DEFAULT 0, -- XP bounty for completion

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. BANTUAN (Aid Requests — Gotong-Royong)
-- ============================================
CREATE TABLE IF NOT EXISTS public.bantuan_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('need', 'offer')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    contact TEXT,
    fulfilled BOOLEAN DEFAULT FALSE,
    fulfilled_by UUID REFERENCES public.profiles(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. COMMUNITY FEED
-- ============================================
CREATE TABLE IF NOT EXISTS public.community_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    likes INTEGER DEFAULT 0,
    flagged BOOLEAN DEFAULT FALSE,

    -- Location context
    latitude REAL,
    longitude REAL,
    district TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 8. BADGES (User achievements)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    badge_id TEXT NOT NULL, -- e.g. 'civic_hero', 'green_warrior'
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);

-- ============================================
-- 9. DAILY QUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.daily_quests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    quest_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quest_id TEXT NOT NULL, -- e.g. 'q1', 'q2'
    title TEXT NOT NULL,
    description TEXT,
    xp_reward INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, quest_date, quest_id)
);

-- ============================================
-- 10. LEADERBOARD (materialized view)
-- ============================================
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    p.xp,
    p.level,
    p.crs,
    p.district,
    p.total_reports,
    RANK() OVER (ORDER BY p.crs DESC) as rank_position
FROM public.profiles p
WHERE p.xp > 0
ORDER BY p.crs DESC
LIMIT 100;

-- ============================================
-- 11. WHISTLEBLOWER (anonymous reports)
-- ============================================
CREATE TABLE IF NOT EXISTS public.whistleblower_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- No user_id for anonymity!
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT,
    severity TEXT DEFAULT 'medium',
    ai_assessment TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'escalated', 'resolved')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON public.transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_user ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_district ON public.reports(district);
CREATE INDEX IF NOT EXISTS idx_volunteer_jobs_status ON public.volunteer_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bantuan_type ON public.bantuan_requests(type);
CREATE INDEX IF NOT EXISTS idx_bantuan_fulfilled ON public.bantuan_requests(fulfilled);
CREATE INDEX IF NOT EXISTS idx_community_district ON public.community_posts(district);
CREATE INDEX IF NOT EXISTS idx_profiles_district ON public.profiles(district);
CREATE INDEX IF NOT EXISTS idx_profiles_crs ON public.profiles(crs DESC);
CREATE INDEX IF NOT EXISTS idx_daily_quests_date ON public.daily_quests(user_id, quest_date);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bantuan_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whistleblower_reports ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Wallets: user can only see & update own
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Transactions: user can view & create own
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Reports: everyone can view, user can create own
CREATE POLICY "Reports are viewable by everyone" ON public.reports FOR SELECT USING (true);
CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reports" ON public.reports FOR UPDATE USING (auth.uid() = user_id);

-- Volunteer jobs: everyone can view, user can create/accept
CREATE POLICY "Volunteer jobs are viewable by everyone" ON public.volunteer_jobs FOR SELECT USING (true);
CREATE POLICY "Users can create volunteer jobs" ON public.volunteer_jobs FOR INSERT WITH CHECK (auth.uid() = posted_by);
CREATE POLICY "Users can update volunteer jobs" ON public.volunteer_jobs FOR UPDATE USING (true);

-- Bantuan: everyone can view, user can create own
CREATE POLICY "Bantuan requests are viewable by everyone" ON public.bantuan_requests FOR SELECT USING (true);
CREATE POLICY "Users can create bantuan requests" ON public.bantuan_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update bantuan requests" ON public.bantuan_requests FOR UPDATE USING (true);

-- Community: everyone can view, user can create own
CREATE POLICY "Community posts are viewable by everyone" ON public.community_posts FOR SELECT USING (true);
CREATE POLICY "Users can create community posts" ON public.community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Badges: user can view own
CREATE POLICY "Users can view own badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Daily quests: user can view/update own
CREATE POLICY "Users can view own quests" ON public.daily_quests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own quests" ON public.daily_quests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quests" ON public.daily_quests FOR UPDATE USING (auth.uid() = user_id);

-- Whistleblower: anyone can create, only admins can view (via service role)
CREATE POLICY "Anyone can submit whistleblower reports" ON public.whistleblower_reports FOR INSERT WITH CHECK (true);
