-- ================================================================
-- NADI Security Hardening Migration 012
-- Remediates findings from Strix White-Box Penetration Test:
-- 1. Drops orphaned whistleblower tables (dead feature)
-- 2. Restricts nadi_bantuan_requests UPDATE policy (Token API mediated)
-- 3. Locks nadi_dialect_feedback direct PostgREST inserts to prevent prompt poisoning
-- ================================================================

-- 1. ORPHANED WHISTLEBLOWER PURGE
DROP TABLE IF EXISTS public.nadi_whistleblower_reports CASCADE;


-- 2. MUTUAL AID (BANTUAN) REQUESTS HARDENING
-- Drop the permissive anonymous UPDATE policy that allowed any user to alter assistance records without verification
ALTER TABLE IF EXISTS public.nadi_bantuan_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous bantuan request updates" ON public.nadi_bantuan_requests;
DROP POLICY IF EXISTS "Service role mediated bantuan updates" ON public.nadi_bantuan_requests;

-- Updates must strictly be mediated by backend API with secret_token verification (service_role)
CREATE POLICY "Service role mediated bantuan updates"
    ON public.nadi_bantuan_requests FOR UPDATE
    USING (
        (auth.jwt() ->> 'role' = 'service_role') OR
        (auth.jwt() -> 'app_metadata' ->> 'role' IN ('super_admin', 'welfare_officer'))
    );


-- 3. DIALECT FEEDBACK (SUARA / PROMPT POISONING DEFENSE) HARDENING
-- Close direct anonymous PostgREST insert and broad select on nadi_dialect_feedback
-- The application's /api/dialect/feedback API route already validates and persists vetted pairs using service_role
ALTER TABLE IF EXISTS public.nadi_dialect_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert feedback" ON public.nadi_dialect_feedback;
DROP POLICY IF EXISTS "Public select feedback" ON public.nadi_dialect_feedback;
DROP POLICY IF EXISTS "Vetted insert feedback" ON public.nadi_dialect_feedback;
DROP POLICY IF EXISTS "Admin select feedback" ON public.nadi_dialect_feedback;

-- Only service_role or authenticated users can insert into feedback via backend
CREATE POLICY "Vetted insert feedback"
    ON public.nadi_dialect_feedback FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'role' = 'service_role') OR
        (auth.role() = 'authenticated')
    );

-- Prevent unauthorized bulk harvesting of crowdsourced feedback
CREATE POLICY "Admin select feedback"
    ON public.nadi_dialect_feedback FOR SELECT
    USING (
        (auth.jwt() ->> 'role' = 'service_role') OR
        (auth.role() = 'authenticated')
    );
