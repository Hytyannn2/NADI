-- ============================================
-- NADI Migration 008: Whistleblower Reports
-- Anonymous civic reporting (no user_id link)
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
