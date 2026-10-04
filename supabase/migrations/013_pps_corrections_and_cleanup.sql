-- ============================================================================
-- Migration 013: PPS Corrections & Database Cleanup
-- 1. Drops obsolete and redundant table 'nadi_bencana_centers' (replaced by client-side 600+ Kelantan dataset)
-- 2. Creates 'nadi_pps_corrections' table for crowdsourced and admin PPS coordinate verifications
-- ============================================================================

-- 1. DROP OBSOLETE TABLE & TRIGGERS
DROP TRIGGER IF EXISTS trg_populate_center_location ON public.nadi_bencana_centers;
DROP FUNCTION IF EXISTS populate_center_location();
DROP TABLE IF EXISTS public.nadi_bencana_centers CASCADE;

-- 2. CREATE PPS CORRECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.nadi_pps_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_name TEXT NOT NULL,
    jajahan TEXT NOT NULL,
    suggested_lat DOUBLE PRECISION NOT NULL,
    suggested_lng DOUBLE PRECISION NOT NULL,
    notes TEXT,
    source TEXT DEFAULT 'community',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. INDICES FOR FAST RETRIEVAL & FILTERING
CREATE INDEX IF NOT EXISTS idx_pps_corrections_status ON public.nadi_pps_corrections(status);
CREATE INDEX IF NOT EXISTS idx_pps_corrections_jajahan ON public.nadi_pps_corrections(jajahan);
CREATE INDEX IF NOT EXISTS idx_pps_corrections_center_name ON public.nadi_pps_corrections(center_name);
CREATE INDEX IF NOT EXISTS idx_pps_corrections_created_at ON public.nadi_pps_corrections(created_at DESC);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.nadi_pps_corrections ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to submit PPS verifications
DROP POLICY IF EXISTS "Authenticated users can submit pps corrections" ON public.nadi_pps_corrections;
CREATE POLICY "Authenticated users can submit pps corrections"
    ON public.nadi_pps_corrections FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow public and authenticated users to read approved verifications, or their own submissions
DROP POLICY IF EXISTS "Public read approved pps corrections" ON public.nadi_pps_corrections;
CREATE POLICY "Public read approved pps corrections"
    ON public.nadi_pps_corrections FOR SELECT
    USING (
        status = 'approved' 
        OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    );

-- Allow service role and admins to read all
DROP POLICY IF EXISTS "Service role read all pps corrections" ON public.nadi_pps_corrections;
CREATE POLICY "Service role read all pps corrections"
    ON public.nadi_pps_corrections FOR SELECT
    TO service_role
    USING (true);

-- Allow service role to update
DROP POLICY IF EXISTS "Service role update pps corrections" ON public.nadi_pps_corrections;
CREATE POLICY "Service role update pps corrections"
    ON public.nadi_pps_corrections FOR UPDATE
    TO service_role
    USING (true);
