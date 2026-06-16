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
CREATE POLICY "Public read bencana chat" ON public.nadi_bencana_chat FOR SELECT USING (true);
CREATE POLICY "Auth users insert chat" ON public.nadi_bencana_chat FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Enable realtime for chat table
begin;
  -- remove the table from the publication if it already exists, to avoid errors
  alter publication supabase_realtime drop table public.nadi_bencana_chat;
commit;
alter publication supabase_realtime add table public.nadi_bencana_chat;
