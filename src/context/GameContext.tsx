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
  // ── Civic Reporting ──
  { id: 'civic_hero', name: 'Civic Hero', description: 'Submit 10 civic reports', icon: '🏛️', condition: '10 reports', unlocked: false },
  { id: 'report_rookie', name: 'Report Rookie', description: 'Submit your first report', icon: '📝', condition: '1 report', unlocked: false },
  { id: 'pothole_hunter', name: 'Pothole Hunter', description: 'Report 5 road issues', icon: '🕳️', condition: '5 road reports', unlocked: false },
  { id: 'watchdog', name: 'Watchdog', description: 'Submit 3 whistleblower reports', icon: '🐕', condition: '3 whistleblower reports', unlocked: false },
  { id: 'infrastructure_guru', name: 'Infrastructure Guru', description: 'Submit 25 infrastructure reports', icon: '🔧', condition: '25 infra reports', unlocked: false },
  { id: 'voice_of_reason', name: 'Voice of Reason', description: 'Use Suara voice reporting 10 times', icon: '🎙️', condition: '10 voice reports', unlocked: false },
  { id: 'sharp_eye', name: 'Sharp Eye', description: 'Report an issue with a photo attachment', icon: '📸', condition: 'photo report', unlocked: false },

  // ── Flood & Disaster ──
  { id: 'flood_watcher', name: 'Flood Watcher', description: 'Check the Bencana tab during a live alert', icon: '🌊', condition: 'bencana during alert', unlocked: false },
  { id: 'storm_chaser', name: 'Storm Chaser', description: 'Check flood status 10 times', icon: '⛈️', condition: '10 flood checks', unlocked: false },
  { id: 'evacuation_expert', name: 'Evacuation Expert', description: 'Review all evacuation centers in your district', icon: '🏥', condition: 'all evac centers', unlocked: false },
  { id: 'rain_reader', name: 'Rain Reader', description: 'Check weather data 20 times', icon: '☔', condition: '20 weather checks', unlocked: false },
  { id: 'sensor_sentinel', name: 'Sensor Sentinel', description: 'View LoRaWAN sensor data 5 times', icon: '📡', condition: '5 sensor views', unlocked: false },

  // ── Community ──
  { id: 'community_voice', name: 'Community Voice', description: 'Post 5 community feed items', icon: '📢', condition: '5 posts', unlocked: false },
  { id: 'first_post', name: 'First Post', description: 'Make your first community post', icon: '💬', condition: '1 post', unlocked: false },
  { id: 'social_butterfly', name: 'Social Butterfly', description: 'Post 25 community feed items', icon: '🦋', condition: '25 posts', unlocked: false },
  { id: 'upvote_king', name: 'Upvote King', description: 'Receive 50 upvotes on your posts', icon: '👑', condition: '50 upvotes received', unlocked: false },
  { id: 'gotong_royong', name: 'Gotong-Royong', description: 'Organize a community meetup or event', icon: '🤝', condition: 'organize event', unlocked: false },

  // ── Volunteering ──
  { id: 'first_responder', name: 'First Responder', description: 'Accept 5 volunteer jobs', icon: '🚨', condition: '5 volunteer jobs', unlocked: false },
  { id: 'helping_hand', name: 'Helping Hand', description: 'Accept your first volunteer job', icon: '🤲', condition: '1 volunteer job', unlocked: false },
  { id: 'super_volunteer', name: 'Super Volunteer', description: 'Accept 20 volunteer jobs', icon: '🦸', condition: '20 volunteer jobs', unlocked: false },
  { id: 'cleanup_crew', name: 'Cleanup Crew', description: 'Join 3 post-flood cleanup efforts', icon: '🧹', condition: '3 cleanup jobs', unlocked: false },
  { id: 'supply_runner', name: 'Supply Runner', description: 'Distribute supplies 5 times', icon: '📦', condition: '5 supply runs', unlocked: false },

  // ── Streaks & Dedication ──
  { id: 'streak_master', name: 'Streak Master', description: '7-day login streak', icon: '🔥', condition: '7-day streak', unlocked: false },
  { id: 'streak_legend', name: 'Streak Legend', description: '30-day login streak', icon: '💎', condition: '30-day streak', unlocked: false },
  { id: 'early_bird', name: 'Early Bird', description: 'Complete a quest before 8 AM', icon: '🌅', condition: 'quest before 8am', unlocked: false },
  { id: 'night_owl', name: 'Night Owl', description: 'Complete a quest after 10 PM', icon: '🦉', condition: 'quest after 10pm', unlocked: false },
  { id: 'quest_champion', name: 'Quest Champion', description: 'Complete all daily quests 3 times', icon: '⭐', condition: '3 full quest days', unlocked: false },
  { id: 'quest_maniac', name: 'Quest Maniac', description: 'Complete all daily quests 10 times', icon: '🏆', condition: '10 full quest days', unlocked: false },

  // ── Exploration & Milestones ──
  { id: 'green_warrior', name: 'Warga Aktif', description: 'Complete 20 civic actions', icon: '🌿', condition: '20 actions', unlocked: false },
  { id: 'explorer', name: 'Explorer', description: 'Visit all 5 tabs in one session', icon: '🧭', condition: 'all tabs visited', unlocked: false },
  { id: 'data_nerd', name: 'Data Nerd', description: 'View the Civic Heatmap 5 times', icon: '🗺️', condition: '5 heatmap views', unlocked: false },
  { id: 'aid_seeker', name: 'Aid Seeker', description: 'Browse Bantuan programs 10 times', icon: '🔍', condition: '10 bantuan views', unlocked: false },
  { id: 'level_5', name: 'Pejuang', description: 'Reach Level 5', icon: '⚔️', condition: 'level 5', unlocked: false },
  { id: 'level_10', name: 'Pahlawan', description: 'Reach Level 10', icon: '🛡️', condition: 'level 10', unlocked: false },
  { id: 'level_20', name: 'Legenda', description: 'Reach Level 20', icon: '👑', condition: 'level 20', unlocked: false },
  { id: 'crs_500', name: 'Trusted Citizen', description: 'Reach 500 CRS score', icon: '🏅', condition: 'CRS 500', unlocked: false },
  { id: 'crs_800', name: 'Exemplary Warga', description: 'Reach 800 CRS score', icon: '🎖️', condition: 'CRS 800', unlocked: false },
];

