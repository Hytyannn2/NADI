"use client";

import { useState, useEffect } from 'react';
import { Mic, Activity, AlertTriangle, Wallet, Heart, ChevronRight, ChevronDown, Bell, LogOut, User, Globe, Sun, Moon, Target, Award, Users, Map, X, Shield, Zap, Trophy, Settings, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage, LANGUAGES } from '@/src/context/LanguageContext';
import { useTheme, THEMES, type ThemeId, type FontSize } from '@/src/context/ThemeContext';
import { useGame } from '@/src/context/GameContext';

import { useXP } from '@/src/hooks/useXP';
import { useGreeting } from '@/src/hooks/useGreeting';
import { RANK_DATA } from '@/src/constants/ranks';

// === Views ===
import AuthView from '@/src/views/AuthView';
import SuaraView from '../views/SuaraView';
import InfraView from '../views/InfraView';
import BencanaView from '../views/BencanaView';
import SivikView from '../views/SivikView';
import BantuanView from '../views/BantuanView';

// === Components ===
import AIChatbot from '../components/AIChatbot';
import OnboardingWalkthrough from '../components/OnboardingWalkthrough';
import CommunityFeed from '../components/CommunityFeed';
import CivicHeatMap from '@/src/components/CivicHeatMap';
import LevelUpToast from '@/src/components/LevelUpToast';
import QuestPanel from '@/src/components/QuestPanel';
import MyKadScanner from '@/src/components/MyKadScanner';
import SideNav from '@/src/components/SideNav';
import BottomNav from '../components/BottomNav';
import RankPanel from '../components/RankPanel';
import LoadingScreen from '../components/LoadingScreen';

// ===== TAB TYPE =====
type TabId = 'suara' | 'infra' | 'bencana' | 'sivik' | 'bantuan';

