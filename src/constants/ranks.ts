import { Shield, Star, Swords, Crown, Trophy, Gem } from 'lucide-react';

// ===== NADI XP RANK SYSTEM =====
export const RANK_TITLES = ['Pemula', 'Warga', 'Pejuang', 'Pahlawan', 'Wira Rakyat', 'Legenda NADI'];

export const RANK_DATA = [
  { title: 'Pemula', subtitle: 'Newcomer', level: 1, icon: Shield, color: '#71717A', perk: 'Basic civic access', gradient: 'from-zinc-600 to-zinc-800' },
  { title: 'Warga', subtitle: 'Citizen', level: 3, icon: Star, color: '#10B981', perk: 'Transit discounts unlocked', gradient: 'from-emerald-600 to-emerald-800' },
  { title: 'Pejuang', subtitle: 'Fighter', level: 5, icon: Swords, color: '#3B82F6', perk: 'Priority report queue', gradient: 'from-blue-600 to-blue-800' },
  { title: 'Pahlawan', subtitle: 'Hero', level: 8, icon: Crown, color: '#F59E0B', perk: 'Community moderator badge', gradient: 'from-amber-500 to-amber-700' },
  { title: 'Wira Rakyat', subtitle: 'People\'s Champion', level: 12, icon: Trophy, color: '#C5A367', perk: 'Rewards shop exclusives', gradient: 'from-[#C5A367] to-[#8B7340]' },
  { title: 'Legenda NADI', subtitle: 'Legend', level: 20, icon: Gem, color: '#A855F7', perk: 'All perks + legendary frame', gradient: 'from-purple-500 to-purple-800' },
] as const;

// ===== TRANSIT ECO RANK SYSTEM =====
export const ECO_RANKS = [
  { title: 'Sapling', co2Threshold: 0, icon: '🌱', color: '#71717A', perk: 'Starting your green journey' },
  { title: 'Green Padi', co2Threshold: 20, icon: '🌾', color: '#84CC16', perk: '5% transit discount' },
  { title: 'Green Kijang', co2Threshold: 50, icon: '🦌', color: '#10B981', perk: '10% transit discount + priority boarding' },
  { title: 'Green Harimau', co2Threshold: 100, icon: '🐅', color: '#F59E0B', perk: '15% discount + monthly free ride' },
  { title: 'Green Garuda', co2Threshold: 200, icon: '🦅', color: '#C5A367', perk: 'All perks + exclusive eco badge' },
] as const;

export function getEcoRank(co2: number) {
  for (let i = ECO_RANKS.length - 1; i >= 0; i--) {
    if (co2 >= ECO_RANKS[i].co2Threshold) return ECO_RANKS[i];
  }
  return ECO_RANKS[0];
}

export function getEcoRankIndex(co2: number) {
  for (let i = ECO_RANKS.length - 1; i >= 0; i--) {
    if (co2 >= ECO_RANKS[i].co2Threshold) return i;
  }
  return 0;
}
