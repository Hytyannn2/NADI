'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/src/lib/supabase/client';
import { useAuth } from '@/src/context/AuthContext';

const XP_PER_LEVEL = 200;

export function useXP() {
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);

  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;
    const loadXP = async () => {
      const { data } = await supabase.from('nadi_profiles').select('xp, streak, created_at').eq('id', user.id).single();
      if (data) {
        setXp(data.xp || 0);
        setStreak(data.streak || 0);
        // Level is purely derived from total XP in this new architecture
        setLevel(Math.floor((data.xp || 0) / XP_PER_LEVEL) + 1);
      }
    };
    loadXP();
  }, [user]);

  const addXp = async (amount: number) => {
    if (!user) return;
    setXp(prev => {
      const next = prev + amount;
      const currentLevel = Math.floor(prev / XP_PER_LEVEL) + 1;
      const nextLevel = Math.floor(next / XP_PER_LEVEL) + 1;
      
      if (nextLevel > currentLevel) {
        setLevel(nextLevel);
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 3000);
      }
      
      // Update DB
      supabase.from('nadi_profiles').update({ xp: next }).eq('id', user.id).then();
      
      return next;
    });
  };

  return { xp, level, streak, showLevelUp, addXp, xpToNext: XP_PER_LEVEL };
}