function generateDailyQuests(): Quest[] {
  const pool: Quest[] = [
    // ════════════ REPORT QUESTS ════════════
    { id: 'q_r01', title: 'Report 1 Issue', description: 'Submit an infrastructure report via Suara or Infra', xpReward: 25, type: 'report', completed: false },
    { id: 'q_r02', title: 'Whistleblower Action', description: 'Submit an anonymous report about an incident', xpReward: 40, type: 'report', completed: false },
    { id: 'q_r03', title: 'Report Pothole', description: 'File a report about road damage in your area', xpReward: 25, type: 'report', completed: false },
    { id: 'q_r04', title: 'Report Broken Streetlight', description: 'File a report for a malfunctioning streetlight', xpReward: 25, type: 'report', completed: false },
    { id: 'q_r05', title: 'Report Illegal Dumping', description: 'File a report about illegal waste dumping', xpReward: 30, type: 'report', completed: false },
    { id: 'q_r06', title: 'Suggest an Improvement', description: 'Submit an idea to improve local infrastructure', xpReward: 20, type: 'report', completed: false },
    { id: 'q_r07', title: 'Report Drain Blockage', description: 'File a report about a blocked or overflowing drain', xpReward: 25, type: 'report', completed: false },
    { id: 'q_r08', title: 'Flag Dangerous Road', description: 'Report a road hazard like a missing signage or barrier', xpReward: 30, type: 'report', completed: false },
    { id: 'q_r09', title: 'Report Noise Pollution', description: 'File a noise complaint for your neighborhood', xpReward: 20, type: 'report', completed: false },
    { id: 'q_r10', title: 'Voice Report via Suara', description: 'Use the Suara voice feature to report an issue', xpReward: 30, type: 'report', completed: false },
    { id: 'q_r11', title: 'Photo Evidence Report', description: 'Submit a report that includes a photo attachment', xpReward: 35, type: 'report', completed: false },
    { id: 'q_r12', title: 'Report Public Facility Issue', description: 'Report broken playground, park, or public toilet', xpReward: 25, type: 'report', completed: false },
    { id: 'q_r13', title: 'Report Vandalism', description: 'File a report about graffiti or property damage', xpReward: 25, type: 'report', completed: false },
    { id: 'q_r14', title: 'Report Water Leak', description: 'File a report about a burst pipe or water leak', xpReward: 30, type: 'report', completed: false },
    { id: 'q_r15', title: 'Report Stray Animals', description: 'Report stray or abandoned animals in your area', xpReward: 20, type: 'report', completed: false },
    { id: 'q_r16', title: 'Report Traffic Hazard', description: 'File a report about dangerous traffic conditions', xpReward: 30, type: 'report', completed: false },

    // ════════════ FLOOD / BENCANA QUESTS ════════════
    { id: 'q_f01', title: 'Check Flood Status', description: 'Open the Bencana tab and review sensor data', xpReward: 15, type: 'flood', completed: false },
    { id: 'q_f02', title: 'Monitor River Levels', description: 'Check the river level sensors in the Bencana tab', xpReward: 15, type: 'flood', completed: false },
    { id: 'q_f03', title: 'Review Evacuation Centers', description: 'Check the nearest evacuation centers in the Bencana tab', xpReward: 15, type: 'flood', completed: false },
    { id: 'q_f04', title: 'Check Weather Forecast', description: 'View the weather forecast in the Bencana tab', xpReward: 10, type: 'flood', completed: false },
    { id: 'q_f05', title: 'Share Flood Warning', description: 'Review the active warnings in the Bencana tab', xpReward: 20, type: 'flood', completed: false },
    { id: 'q_f06', title: 'Prepare Emergency Kit', description: 'Review emergency preparedness guidelines in Bencana', xpReward: 25, type: 'flood', completed: false },
    { id: 'q_f07', title: 'Check LoRaWAN Sensors', description: 'View the real-time sensor status in the Bencana tab', xpReward: 15, type: 'flood', completed: false },
    { id: 'q_f08', title: 'Map Your Route', description: 'Check evacuation routes on the Bencana map', xpReward: 20, type: 'flood', completed: false },
    { id: 'q_f09', title: 'Check AQI Levels', description: 'View the Air Quality Index in the weather panel', xpReward: 10, type: 'flood', completed: false },
    { id: 'q_f10', title: 'Review Hazard Zones', description: 'Browse the flood risk zones on the Bencana map', xpReward: 15, type: 'flood', completed: false },
    { id: 'q_f11', title: 'Weather Watch', description: 'Check the dashboard weather card for updates', xpReward: 10, type: 'flood', completed: false },
    { id: 'q_f12', title: 'Assess Flood Risk', description: 'Check the flood risk level for your location', xpReward: 20, type: 'flood', completed: false },
    { id: 'q_f13', title: 'Check Rainfall Data', description: 'Review today\'s rainfall measurements', xpReward: 10, type: 'flood', completed: false },
    { id: 'q_f14', title: 'Locate Safe Zones', description: 'Find the nearest safe areas on the Bencana map', xpReward: 15, type: 'flood', completed: false },
    { id: 'q_f15', title: 'Check Wind Speed', description: 'Review current wind conditions in your area', xpReward: 10, type: 'flood', completed: false },
    { id: 'q_f16', title: 'Review Disaster History', description: 'Check historical flood data for your district', xpReward: 20, type: 'flood', completed: false },

    // ════════════ BANTUAN / LISTING QUESTS ════════════
    { id: 'q_l01', title: 'Check Aid Programs', description: 'Browse available aid in the Bantuan tab', xpReward: 20, type: 'listing', completed: false },
    { id: 'q_l02', title: 'Explore Bantuan Khas', description: 'Check out the special aid programs in the Bantuan tab', xpReward: 20, type: 'listing', completed: false },
    { id: 'q_l03', title: 'Find Subsidies', description: 'Look for available subsidies in the Bantuan tab', xpReward: 20, type: 'listing', completed: false },
    { id: 'q_l04', title: 'Check Education Aid', description: 'Browse scholarships or education aid in Bantuan', xpReward: 20, type: 'listing', completed: false },
    { id: 'q_l05', title: 'Review Business Grants', description: 'Explore grants for small businesses in Bantuan', xpReward: 20, type: 'listing', completed: false },
    { id: 'q_l06', title: 'Share Aid Info', description: 'Find an aid program you can share with others', xpReward: 15, type: 'listing', completed: false },
    { id: 'q_l07', title: 'Check Healthcare Aid', description: 'Browse medical assistance programs in Bantuan', xpReward: 20, type: 'listing', completed: false },
    { id: 'q_l08', title: 'Explore Housing Aid', description: 'Look for housing assistance programs in Bantuan', xpReward: 20, type: 'listing', completed: false },
    { id: 'q_l09', title: 'Find Food Assistance', description: 'Browse food bank or nutrition programs in Bantuan', xpReward: 15, type: 'listing', completed: false },
    { id: 'q_l10', title: 'Check Senior Citizen Aid', description: 'Explore programs for warga emas in Bantuan', xpReward: 20, type: 'listing', completed: false },
    { id: 'q_l11', title: 'Review Youth Programs', description: 'Browse opportunities for young Malaysians', xpReward: 15, type: 'listing', completed: false },
    { id: 'q_l12', title: 'Check OKU Support', description: 'Find disability assistance programs in Bantuan', xpReward: 20, type: 'listing', completed: false },
    { id: 'q_l13', title: 'Find Emergency Relief', description: 'Browse emergency financial relief programs', xpReward: 20, type: 'listing', completed: false },
    { id: 'q_l14', title: 'Explore Skills Training', description: 'Browse free training and upskilling programs', xpReward: 15, type: 'listing', completed: false },
    { id: 'q_l15', title: 'Check Job Listings', description: 'Review available job opportunities in Bantuan', xpReward: 20, type: 'listing', completed: false },
    { id: 'q_l16', title: 'Find Childcare Support', description: 'Browse childcare or family support programs', xpReward: 15, type: 'listing', completed: false },

    // ════════════ VOLUNTEER QUESTS ════════════
    { id: 'q_v01', title: 'Accept a Volunteer Job', description: 'Help your community by accepting a volunteer request', xpReward: 30, type: 'volunteer', completed: false },
    { id: 'q_v02', title: 'Join Cleanup Crew', description: 'Accept a post-flood cleanup volunteer job', xpReward: 35, type: 'volunteer', completed: false },
    { id: 'q_v03', title: 'Distribute Supplies', description: 'Accept a food/supply distribution volunteer job', xpReward: 30, type: 'volunteer', completed: false },
    { id: 'q_v04', title: 'Help Elderly Neighbors', description: 'Accept a volunteer job assisting the elderly', xpReward: 30, type: 'volunteer', completed: false },
    { id: 'q_v05', title: 'Logistics Support', description: 'Accept a transportation/logistics volunteer job', xpReward: 35, type: 'volunteer', completed: false },
    { id: 'q_v06', title: 'First Aid Volunteer', description: 'Accept a medical/first-aid volunteer job', xpReward: 40, type: 'volunteer', completed: false },
    { id: 'q_v07', title: 'Teach a Skill', description: 'Volunteer to teach a skill to your community', xpReward: 35, type: 'volunteer', completed: false },
    { id: 'q_v08', title: 'Animal Rescue Help', description: 'Help with animal rescue or shelter operations', xpReward: 30, type: 'volunteer', completed: false },
    { id: 'q_v09', title: 'Tree Planting Day', description: 'Join a tree planting or environmental volunteer effort', xpReward: 35, type: 'volunteer', completed: false },
    { id: 'q_v10', title: 'School Volunteer', description: 'Volunteer at a local school or tuition center', xpReward: 30, type: 'volunteer', completed: false },
    { id: 'q_v11', title: 'Blood Donation Drive', description: 'Participate in a blood donation event', xpReward: 40, type: 'volunteer', completed: false },
    { id: 'q_v12', title: 'Community Patrol', description: 'Join a neighborhood safety patrol shift', xpReward: 30, type: 'volunteer', completed: false },
    { id: 'q_v13', title: 'Cook for Neighbors', description: 'Prepare meals for those in need in your area', xpReward: 35, type: 'volunteer', completed: false },
    { id: 'q_v14', title: 'Tech Help Volunteer', description: 'Help someone with technology or digital literacy', xpReward: 25, type: 'volunteer', completed: false },
    { id: 'q_v15', title: 'Heritage Preservation', description: 'Join a cultural or heritage preservation effort', xpReward: 35, type: 'volunteer', completed: false },
    { id: 'q_v16', title: 'Event Organizer', description: 'Help organize a community event or gotong-royong', xpReward: 40, type: 'volunteer', completed: false },

    // ════════════ COMMUNITY QUESTS ════════════
    { id: 'q_c01', title: 'Help a Neighbour', description: 'Post in community feed or help someone in your kampung', xpReward: 20, type: 'community', completed: false },
    { id: 'q_c02', title: 'Welcome a New Member', description: 'Post a welcoming message in the community feed', xpReward: 15, type: 'community', completed: false },
    { id: 'q_c03', title: 'Share Local News', description: 'Share an update about your area in the community feed', xpReward: 20, type: 'community', completed: false },
    { id: 'q_c04', title: 'Ask a Question', description: 'Ask for advice or recommendations in the community feed', xpReward: 10, type: 'community', completed: false },
    { id: 'q_c05', title: 'Praise a Local Business', description: 'Give a shoutout to a local shop in the community feed', xpReward: 20, type: 'community', completed: false },
    { id: 'q_c06', title: 'Organize a Meetup', description: 'Propose a gathering or gotong-royong in the community feed', xpReward: 30, type: 'community', completed: false },
    { id: 'q_c07', title: 'Share a Recipe', description: 'Share a traditional Malaysian recipe in the community feed', xpReward: 15, type: 'community', completed: false },
    { id: 'q_c08', title: 'Post a Safety Tip', description: 'Share a safety or preparedness tip with the community', xpReward: 20, type: 'community', completed: false },
    { id: 'q_c09', title: 'Recommend a Service', description: 'Recommend a local service (plumber, tutor, etc.)', xpReward: 15, type: 'community', completed: false },
    { id: 'q_c10', title: 'Report Good News', description: 'Share something positive happening in your area', xpReward: 20, type: 'community', completed: false },
    { id: 'q_c11', title: 'Start a Discussion', description: 'Start a discussion about a local civic topic', xpReward: 20, type: 'community', completed: false },
    { id: 'q_c12', title: 'Upvote 3 Posts', description: 'Show support by upvoting 3 community posts', xpReward: 10, type: 'community', completed: false },
    { id: 'q_c13', title: 'Share a Lost & Found', description: 'Post about a lost or found item in the community feed', xpReward: 15, type: 'community', completed: false },
    { id: 'q_c14', title: 'Cultural Exchange', description: 'Share something about your culture or heritage', xpReward: 20, type: 'community', completed: false },
    { id: 'q_c15', title: 'Thank a Volunteer', description: 'Post a thank-you message for a community volunteer', xpReward: 15, type: 'community', completed: false },
    { id: 'q_c16', title: 'Neighborhood Watch Post', description: 'Share a safety observation about your neighborhood', xpReward: 20, type: 'community', completed: false },
  ];

  // Seeded random based on date so quests stay consistent throughout the day
  const today = new Date().toISOString().slice(0, 10);
  let seed = 0;
  for (let i = 0; i < today.length; i++) seed += today.charCodeAt(i) * (i + 1);
  const seededRandom = (i: number) => {
    const x = Math.sin(seed + i) * 10000;
    return x - Math.floor(x);
  };

  // Shuffle with seeded random
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(i) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Pick 5 quests, ensuring at least one from each major category
  const categories: Quest['type'][] = ['report', 'flood', 'listing', 'volunteer', 'community'];
  const selected: Quest[] = [];
  for (const cat of categories) {
    const match = shuffled.find(q => q.type === cat && !selected.includes(q));
    if (match) selected.push(match);
  }

  return selected.slice(0, 5);
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
  quests: Quest[]; completeQuest: (type: Quest['type']) => Promise<number>; allQuestsComplete: boolean; bonusCollected: boolean; collectBonus: () => void;
  badges: Badge[]; unlockBadge: (id: string) => void;
  crs: number; crsLabel: string; updateCRS: (xp: number, trustScore: number, streak: number) => void;
  // Leaderboard (Feature 5)
  leaderboard: { name: string; xp: number; mukim: string; rank: number }[];
  // Stats for badge tracking
  stats: { reports: number; volunteersAccepted: number; communityPosts: number; questDaysComplete: number };
  incrementStat: (stat: keyof GameContextType['stats']) => void;
}

