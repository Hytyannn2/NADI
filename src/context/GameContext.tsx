'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/src/lib/supabase/client';
import { useAuth } from '@/src/context/AuthContext';

// ===== DAILY QUESTS (Feature 4) =====
export interface Quest {
  id: string; title: string; description: string; xpReward: number;
  type: 'report' | 'flood' | 'listing' | 'volunteer' | 'community';
  completed: boolean;
}

// ===== ACHIEVEMENT BADGES (Feature 6) =====
export interface Badge {
  id: string; name: string; description: string; icon: string;
  condition: string; unlocked: boolean; unlockedAt?: string;
}

const DEFAULT_BADGES: Badge[] = [
  { id: 'civic_hero', name: 'Civic Hero', description: 'Submit 10 civic reports', icon: '🏛️', condition: '10 reports', unlocked: false },
  { id: 'green_warrior', name: 'Warga Aktif', description: 'Complete 20 civic actions', icon: '🌿', condition: '20 actions', unlocked: false },
  { id: 'first_responder', name: 'First Responder', description: 'Accept 5 volunteer jobs', icon: '🚨', condition: '5 volunteer jobs', unlocked: false },
  { id: 'verified_rakyat', name: 'Verified Rakyat', description: 'Complete MyKad verification', icon: '✅', condition: 'MyKad scan', unlocked: false },
  { id: 'streak_master', name: 'Streak Master', description: '7-day login streak', icon: '🔥', condition: '7-day streak', unlocked: false },
  { id: 'quest_champion', name: 'Quest Champion', description: 'Complete all daily quests 3 times', icon: '⭐', condition: '3 full quest days', unlocked: false },
  { id: 'community_voice', name: 'Community Voice', description: 'Post 5 community feed items', icon: '📢', condition: '5 posts', unlocked: false },
];

function generateDailyQuests(): Quest[] {
  const pool: Quest[] = [
    { id: 'q1', title: 'Report 1 Issue', description: 'Submit an infrastructure report via Suara or Infra', xpReward: 25, type: 'report', completed: false },
    { id: 'q2', title: 'Check Flood Status', description: 'Open the Bencana tab and review sensor data', xpReward: 15, type: 'flood', completed: false },
    { id: 'q3', title: 'Check Aid Programs', description: 'Browse available aid in the Bantuan tab', xpReward: 20, type: 'listing', completed: false },
    { id: 'q4', title: 'Accept a Volunteer Job', description: 'Help your community by accepting a volunteer request', xpReward: 30, type: 'volunteer', completed: false },
    { id: 'q5', title: 'Help a Neighbour', description: 'Post in community feed or help someone in your kampung', xpReward: 20, type: 'community', completed: false },
  ];
  // Pick 3 random quests for today
  const shuffled = pool.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
}

// ===== CRS (Feature 7) =====
function calculateCRS(xp: number, trustScore: number, streak: number, badges: Badge[]): number {
  const xpComponent = Math.min(xp * 0.5, 300);
  const trustComponent = trustScore * 3;
  const streakComponent = Math.min(streak * 10, 100);
  const badgeComponent = badges.filter(b => b.unlocked).length * 25;
  return Math.min(1000, Math.round(xpComponent + trustComponent + streakComponent + badgeComponent));
}

function getCRSLabel(score: number): string {
  if (score >= 800) return 'Exemplary Citizen';
  if (score >= 600) return 'Active Contributor';
  if (score >= 400) return 'Engaged Warga';
  if (score >= 200) return 'Rising Citizen';
  return 'New Member';
}

interface GameContextType {
  quests: Quest[]; completeQuest: (type: Quest['type']) => void; allQuestsComplete: boolean; bonusCollected: boolean; collectBonus: () => void;
  badges: Badge[]; unlockBadge: (id: string) => void;
  crs: number; crsLabel: string; updateCRS: (xp: number, trustScore: number, streak: number) => void;
  // Leaderboard (Feature 5)
  leaderboard: { name: string; xp: number; mukim: string; rank: number }[];
  // Stats for badge tracking
  stats: { reports: number; volunteersAccepted: number; communityPosts: number; questDaysComplete: number };
  incrementStat: (stat: keyof GameContextType['stats']) => void;
}

const GameContext = createContext<GameContextType>({
  quests: [], completeQuest: () => {}, allQuestsComplete: false, bonusCollected: false, collectBonus: () => {},
  badges: DEFAULT_BADGES, unlockBadge: () => {},
  crs: 0, crsLabel: 'New Member', updateCRS: () => {},
  leaderboard: [],
  stats: { reports: 0, volunteersAccepted: 0, communityPosts: 0, questDaysComplete: 0 },
  incrementStat: () => {},
});

