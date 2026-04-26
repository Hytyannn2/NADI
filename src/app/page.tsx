"use client";

import { useState, useEffect } from 'react';
import { Mic, Activity, AlertTriangle, Wallet, Store, Sparkles, Flame, Trophy, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SuaraView from '../views/SuaraView';
import InfraView from '../views/InfraView';
import BencanaView from '../views/BencanaView';
import SivikView from '../views/SivikView';
import NiagaView from '../views/NiagaView';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Night owl? 🦉";
  if (h < 12) return "Selamat Pagi! ☀️";
  if (h < 15) return "Selamat Tengahari 🌤️";
  if (h < 18) return "Selamat Petang 🌅";
  return "Selamat Malam 🌙";
}

// Persistent XP system using localStorage
function useXP() {
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
        // Calculate streak from last active date
        const lastDate = data.lastActive ? new Date(data.lastActive).toDateString() : '';
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (lastDate === today) {
          setStreak(data.streak || 0);
        } else if (lastDate === yesterday) {
          const newStreak = (data.streak || 0) + 1;
          setStreak(newStreak);
          localStorage.setItem('nadi_user', JSON.stringify({ ...data, streak: newStreak, lastActive: new Date().toISOString() }));
        } else {
          setStreak(1);
          localStorage.setItem('nadi_user', JSON.stringify({ ...data, streak: 1, lastActive: new Date().toISOString() }));
        }
      } else {
        const init = { xp: 75, level: 1, streak: 1, lastActive: new Date().toISOString(), name: 'Warga' };
        localStorage.setItem('nadi_user', JSON.stringify(init));
        setXp(75); setStreak(1);
      }
    } catch { /* ignore */ }
  }, []);

  const addXp = (amount: number) => {
    setXp(prev => {
      const next = prev + amount;
      const xpPerLevel = 200;
      if (next >= xpPerLevel) {
        const newLevel = level + 1;
        setLevel(newLevel);
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 3000);
        const remainder = next - xpPerLevel;
        try { localStorage.setItem('nadi_user', JSON.stringify({ xp: remainder, level: newLevel, streak, lastActive: new Date().toISOString() })); } catch {}
        return remainder;
      }
      try { localStorage.setItem('nadi_user', JSON.stringify({ xp: next, level, streak, lastActive: new Date().toISOString() })); } catch {}
      return next;
    });
  };

  return { xp, level, streak, showLevelUp, addXp, xpToNext: 200 };
}

const RANK_TITLES = ['Pemula', 'Warga', 'Pejuang', 'Pahlawan', 'Wira Rakyat', 'Legenda NADI'];

