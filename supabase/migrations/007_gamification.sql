-- ============================================
-- NADI Migration 007: Gamification
-- Badges, daily quests, and leaderboard
-- ============================================

-- User Badges (achievements)
CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    badge_id TEXT NOT NULL, -- e.g. 'civic_hero', 'green_warrior'
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);

-- Daily Quests
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

-- Leaderboard (materialized view)
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
