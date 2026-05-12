-- ============================================
-- NADI Migration 006: Community Feed
-- Geo-fenced community posts
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
