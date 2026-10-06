-- ============================================================================
-- Migration 018: Fix /admin "Gagal memuatkan data semakan."
--
-- 1. AduanView, PotholeDetectorContext and /api/admin all use
--    nadi_infra_reports.title, but no migration ever created it. Every report
--    insert failed with 42703, so the table stayed empty.
-- 2. nadi_admin_audit_logs (016) was created without a grant for service_role,
--    so /api/admin got "permission denied" reading and writing the audit log.
--    anon/authenticated stay locked out (016 revoked them).
-- ============================================================================

ALTER TABLE public.nadi_infra_reports ADD COLUMN IF NOT EXISTS title TEXT;

GRANT SELECT, INSERT ON public.nadi_admin_audit_logs TO service_role;

-- Make PostgREST pick up the new column right away
NOTIFY pgrst, 'reload schema';
