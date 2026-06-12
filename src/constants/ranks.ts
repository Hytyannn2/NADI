import { Shield, Star, Swords, Crown, Trophy, Gem } from 'lucide-react';

// ===== NADI XP RANK SYSTEM =====
export const RANK_TITLES = ['Pemula', 'Warga', 'Pejuang', 'Pahlawan', 'Wira Rakyat', 'Legenda NADI'];

export const RANK_DATA = [
  { title: 'Pemula', subtitle: 'Newcomer', level: 1, icon: Shield, color: '#71717A', perk: 'Basic civic access', gradient: 'from-zinc-600 to-zinc-800' },
  { title: 'Warga', subtitle: 'Citizen', level: 3, icon: Star, color: '#10B981', perk: 'Priority report queue', gradient: 'from-emerald-600 to-emerald-800' },
  { title: 'Pejuang', subtitle: 'Fighter', level: 5, icon: Swords, color: '#3B82F6', perk: 'Community moderator access', gradient: 'from-blue-600 to-blue-800' },
  { title: 'Pahlawan', subtitle: 'Hero', level: 8, icon: Crown, color: '#F59E0B', perk: 'Verified civic contributor badge', gradient: 'from-amber-500 to-amber-700' },
  { title: 'Wira Rakyat', subtitle: 'People\'s Champion', level: 12, icon: Trophy, color: '#C5A367', perk: 'Direct escalation to authorities', gradient: 'from-[#C5A367] to-[#8B7340]' },
  { title: 'Legenda NADI', subtitle: 'Legend', level: 20, icon: Gem, color: '#A855F7', perk: 'All perks + legendary civic frame', gradient: 'from-purple-500 to-purple-800' },
] as const;
