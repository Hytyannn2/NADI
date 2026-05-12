-- ============================================
-- NADI Migration 002: Wallet & Transactions
-- E-Dinar / NadiPass wallet + ledger
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
