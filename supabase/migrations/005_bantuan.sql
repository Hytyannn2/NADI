-- ============================================
-- NADI Migration 005: Bantuan (Aid Requests)
-- Gotong-Royong mutual aid system
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