export default function App() {
  // === Auth & Context ===
  const { user, loading, signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const { themeId, setThemeId, fontSize, setFontSize } = useTheme();
  const { quests, allQuestsComplete, badges } = useGame();


  // === Hooks ===
  const greeting = useGreeting();
  const { xp, level, showLevelUp, xpToNext } = useXP();

  // === UI State ===
  const [activeTab, setActiveTab] = useState<TabId>('sivik');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showQuestPanel, setShowQuestPanel] = useState(false);
  const [showMyKad, setShowMyKad] = useState(false);
  const [showCommunity, setShowCommunity] = useState(false);

  const [showHeatMap, setShowHeatMap] = useState(false);
  const [showRankPanel, setShowRankPanel] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // === Derived State ===
  const currentRankIndex = RANK_DATA.reduce((acc, r, i) => level >= r.level ? i : acc, 0);
  const rank = RANK_DATA[currentRankIndex].title;
  const xpPercent = Math.min((xp / xpToNext) * 100, 100);
  const completedQuests = quests.filter(q => q.completed).length;
  const userEmail = user?.email ?? '';
  const userInitial = userEmail.charAt(0).toUpperCase() || '🇲🇾';
  const userAvatar = user?.user_metadata?.avatar_url as string | undefined;
  const userName = (user?.user_metadata?.full_name as string | undefined) ?? userEmail.split('@')[0] ?? 'Warga';

  // === Onboarding ===
  useEffect(() => {
    try {
      if (!localStorage.getItem('nadi_onboarded')) setShowOnboarding(true);
      else if (!localStorage.getItem('nadi_mykad_done')) setShowMyKad(true);
    } catch {}
  }, []);

  // === Helpers ===
  const closeAllMenus = () => {
    setShowUserMenu(false);
    setShowNotif(false);
    setShowLangPicker(false);
    setShowQuestPanel(false);
    setShowRankPanel(false);
  };

  const handleTabSwitch = (id: string) => {
    if (id !== activeTab) setActiveTab(id as TabId);
  };

  // === Tabs Config ===
  const tabs = [
    { id: 'suara', name: t('nav.voice'), icon: Mic },
    { id: 'infra', name: t('nav.infra'), icon: Activity },
    { id: 'sivik', name: t('nav.nadipass'), icon: Wallet, isCenter: true },
    { id: 'bencana', name: t('nav.bencana'), icon: AlertTriangle },
    { id: 'bantuan', name: 'Bantuan', icon: Heart },
  ];

  // === Loading / Auth Gate ===
  if (loading) return <LoadingScreen />;
  if (!user) return <AuthView />;

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300 overflow-hidden font-sans" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* === Overlays === */}
      {showOnboarding && <OnboardingWalkthrough onComplete={() => { setShowOnboarding(false); if (!localStorage.getItem('nadi_mykad_done')) setShowMyKad(true); }} />}
      <AnimatePresence>
        {showMyKad && (
          <MyKadScanner
            onComplete={() => { setShowMyKad(false); try { localStorage.setItem('nadi_mykad_done', 'true'); } catch {} }}
            onSkip={() => { setShowMyKad(false); try { localStorage.setItem('nadi_mykad_done', 'true'); } catch {} }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{showCommunity && <CommunityFeed onClose={() => setShowCommunity(false)} />}</AnimatePresence>
      <AnimatePresence>{showHeatMap && <CivicHeatMap onClose={() => setShowHeatMap(false)} />}</AnimatePresence>

      {/* === Floating Elements === */}
      <AIChatbot activeTab={activeTab} />
      <LevelUpToast visible={showLevelUp} level={level} rank={rank} />

      {/* === Main App Shell === */}
      <div className="flex-1 w-full h-full relative flex flex-row overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        
        {/* ===== SIDE NAVIGATION (DESKTOP) ===== */}
        <SideNav tabs={tabs} activeTab={activeTab} onTabSwitch={handleTabSwitch} />

        {/* ===== RIGHT CONTENT AREA ===== */}
        <div className="flex-1 relative flex flex-col min-w-0 overflow-hidden md:pl-64">

          {/* ===== HEADER ===== */}
          <header className="px-5 pt-5 pb-4 z-10 border-b shrink-0 flex justify-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="w-full max-w-[1600px]">
              {/* Top row */}
              <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  id="user-avatar-btn"
                  onClick={() => { setShowUserMenu(!showUserMenu); setShowNotif(false); setShowLangPicker(false); }}
                  className="w-10 h-10 rounded-full overflow-hidden border-2 transition-colors focus:outline-none" style={{ borderColor: 'var(--border-default)' }}
                >
                  {userAvatar ? (
                    <img src={userAvatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-sm" style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}>
                      {userInitial}
                    </div>
                  )}
                </button>
                <div className="absolute -bottom-0.5 -right-0.5 rounded-full w-5 h-5 flex items-center justify-center text-[8px] font-bold" style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}>
                  {level}
                </div>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{greeting}</p>
                <h1 className="text-base font-bold tracking-tight leading-tight flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  {userName.length > 14 ? userName.slice(0, 14) + '…' : userName}
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: 'var(--accent)', background: 'var(--accent-muted)' }}>NADI</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setShowHeatMap(true)} className="relative p-2.5 rounded-xl transition-colors hover:opacity-70" style={{ background: 'var(--bg-subtle)' }}>
                <Map className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
              <button onClick={() => setShowCommunity(true)} className="relative p-2.5 rounded-xl transition-colors hover:opacity-70" style={{ background: 'var(--bg-subtle)' }}>
                <Users className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
              <button id="notif-btn" onClick={() => { setShowNotif(!showNotif); setShowUserMenu(false); setShowLangPicker(false); }}
                className="relative p-2.5 rounded-xl transition-colors hover:opacity-70" style={{ background: 'var(--bg-subtle)' }}
              >
                <Bell className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
          </div>

          {/* XP Progress Bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <div className="flex items-center justify-between mb-1.5">
                <button
                  onClick={() => { setShowRankPanel(!showRankPanel); closeAllMenus(); setShowRankPanel(p => !p); }}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                >
                  <span className="text-[10px] font-bold" style={{ color: RANK_DATA[currentRankIndex].color }}>{rank}</span>
                  <ChevronDown className={`w-3 h-3 transition-all ${showRankPanel ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
                </button>
                <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{xp}/{xpToNext} XP</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${xpPercent}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
              </div>
            </div>
            <button
              id="profile-chevron-btn"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="shrink-0 p-2.5 rounded-xl transition-colors hover:opacity-70" style={{ background: 'var(--bg-subtle)' }}
            >
              <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
            </div>
            </div>
          </header>

        {/* === Rank Panel === */}
        <RankPanel visible={showRankPanel} level={level} currentRankIndex={currentRankIndex} />

        {/* === User Menu === */}
        <AnimatePresence>
          {showUserMenu && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-[118px] right-5 z-50 w-60 rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-lg)' }}
            >
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-default)' }}>
                <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{userName}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{userEmail}</p>
              </div>
              <div className="p-2">
                {/* Profile */}
                <button onClick={() => { setShowProfile(true); setShowUserMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left hover:opacity-70" style={{ color: 'var(--text-primary)' }}>
                  <User className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs font-medium">{t('menu.profile')}</span>
                </button>

                {/* Language */}
                <button id="lang-picker-btn" onClick={() => setShowLangPicker(!showLangPicker)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors text-left hover:opacity-70"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{t('menu.language')}</span>
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{LANGUAGES.find(l => l.code === lang)?.flag}</span>
                </button>

                {/* Language picker */}
                <AnimatePresence>
                  {showLangPicker && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                      <div className="pl-6 py-1 space-y-0.5">
                        {LANGUAGES.map(l => (
                          <button key={l.code} onClick={() => { setLang(l.code); setShowLangPicker(false); setShowUserMenu(false); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-xs"
                            style={lang === l.code
                              ? { background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent-muted)' }
                              : { color: 'var(--text-secondary)', border: '1px solid transparent' }
                            }
                          >
                            <span className="text-sm">{l.flag}</span>
                            <span className="font-medium">{l.label}</span>
                            {lang === l.code && <span className="ml-auto text-[8px] font-bold" style={{ color: 'var(--accent)' }}>✓</span>}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Theme Toggle */}
                <div className="px-3 py-2.5">
                  <div className="flex items-center justify-between rounded-xl p-1" style={{ background: 'var(--bg-subtle)' }}>
                    {(Object.keys(THEMES) as ThemeId[]).map(tid => (
                      <button key={tid} onClick={() => setThemeId(tid)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
                        style={themeId === tid
                          ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }
                          : { color: 'var(--text-muted)' }
                        }
                      >
                        {tid === 'light' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                        {THEMES[tid].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size */}
                <div className="px-3 py-2">
                  <p className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Font Size</p>
                  <div className="flex gap-1.5">
                    {(['S', 'M', 'L'] as FontSize[]).map(fs => (
                      <button key={fs} onClick={() => setFontSize(fs)}
                        className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                        style={fontSize === fs
                          ? { background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent-muted)' }
                          : { color: 'var(--text-muted)', background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }
                        }
                      >{fs}</button>
                    ))}
                  </div>
                </div>

                {/* Replay Tutorial */}
                <button onClick={() => { setShowOnboarding(true); setShowUserMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left hover:opacity-70"
                >
                  <Award className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Replay Tutorial</span>
                </button>

                {/* Sign Out */}
                <button id="signout-btn" onClick={() => { signOut(); setShowUserMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left group"
                  style={{ color: 'var(--danger)' }}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-xs font-medium">{t('menu.signout')}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* === Notification Panel === */}
        <AnimatePresence>
          {showNotif && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-[118px] right-5 z-50 w-64 rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-lg)' }}
            >
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
                <p className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>{t('header.notifications')}</p>
              </div>
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>All caught up! 🎉</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('header.notif_hint')}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Backdrop to close menus */}
        {(showUserMenu || showNotif || showRankPanel || showQuestPanel) && (
          <div className="absolute inset-0 z-40" onClick={closeAllMenus} />
        )}

        {/* === Profile Panel === */}
        <AnimatePresence>
          {showProfile && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm"
              onClick={() => setShowProfile(false)}
            >
              <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute top-0 right-0 bottom-0 w-[85%] max-w-sm overflow-y-auto"
                style={{ background: 'var(--bg-card)', borderLeft: '1px solid var(--border-default)' }}
                onClick={e => e.stopPropagation()}
              >
                {/* Profile Header */}
                <div className="p-5 pb-6" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Profile</h2>
                    <button onClick={() => setShowProfile(false)} className="p-2 rounded-xl" style={{ color: 'var(--text-muted)' }}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 flex items-center justify-center" style={{ borderColor: 'var(--accent)' }}>
                      {userAvatar ? (
                        <img src={userAvatar} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl font-bold" style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}>
                          {userInitial}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{userName}</h3>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{userEmail}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                          Level {level} • {rank}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="p-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Your Stats</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>XP</span>
                      </div>
                      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{xp}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/{xpToNext}</span></p>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <Trophy className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>CRS</span>
                      </div>
                      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{quests.filter(q => q.completed).length * 50}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/1000</span></p>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="w-3.5 h-3.5" style={{ color: 'var(--success, #10B981)' }} />
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Quests</span>
                      </div>
                      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{completedQuests}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/{quests.length}</span></p>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <Award className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} />
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Badges</span>
                      </div>
                      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{badges.filter(b => b.unlocked).length}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>/{badges.length}</span></p>
                    </div>
                  </div>
                </div>

                {/* XP Progress */}
                <div className="p-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Level Progress</p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold" style={{ color: RANK_DATA[currentRankIndex].color }}>{rank}</span>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>Level {level}</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${xpPercent}%` }}
                      transition={{ duration: 1 }}
                      className="h-full rounded-full" style={{ background: 'var(--accent)' }}
                    />
                  </div>
                  <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>{xp} / {xpToNext} XP to next level</p>
                </div>

                {/* Badges */}
                <div className="p-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Badges Earned</p>
                  <div className="space-y-2">
                    {badges.map(b => (
                      <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: b.unlocked ? 'var(--success-muted, rgba(16,185,129,0.08))' : 'var(--bg-subtle)', border: '1px solid var(--border-default)', opacity: b.unlocked ? 1 : 0.5 }}>
                        <span className={`text-xl ${b.unlocked ? '' : 'grayscale opacity-40'}`}>{b.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold" style={{ color: b.unlocked ? 'var(--text-primary)' : 'var(--text-muted)' }}>{b.name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{b.description}</p>
                        </div>
                        {b.unlocked && (
                          <span className="text-[8px] font-bold px-2 py-0.5 rounded" style={{ background: 'var(--success-muted, rgba(16,185,129,0.1))', color: 'var(--success, #10B981)' }}>✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Account Info */}
                <div className="p-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Account</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4" style={{ color: 'var(--success, #10B981)' }} />
                      <div>
                        <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Auth Provider</p>
                        <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{user?.app_metadata?.provider === 'google' ? 'Google' : 'Email'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      <div>
                        <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Joined</p>
                        <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{user?.created_at ? new Date(user.created_at).toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-5">
                  <button onClick={() => { setShowOnboarding(true); setShowProfile(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-2 transition-colors"
                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  >
                    <Award className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs font-semibold">Replay Tutorial</span>
                  </button>
                  <button onClick={() => { signOut(); setShowProfile(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                    style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444' }}
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-xs font-semibold">Sign Out</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* === Quest Panel === */}
        <QuestPanel visible={showQuestPanel} />

        {/* === Main Content === */}
        <main className="flex-1 overflow-y-auto relative scroll-smooth pb-24 no-scrollbar">
          <AnimatePresence mode="wait">
            <div className="w-full max-w-[1600px] mx-auto h-full">
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
              {activeTab === 'bencana' && <BencanaView />}
              {activeTab === 'sivik' && <SivikView />}
              {activeTab === 'bantuan' && <BantuanView />}
              </motion.div>
            </div>
          </AnimatePresence>
        </main>

        {/* === Bottom Nav (Mobile Only) === */}
        <div className="md:hidden shrink-0">
          <BottomNav tabs={tabs} activeTab={activeTab} onTabSwitch={handleTabSwitch} />
        </div>

        {/* Quest FAB */}
        <button
          onClick={() => { setShowQuestPanel(!showQuestPanel); setShowUserMenu(false); setShowNotif(false); }}
          className="absolute top-[130px] right-5 z-30 w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:opacity-70"
          style={{ background: 'var(--accent-muted)', border: '1px solid var(--border-default)' }}
        >
          <Target className="w-4 h-4" style={{ color: allQuestsComplete ? 'var(--success)' : 'var(--accent)' }} />
          {completedQuests > 0 && completedQuests < quests.length && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center" style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}>{completedQuests}</span>
          )}
        </button>
        </div>
      </div>
    </div>
  );
}