export default function App() {
  const [activeTab, setActiveTab] = useState<'suara' | 'infra' | 'bencana' | 'sivik' | 'niaga'>('sivik');
  const [isEmergency, setIsEmergency] = useState(false);
  const [greeting] = useState(getGreeting());
  const { xp, level, streak, showLevelUp, addXp, xpToNext } = useXP();
  const [particles, setParticles] = useState<{ id: number; x: number }[]>([]);

  const rank = RANK_TITLES[Math.min(level - 1, RANK_TITLES.length - 1)];
  const xpPercent = Math.min((xp / xpToNext) * 100, 100);

  // Award XP on tab switch (exploring the app = engagement)
  const handleTabSwitch = (id: typeof activeTab) => {
    if (id !== activeTab) {
      setActiveTab(id);
      addXp(2);
      // Spawn a floating "+2 XP" particle
      const newParticle = { id: Date.now(), x: Math.random() * 60 + 20 };
      setParticles(prev => [...prev, newParticle]);
      setTimeout(() => setParticles(prev => prev.filter(p => p.id !== newParticle.id)), 1000);
    }
  };

  const tabs: { id: typeof activeTab, name: string, icon: any, isCenter?: boolean }[] = [
    { id: 'sivik', name: 'Nadi-Pass', icon: Wallet },
    { id: 'infra', name: 'Infra', icon: Activity },
    { id: 'suara', name: 'Voice', icon: Mic, isCenter: true },
    { id: 'bencana', name: 'Bencana', icon: AlertTriangle },
    { id: 'niaga', name: 'Niaga', icon: Store },
  ];

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-500 overflow-hidden font-sans ${isEmergency ? 'bg-[#1a0505] text-red-50' : 'bg-[#050505] text-zinc-100'}`}>

      {/* Level Up Toast */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.9 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-[#0A0A0C] px-6 py-4 rounded-2xl shadow-[0_0_40px_rgba(197,163,103,0.5)] flex items-center gap-3"
          >
            <Trophy className="w-6 h-6" />
            <div>
              <p className="font-bold text-sm">LEVEL UP! 🎉</p>
              <p className="text-[10px] opacity-80 font-medium">You are now Level {level} — {rank}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating XP particles */}
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="fixed top-20 z-[100] text-[#C5A367] text-xs font-bold pointer-events-none"
          style={{ left: `${p.x}%` }}
        >
          +2 XP ✨
        </motion.div>
      ))}

      <div className={`flex-1 max-w-md w-full mx-auto relative flex flex-col overflow-hidden sm:shadow-2xl sm:border-x ${isEmergency ? 'bg-[#1a0505] border-red-950/50' : 'bg-[#0A0A0C] border-zinc-900'}`}>

        {/* Glow Effects */}
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-[#C5A367]/[0.03] to-transparent pointer-events-none"></div>
        {isEmergency && <div className="absolute top-0 inset-x-0 h-full bg-red-900/10 pointer-events-none animate-pulse"></div>}

        {/* === GAMIFIED HEADER === */}
        <header className={`px-5 pt-5 pb-4 z-10 ${isEmergency ? 'bg-[#1a0505]/60' : 'bg-[#0A0A0C]/60'} backdrop-blur-2xl border-b ${isEmergency ? 'border-red-900/30' : 'border-zinc-800/60'}`}>

          {/* Top row: Avatar + Greeting + Emergency badge */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Avatar with level ring */}
              <div className="relative">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold border-2 ${isEmergency ? 'bg-red-500/20 border-red-500/50 text-red-300' : 'bg-gradient-to-br from-[#C5A367]/20 to-[#0A0A0C] border-[#C5A367]/50 text-[#C5A367]'}`}>
                  🇲🇾
                </div>
                {/* Level badge */}
                <div className="absolute -bottom-1 -right-1 bg-[#0A0A0C] border border-[#C5A367]/50 rounded-full w-5 h-5 flex items-center justify-center">
                  <span className="text-[8px] font-black text-[#C5A367]">{level}</span>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 font-medium">{greeting}</p>
                <h1 className="text-lg font-serif font-semibold tracking-tight leading-tight flex items-center gap-1.5">
                  NADI
                  <span className="text-[9px] font-mono text-zinc-600 bg-zinc-800/80 px-1.5 py-0.5 rounded">v1.0</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Streak */}
              {streak > 0 && (
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] font-bold border ${streak >= 7 ? 'bg-orange-500/15 border-orange-500/30 text-orange-400' : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400'}`}
                >
                  <Flame className={`w-3 h-3 ${streak >= 7 ? 'text-orange-400 animate-fire' : 'text-zinc-500'}`} />
                  {streak}d
                </motion.div>
              )}

              {isEmergency && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 bg-red-500/20 text-red-400 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  SOS
                </motion.div>
              )}
            </div>
          </div>

          {/* XP Progress Bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">{rank}</span>
                <span className="text-[8px] font-mono text-zinc-600">{xp}/{xpToNext} XP</span>
              </div>
              <div className={`h-1.5 rounded-full overflow-hidden ${isEmergency ? 'bg-red-950' : 'bg-zinc-800'}`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${xpPercent}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-full rounded-full ${isEmergency ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-[#C5A367] to-[#E8C34B]'}`}
                  style={{ boxShadow: isEmergency ? '0 0 8px rgba(220,38,38,0.5)' : '0 0 8px rgba(197,163,103,0.4)' }}
                />
              </div>
            </div>
            <button className="shrink-0 p-2 rounded-xl bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800 transition-colors group">
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-[#C5A367] transition-colors" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto relative scroll-smooth pb-32 no-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="h-full"
            >
              {activeTab === 'suara' && <SuaraView />}
              {activeTab === 'infra' && <InfraView />}
              {activeTab === 'bencana' && <BencanaView isEmergency={isEmergency} setIsEmergency={setIsEmergency} />}
              {activeTab === 'sivik' && <SivikView />}
              {activeTab === 'niaga' && <NiagaView />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* === GAMIFIED BOTTOM NAV === */}
        <nav className={`absolute bottom-6 left-5 right-5 rounded-3xl backdrop-blur-xl border ${isEmergency ? 'bg-[#1a0505]/85 border-red-900/50 shadow-[0_10px_40px_-10px_rgba(220,38,38,0.2)]' : 'bg-[#121214]/85 border-zinc-800 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)]'}`}>
          <div className="flex justify-between items-center px-1 py-1 relative">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              if (tab.isCenter) {
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabSwitch(tab.id)}
                    className="relative -top-8 group focus:outline-none"
                  >
                    <div className={`absolute inset-0 rounded-full blur-lg opacity-50 transition-opacity duration-300 ${isActive
                      ? (isEmergency ? 'bg-red-500 opacity-60' : 'bg-[#C5A367] opacity-60')
                      : 'bg-transparent'
                      }`}></div>
                    <motion.div
                      whileTap={{ scale: 0.85 }}
                      className={`relative w-[60px] h-[60px] rounded-full flex items-center justify-center shadow-xl transition-all duration-300 border ${isActive
                        ? (isEmergency ? 'bg-red-600 border-red-500 text-white' : 'bg-gradient-to-b from-[#D4AF37] to-[#B8860B] border-[#E8C34B] text-[#0A0A0C]')
                        : (isEmergency ? 'bg-[#1a0505] text-red-500 border-red-900' : 'bg-[#121214] border-zinc-800 text-[#C5A367] hover:bg-zinc-800/50')
                        }`}
                    >
                      <Icon className={`w-6 h-6 ${isActive ? '' : 'opacity-80'}`} />
                    </motion.div>
                    {/* Active indicator dot */}
                    {isActive && (
                      <motion.div
                        layoutId="center-dot"
                        className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isEmergency ? 'bg-red-400' : 'bg-[#C5A367]'}`}
                      />
                    )}
                  </button>
                );
              }

              return (
                <motion.button
                  key={tab.id}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleTabSwitch(tab.id)}
                  className={`flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all duration-300 focus:outline-none relative ${isActive
                    ? (isEmergency ? 'text-red-400 bg-red-500/10' : 'text-zinc-100 bg-zinc-800/50')
                    : (isEmergency ? 'text-red-900/50 hover:text-red-500' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30')
                    }`}
                >
                  <Icon className={`w-5 h-5 mb-1 transition-transform ${isActive ? 'scale-110 drop-shadow-md' : 'scale-100 opacity-70'}`} />
                  <span className={`text-[8px] uppercase tracking-widest font-bold ${isActive ? 'opacity-100' : 'opacity-60'}`}>{tab.name}</span>
                  {/* Active indicator dot */}
                  {isActive && (
                    <motion.div
                      layoutId="nav-dot"
                      className={`absolute -bottom-0.5 w-1 h-1 rounded-full ${isEmergency ? 'bg-red-400' : 'bg-[#C5A367]'}`}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
