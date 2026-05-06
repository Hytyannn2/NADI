'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// ===== DAILY QUESTS (Feature 4) =====
export interface Quest {
  id: string; title: string; description: string; xpReward: number;
  type: 'report' | 'flood' | 'listing' | 'volunteer' | 'transit';
  completed: boolean;
}

// ===== ACHIEVEMENT BADGES (Feature 6) =====
export interface Badge {
  id: string; name: string; description: string; icon: string;
  condition: string; unlocked: boolean; unlockedAt?: string;
}

const DEFAULT_BADGES: Badge[] = [
  { id: 'civic_hero', name: 'Civic Hero', description: 'Submit 10 civic reports', icon: '🏛️', condition: '10 reports', unlocked: false },
  { id: 'green_warrior', name: 'Green Warrior', description: 'Save 50kg CO₂ via transit', icon: '🌿', condition: '50kg CO₂', unlocked: false },
  { id: 'first_responder', name: 'First Responder', description: 'Accept 5 volunteer jobs', icon: '🚨', condition: '5 volunteer jobs', unlocked: false },
  { id: 'market_maker', name: 'Market Maker', description: 'Post 10 Niaga listings', icon: '📦', condition: '10 listings', unlocked: false },
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
    { id: 'q5', title: 'Take a Transit Ride', description: 'Scan QR to ride public transit', xpReward: 20, type: 'transit', completed: false },
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
  stats: { reports: number; volunteersAccepted: number; listingsPosted: number; communityPosts: number; questDaysComplete: number };
  incrementStat: (stat: keyof GameContextType['stats']) => void;
}

const GameContext = createContext<GameContextType>({
  quests: [], completeQuest: () => {}, allQuestsComplete: false, bonusCollected: false, collectBonus: () => {},
  badges: DEFAULT_BADGES, unlockBadge: () => {},
  crs: 0, crsLabel: 'New Member', updateCRS: () => {},
  leaderboard: [],
  stats: { reports: 0, volunteersAccepted: 0, listingsPosted: 0, communityPosts: 0, questDaysComplete: 0 },
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
  const [stats, setStats] = useState({ reports: 0, volunteersAccepted: 0, listingsPosted: 0, communityPosts: 0, questDaysComplete: 0 });

  useEffect(() => {
    try {
      const today = new Date().toDateString();
      const saved = localStorage.getItem('nadi_quests');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.date === today) {
          setQuests(data.quests);
          setBonusCollected(data.bonusCollected || false);
        } else {
          const newQ = generateDailyQuests();
          setQuests(newQ);
          localStorage.setItem('nadi_quests', JSON.stringify({ date: today, quests: newQ, bonusCollected: false }));
        }
      } else {
        const newQ = generateDailyQuests();
        setQuests(newQ);
        localStorage.setItem('nadi_quests', JSON.stringify({ date: today, quests: newQ, bonusCollected: false }));
      }
      const savedBadges = localStorage.getItem('nadi_badges');
      if (savedBadges) setBadges(JSON.parse(savedBadges));
      const savedStats = localStorage.getItem('nadi_stats');
      if (savedStats) setStats(JSON.parse(savedStats));
      const savedCrs = localStorage.getItem('nadi_crs');
      if (savedCrs) setCrs(parseInt(savedCrs));
    } catch {}
  }, []);

  const completeQuest = (type: Quest['type']) => {
    setQuests(prev => {
      const updated = prev.map(q => q.type === type && !q.completed ? { ...q, completed: true } : q);
      const today = new Date().toDateString();
      localStorage.setItem('nadi_quests', JSON.stringify({ date: today, quests: updated, bonusCollected }));
      return updated;
    });
  };

  const collectBonus = () => {
    setBonusCollected(true);
    const today = new Date().toDateString();
    localStorage.setItem('nadi_quests', JSON.stringify({ date: today, quests, bonusCollected: true }));
  };

  const unlockBadge = (id: string) => {
    setBadges(prev => {
      const updated = prev.map(b => b.id === id && !b.unlocked ? { ...b, unlocked: true, unlockedAt: new Date().toISOString() } : b);
      localStorage.setItem('nadi_badges', JSON.stringify(updated));
      return updated;
    });
  };

  const updateCRS = (xp: number, trustScore: number, streak: number) => {
    const score = calculateCRS(xp, trustScore, streak, badges);
    setCrs(score);
    try { localStorage.setItem('nadi_crs', score.toString()); } catch {}
  };

  const incrementStat = (stat: keyof typeof stats) => {
    setStats(prev => {
      const updated = { ...prev, [stat]: prev[stat] + 1 };
      localStorage.setItem('nadi_stats', JSON.stringify(updated));
      // Auto-unlock badges
      if (updated.reports >= 10) unlockBadge('civic_hero');
      if (updated.volunteersAccepted >= 5) unlockBadge('first_responder');
      if (updated.listingsPosted >= 10) unlockBadge('market_maker');
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
