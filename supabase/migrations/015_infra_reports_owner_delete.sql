-- ================================================================
-- NADI Migration 015: Let report owners delete their own infra reports
-- RLS on nadi_infra_reports (011) had SELECT/INSERT/UPDATE policies but no
-- DELETE policy, so the Aduan "Padam Aduan" action was silently rejected
-- (0 rows deleted, no error). Mirrors the owner-only UPDATE policy from 004.
-- Anonymous reports (user_id IS NULL) stay undeletable from the client.
-- ================================================================

DROP POLICY IF EXISTS "Owner can delete own infra reports" ON public.nadi_infra_reports;
CREATE POLICY "Owner can delete own infra reports"
  ON public.nadi_infra_reports FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
