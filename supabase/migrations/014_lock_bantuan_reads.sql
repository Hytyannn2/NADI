-- ================================================================
-- NADI Migration 014: Lock down nadi_bantuan_requests reads
-- 009 created "Allow public reads" (SELECT USING true), so anyone with the
-- anon key could read contact phone numbers and secret_token via PostgREST.
-- All app reads go through /api/bantuan/* with the service role, which
-- bypasses RLS and grants, so nothing in the app depends on public SELECT.
-- ================================================================

DROP POLICY IF EXISTS "Allow public reads of bantuan requests" ON public.nadi_bantuan_requests;

-- Table-level revoke: a column-level REVOKE does nothing while a table grant exists.
REVOKE SELECT ON public.nadi_bantuan_requests FROM anon, authenticated;
