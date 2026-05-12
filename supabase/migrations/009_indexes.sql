-- ============================================
-- NADI Migration 009: Performance Indexes
-- Consolidated index definitions
-- ============================================

CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON public.transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_user ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_district ON public.reports(district);
CREATE INDEX IF NOT EXISTS idx_volunteer_jobs_status ON public.volunteer_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bantuan_type ON public.bantuan_requests(type);
CREATE INDEX IF NOT EXISTS idx_bantuan_fulfilled ON public.bantuan_requests(fulfilled);
CREATE INDEX IF NOT EXISTS idx_community_district ON public.community_posts(district);
CREATE INDEX IF NOT EXISTS idx_profiles_district ON public.profiles(district);
CREATE INDEX IF NOT EXISTS idx_profiles_crs ON public.profiles(crs DESC);
CREATE INDEX IF NOT EXISTS idx_daily_quests_date ON public.daily_quests(user_id, quest_date);
