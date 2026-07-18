-- ============================================
-- NADI Migration 003
-- Creates table for Volunteer Chat Persistence
-- ============================================

CREATE TABLE IF NOT EXISTS public.nadi_bencana_chat (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL,
  text TEXT NOT NULL,
  sender TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.nadi_bencana_chat ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read bencana chat" ON public.nadi_bencana_chat;
CREATE POLICY "Public read bencana chat" ON public.nadi_bencana_chat FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth users insert chat" ON public.nadi_bencana_chat;
CREATE POLICY "Auth users insert chat" ON public.nadi_bencana_chat FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Enable realtime for chat table safely and idempotently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' 
      AND c.relname = 'nadi_bencana_chat'
      AND n.nspname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.nadi_bencana_chat;
  END IF;
END $$;