// Leaderboard is generated dynamically — in production, this would come from Supabase
function generateLeaderboard(userXp: number): { name: string; xp: number; mukim: string; rank: number }[] {
  return [
    { name: 'You', xp: userXp, mukim: 'Your Area', rank: 0 },
  ].sort((a, b) => b.xp - a.xp).map((u, i) => ({ ...u, rank: i + 1 }));
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [bonusCollected, setBonusCollected] = useState(false);
  const [badges, setBadges] = useState<Badge[]>(DEFAULT_BADGES);
  const [crs, setCrs] = useState(0);
  const [stats, setStats] = useState({ reports: 0, volunteersAccepted: 0, communityPosts: 0, questDaysComplete: 0 });

  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const [profRes, statsRes, badgesRes, questsRes] = await Promise.all([
        supabase.from('nadi_profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('nadi_stats').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('nadi_badges').select('*').eq('user_id', user.id),
        supabase.from('nadi_quests').select('*').eq('user_id', user.id).eq('quest_date', today).maybeSingle()
      ]);

      if (profRes.data) setCrs(profRes.data.crs || 0);
      
      if (statsRes.data) {
        setStats({
          reports: statsRes.data.reports || 0,
          volunteersAccepted: statsRes.data.volunteers_accepted || 0,
          communityPosts: statsRes.data.community_posts || 0,
          questDaysComplete: statsRes.data.quest_days_complete || 0,
        });
      }

      if (badgesRes.data) {
        const unlockedIds = badgesRes.data.map((b: any) => b.badge_id);
        setBadges(prev => prev.map(b => unlockedIds.includes(b.id) ? { ...b, unlocked: true } : b));
      }

      if (questsRes.data) {
        setQuests(questsRes.data.quests_data);
        setBonusCollected(questsRes.data.bonus_collected);
      } else {
        const newQ = generateDailyQuests();
        setQuests(newQ);
        await supabase.from('nadi_quests').insert({ user_id: user.id, quest_date: today, quests_data: newQ });
      }
    };
    
    loadData();
  }, [user]);

  const completeQuest = async (type: Quest['type']) => {
    if (!user) return;
    setQuests(prev => {
      const updated = prev.map(q => q.type === type && !q.completed ? { ...q, completed: true } : q);
      const today = new Date().toISOString().split('T')[0];
      supabase.from('nadi_quests').update({ quests_data: updated }).eq('user_id', user.id).eq('quest_date', today).then();
      return updated;
    });
  };

  const collectBonus = async () => {
    if (!user) return;
    setBonusCollected(true);
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('nadi_quests').update({ bonus_collected: true }).eq('user_id', user.id).eq('quest_date', today);
  };

  const unlockBadge = async (id: string) => {
    if (!user) return;
    setBadges(prev => {
      if (prev.find(b => b.id === id)?.unlocked) return prev;
      const updated = prev.map(b => b.id === id ? { ...b, unlocked: true, unlockedAt: new Date().toISOString() } : b);
      supabase.from('nadi_badges').insert({ user_id: user.id, badge_id: id }).then();
      return updated;
    });
  };

  const updateCRS = async (xp: number, trustScore: number, streak: number) => {
    if (!user) return;
    const score = calculateCRS(xp, trustScore, streak, badges);
    setCrs(score);
    await supabase.from('nadi_profiles').update({ crs: score, xp, trust_score: trustScore, streak }).eq('id', user.id);
  };

  const incrementStat = async (stat: keyof typeof stats) => {
    if (!user) return;
    
    setStats(prev => {
      const updated = { ...prev, [stat]: prev[stat] + 1 };
      
      const dbMapping: Record<string, string> = {
        reports: 'reports',
        volunteersAccepted: 'volunteers_accepted',
        communityPosts: 'community_posts',
        questDaysComplete: 'quest_days_complete'
      };
      
      supabase.from('nadi_stats').update({ [dbMapping[stat]]: updated[stat] }).eq('id', user.id).then();
      
      // Auto-unlock badges
      if (updated.reports >= 10) unlockBadge('civic_hero');
      if (updated.volunteersAccepted >= 5) unlockBadge('first_responder');
      if (updated.communityPosts >= 5) unlockBadge('community_voice');
      if (updated.questDaysComplete >= 3) unlockBadge('quest_champion');
      
      return updated;
    });
  };

  const allQuestsComplete = quests.length > 0 && quests.every(q => q.completed);
  const crsLabel = getCRSLabel(crs);

  return (
    <GameContext.Provider value={{
      quests, completeQuest, allQuestsComplete, bonusCollected, collectBonus,
      badges, unlockBadge,
      crs, crsLabel, updateCRS,
      leaderboard: generateLeaderboard(crs),
      stats, incrementStat,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() { return useContext(GameContext); }
