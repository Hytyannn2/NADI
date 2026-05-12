-- ============================================
-- NADI Migration 004: Volunteer Jobs
-- Bencana disaster response volunteer system
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
