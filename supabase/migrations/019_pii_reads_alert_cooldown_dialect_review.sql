-- ================================================================
-- NADI Migration 019: Close personal-data reads, flood-alert cooldown, dialect review
--
-- The anon key ships to every browser, so any SELECT policy USING (true) is public
-- no matter what the API routes filter. Column grants below follow the 014 pattern:
-- a column-level grant only works after the table-level grant is revoked.
-- Columns are listed from information_schema so the grant matches the live table;
-- columns added later stay unreadable until granted (fail closed).
-- Clients must select named columns: select('*') fails once any column is hidden.
-- ================================================================

-- 1. nadi_bencana_jobs: SOS requesters' phone numbers were world-readable.
--    The app reads jobs through /api/bencana/jobs (service role), which omits phone.
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ') INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'nadi_bencana_jobs'
    AND column_name <> 'phone';
  REVOKE SELECT ON public.nadi_bencana_jobs FROM anon, authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.nadi_bencana_jobs TO anon, authenticated', cols);
END $$;

-- 2. nadi_infra_reports: device fingerprint + speed let anyone track a driver's
--    routes and speeding history. The Aduan feed and map never show them.
--    ponytail: user_id, exact lat/lng, photos and transcripts stay public because the
--    Aduan feed shows them. Move the feed to a view with coarse location if that changes.
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ') INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'nadi_infra_reports'
    AND column_name NOT IN ('device_fingerprint', 'speed_kmh', 'gyro_max_rotation', 'waveform_duration_ms');
  REVOKE SELECT ON public.nadi_infra_reports FROM anon, authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.nadi_infra_reports TO anon, authenticated', cols);
END $$;

-- 3. nadi_bencana_chat: rescue chats (addresses, phone numbers) were world-readable
--    and streamed over Realtime. Only the job's poster and volunteer may read or post.
--    Messages are keyed by job_id (added in 008); old rows without job_id stay
--    visible to their own sender only.
DROP POLICY IF EXISTS "Public read bencana chat" ON public.nadi_bencana_chat;
DROP POLICY IF EXISTS "Job participants read chat" ON public.nadi_bencana_chat;
CREATE POLICY "Job participants read chat"
  ON public.nadi_bencana_chat FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.nadi_bencana_jobs j
      WHERE j.id = nadi_bencana_chat.job_id
        AND auth.uid() IN (j.posted_by, j.accepted_by)
    )
  );

DROP POLICY IF EXISTS "Users can insert own chat" ON public.nadi_bencana_chat;
CREATE POLICY "Users can insert own chat"
  ON public.nadi_bencana_chat FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.nadi_bencana_jobs j
      WHERE j.id = nadi_bencana_chat.job_id
        AND auth.uid() IN (j.posted_by, j.accepted_by)
    )
  );

-- 4. nadi_bencana_sensors: Telegram alert cooldown lives on the row, so parallel
--    serverless instances can't double-send (claimed with one conditional UPDATE).
ALTER TABLE public.nadi_bencana_sensors
  ADD COLUMN IF NOT EXISTS last_alert_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_alert_status TEXT;

-- 5. nadi_dialect_feedback: corrections reach the AI prompt only after an officer
--    approves them in /admin. Existing rows were already live, so they stay approved.
ALTER TABLE public.nadi_dialect_feedback
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.nadi_dialect_feedback ALTER COLUMN approved SET DEFAULT false;

-- Writes and reads go through /api/dialect/feedback and /api/admin (service role only).
DROP POLICY IF EXISTS "Vetted insert feedback" ON public.nadi_dialect_feedback;
DROP POLICY IF EXISTS "Admin select feedback" ON public.nadi_dialect_feedback;
