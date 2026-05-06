'use client';
import { useState, useEffect } from 'react';

const XP_PER_LEVEL = 200;

export function useXP() {
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nadi_user');
      if (saved) {
        const data = JSON.parse(saved);
        setXp(data.xp || 0);
        setLevel(data.level || 1);
        const lastDate = data.lastActive ? new Date(data.lastActive).toDateString() : '';
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (lastDate === today) {
          setStreak(data.streak || 0);
        } else if (lastDate === yesterday) {
          const ns = (data.streak || 0) + 1;
          setStreak(ns);
          localStorage.setItem('nadi_user', JSON.stringify({ ...data, streak: ns, lastActive: new Date().toISOString() }));
        } else {
          setStreak(1);
          localStorage.setItem('nadi_user', JSON.stringify({ ...data, streak: 1, lastActive: new Date().toISOString() }));
        }
      } else {
        const init = { xp: 0, level: 1, streak: 1, lastActive: new Date().toISOString() };
        localStorage.setItem('nadi_user', JSON.stringify(init));
        setXp(0); setStreak(1);
      }
    } catch { /* ignore */ }
  }, []);

  const addXp = (amount: number) => {
    setXp(prev => {
      const next = prev + amount;
      if (next >= XP_PER_LEVEL) {
        const newLevel = level + 1;
        setLevel(newLevel);
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 3000);
        const remainder = next - XP_PER_LEVEL;
        try { localStorage.setItem('nadi_user', JSON.stringify({ xp: remainder, level: newLevel, streak, lastActive: new Date().toISOString() })); } catch { }
        return remainder;
      }
      try { localStorage.setItem('nadi_user', JSON.stringify({ xp: next, level, streak, lastActive: new Date().toISOString() })); } catch { }
      return next;
    });
  };

  return { xp, level, streak, showLevelUp, addXp, xpToNext: XP_PER_LEVEL };
}
