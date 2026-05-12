-- ============================================
-- NADI Migration 001: User Profiles
-- Extends Supabase auth.users with civic data
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
