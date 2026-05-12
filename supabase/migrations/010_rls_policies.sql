-- ============================================
-- NADI Migration 010: Row Level Security
-- All RLS policies for data access control
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bantuan_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whistleblower_reports ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Wallets: user can only see & update own
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Transactions: user can view & create own
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Reports: everyone can view, user can create own
CREATE POLICY "Reports are viewable by everyone" ON public.reports FOR SELECT USING (true);
CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reports" ON public.reports FOR UPDATE USING (auth.uid() = user_id);

-- Volunteer jobs: everyone can view, user can create/accept
CREATE POLICY "Volunteer jobs are viewable by everyone" ON public.volunteer_jobs FOR SELECT USING (true);
CREATE POLICY "Users can create volunteer jobs" ON public.volunteer_jobs FOR INSERT WITH CHECK (auth.uid() = posted_by);
CREATE POLICY "Users can update volunteer jobs" ON public.volunteer_jobs FOR UPDATE USING (true);

-- Bantuan: everyone can view, user can create own
CREATE POLICY "Bantuan requests are viewable by everyone" ON public.bantuan_requests FOR SELECT USING (true);
CREATE POLICY "Users can create bantuan requests" ON public.bantuan_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update bantuan requests" ON public.bantuan_requests FOR UPDATE USING (true);

-- Community: everyone can view, user can create own
CREATE POLICY "Community posts are viewable by everyone" ON public.community_posts FOR SELECT USING (true);
CREATE POLICY "Users can create community posts" ON public.community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Badges: user can view own
CREATE POLICY "Users can view own badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Daily quests: user can view/update own
CREATE POLICY "Users can view own quests" ON public.daily_quests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own quests" ON public.daily_quests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quests" ON public.daily_quests FOR UPDATE USING (auth.uid() = user_id);

-- Whistleblower: anyone can create, only admins can view (via service role)
CREATE POLICY "Anyone can submit whistleblower reports" ON public.whistleblower_reports FOR INSERT WITH CHECK (true);