const GameContext = createContext<GameContextType>({
  quests: [], completeQuest: async () => 0, allQuestsComplete: false, bonusCollected: false, collectBonus: () => {},
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

  const completeQuest = async (type: Quest['type']): Promise<number> => {
    if (!user) return 0;
    
    let xpEarned = 0;
    let changed = false;

    setQuests(prev => {
      const updated = prev.map(q => {
        if (q.type === type && !q.completed) {
          changed = true;
          xpEarned += q.xpReward;
          return { ...q, completed: true };
        }
        return q;
      });

      if (changed) {
        const today = new Date().toISOString().split('T')[0];
        supabase.from('nadi_quests').update({ quests_data: updated }).eq('user_id', user.id).eq('quest_date', today).then();
      }
      return updated;
    });

    // Wait a brief moment for setQuests callback to run synchronously
    await new Promise(r => setTimeout(r, 0));
    return xpEarned;
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
      if (updated.reports >= 1) unlockBadge('report_rookie');
      if (updated.reports >= 5) unlockBadge('pothole_hunter');
      if (updated.reports >= 10) unlockBadge('civic_hero');
      if (updated.reports >= 25) unlockBadge('infrastructure_guru');

      if (updated.volunteersAccepted >= 1) unlockBadge('helping_hand');
      if (updated.volunteersAccepted >= 5) unlockBadge('first_responder');
      if (updated.volunteersAccepted >= 20) unlockBadge('super_volunteer');

      if (updated.communityPosts >= 1) unlockBadge('first_post');
      if (updated.communityPosts >= 5) unlockBadge('community_voice');
      if (updated.communityPosts >= 25) unlockBadge('social_butterfly');

      if (updated.questDaysComplete >= 3) unlockBadge('quest_champion');
      if (updated.questDaysComplete >= 10) unlockBadge('quest_maniac');

      const totalActions = updated.reports + updated.volunteersAccepted + updated.communityPosts;
      if (totalActions >= 20) unlockBadge('green_warrior');
      
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
