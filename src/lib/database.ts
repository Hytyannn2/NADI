import { createClient } from '@/src/lib/supabase/client';

// ===== Database helper for all NADI operations =====
// Use these functions in components & API routes instead of raw fetch calls

const supabase = createClient();

// ===== PROFILES =====
export async function getProfile(userId: string) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    return { data, error };
}

export async function updateProfile(userId: string, updates: Record<string, any>) {
    const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();
    return { data, error };
}

// ===== WALLET =====
export async function getWallet(userId: string) {
    const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();
    return { data, error };
}

export async function ensureWallet(userId: string) {
    const { data: existing } = await getWallet(userId);
    if (existing) return { data: existing, error: null };

    const { data, error } = await supabase
        .from('wallets')
        .insert({ user_id: userId })
        .select()
        .single();
    return { data, error };
}

export async function updateWalletBalance(userId: string, amount: number, type: 'add' | 'subtract') {
    const { data: wallet } = await getWallet(userId);
    if (!wallet) return { data: null, error: 'Wallet not found' };

    const newBalance = type === 'add' ? wallet.balance + amount : wallet.balance - amount;
    if (newBalance < 0) return { data: null, error: 'Insufficient balance' };

    const { data, error } = await supabase
        .from('wallets')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select()
        .single();
    return { data, error };
}

// ===== TRANSACTIONS =====
export async function getTransactions(userId: string, limit = 20) {
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
    return { data, error };
}

export async function createTransaction(walletId: string, userId: string, tx: {
    type: 'topup' | 'spend' | 'reward' | 'transit';
    title: string;
    amount: number;
    category?: string;
    notes?: string;
}) {
    const { data, error } = await supabase
        .from('transactions')
        .insert({ wallet_id: walletId, user_id: userId, ...tx })
        .select()
        .single();
    return { data, error };
}

// ===== REPORTS =====
export async function getReports(filters?: { district?: string; type?: string; status?: string }, limit = 50) {
    let query = supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(limit);
    if (filters?.district) query = query.eq('district', filters.district);
    if (filters?.type) query = query.eq('type', filters.type);
    if (filters?.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    return { data, error };
}

export async function createReport(userId: string, report: {
    type: 'suara' | 'infra' | 'bencana';
    title: string;
    description?: string;
    category?: string;
    severity?: string;
    latitude?: number;
    longitude?: number;
    address?: string;
    district?: string;
    image_url?: string;
    ai_analysis?: string;
    dialect_detected?: string;
}) {
    const { data, error } = await supabase
        .from('reports')
        .insert({ user_id: userId, ...report })
        .select()
        .single();
    return { data, error };
}

// ===== VOLUNTEER JOBS =====
export async function getVolunteerJobs(status?: string) {
    let query = supabase.from('volunteer_jobs').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    return { data, error };
}

export async function createVolunteerJob(postedBy: string, job: {
    name: string;
    requirement: string;
    distance?: string;
    area: string;
    priority?: string;
    bounty?: number;
}) {
    const { data, error } = await supabase
        .from('volunteer_jobs')
        .insert({ posted_by: postedBy, ...job })
        .select()
        .single();
    return { data, error };
}

export async function acceptVolunteerJob(jobId: string, userId: string) {
    const { data, error } = await supabase
        .from('volunteer_jobs')
        .update({ status: 'accepted', accepted_by: userId, updated_at: new Date().toISOString() })
        .eq('id', jobId)
        .select()
        .single();
    return { data, error };
}

// ===== BANTUAN =====
export async function getBantuanRequests(limit = 50) {
    const { data, error } = await supabase
        .from('bantuan_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    return { data, error };
}

export async function createBantuanRequest(userId: string, req: {
    type: 'need' | 'offer';
    title: string;
    description: string;
    location: string;
    category?: string;
    contact?: string;
}) {
    const { data, error } = await supabase
        .from('bantuan_requests')
        .insert({ user_id: userId, ...req })
        .select()
        .single();
    return { data, error };
}

export async function fulfillBantuanRequest(requestId: string, fulfilledBy: string) {
    const { data, error } = await supabase
        .from('bantuan_requests')
        .update({ fulfilled: true, fulfilled_by: fulfilledBy, updated_at: new Date().toISOString() })
        .eq('id', requestId)
        .select()
        .single();
    return { data, error };
}

// ===== COMMUNITY =====
export async function getCommunityPosts(district?: string, limit = 50) {
    let query = supabase.from('community_posts').select('*, profiles(full_name, avatar_url)').order('created_at', { ascending: false }).limit(limit);
    if (district) query = query.eq('district', district);
    const { data, error } = await query;
    return { data, error };
}

export async function createCommunityPost(userId: string, post: {
    content: string;
    category?: string;
    latitude?: number;
    longitude?: number;
    district?: string;
}) {
    const { data, error } = await supabase
        .from('community_posts')
        .insert({ user_id: userId, ...post })
        .select()
        .single();
    return { data, error };
}

// ===== BADGES =====
export async function getUserBadges(userId: string) {
    const { data, error } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', userId);
    return { data, error };
}

export async function unlockBadge(userId: string, badgeId: string) {
    const { data, error } = await supabase
        .from('user_badges')
        .upsert({ user_id: userId, badge_id: badgeId })
        .select()
        .single();
    return { data, error };
}

// ===== DAILY QUESTS =====
export async function getTodayQuests(userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('daily_quests')
        .select('*')
        .eq('user_id', userId)
        .eq('quest_date', today);
    return { data, error };
}

export async function completeQuest(userId: string, questId: string) {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('daily_quests')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('quest_date', today)
        .eq('quest_id', questId)
        .select()
        .single();
    return { data, error };
}

// ===== LEADERBOARD =====
export async function getLeaderboard(limit = 20) {
    const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .limit(limit);
    return { data, error };
}

// ===== GAMIFICATION: Add XP =====
export async function addUserXP(userId: string, amount: number) {
    const { data: profile } = await getProfile(userId);
    if (!profile) return { data: null, error: 'Profile not found' };

    const XP_PER_LEVEL = 200;
    let newXP = profile.xp + amount;
    let newLevel = profile.level;
    let leveledUp = false;

    while (newXP >= XP_PER_LEVEL) {
        newXP -= XP_PER_LEVEL;
        newLevel++;
        leveledUp = true;
    }

    const { data, error } = await updateProfile(userId, {
        xp: newXP,
        level: newLevel,
        last_active: new Date().toISOString(),
    });

    return { data, error, leveledUp, newLevel };
}
