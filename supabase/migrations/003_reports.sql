-- ============================================
-- NADI Migration 003: Civic Reports
-- Suara (voice) + Infra + Bencana reports
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
