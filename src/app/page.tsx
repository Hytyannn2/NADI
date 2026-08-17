"use client";

import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Home, Heart, ChevronRight, ChevronDown, Bell, LogOut, User, Globe, Sun, Moon, Target, Award, Users, Map, X, Shield, Zap, Trophy, Settings, Calendar, Sparkles, ClipboardList, ShoppingBag, Share2 } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage, LANGUAGES } from '@/src/context/LanguageContext';
import { useTheme, THEMES, type ThemeId, type FontSize } from '@/src/context/ThemeContext';

import { useGreeting } from '@/src/hooks/useGreeting';

// === Views ===
import AuthView from '@/src/views/AuthView';
import AduanView from '../views/AduanView';
import BencanaView from '../views/BencanaView';
import DashboardView from '../views/DashboardView';
import BantuanView from '../views/BantuanView';
import KomunitiView from '../views/KomunitiView';

// === Components ===
import OnboardingWalkthrough from '../components/OnboardingWalkthrough';
import CommunityFeed from '../components/CommunityFeed';
import SettingsModal from '@/src/components/SettingsModal';
import CivicHeatMap from '@/src/components/CivicHeatMap';
import SideNav from '@/src/components/SideNav';
import BottomNav from '../components/BottomNav';
import LoadingScreen from '../components/LoadingScreen';

// === WhistleIcon Component ===
function WhistleIcon({ className = "w-5 h-5", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 3a8 8 0 1 0 8 8h3a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-3a8 8 0 0 0-8-3Z" />
      <circle cx="11" cy="11" r="2.5" />
      <path d="M14 6.5L18 2.5" />
    </svg>
  );
}

// ===== TAB TYPE =====
type TabId = 'utama' | 'bencana' | 'bantuan' | 'aduan' | 'komuniti';

export default function App() {
  // === Auth & Context ===
  const { user, loading, signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const { themeId, setThemeId, fontSize, setFontSize } = useTheme();

  // === Hooks ===
  const greeting = useGreeting();

  // === UI State ===
  const [activeTab, setActiveTab] = useState<TabId>('aduan');
  const [sidebarWidth, setSidebarWidth] = useState<number>(260);
  const [isDesktopLayout, setIsDesktopLayout] = useState<boolean>(false);

  useEffect(() => {
    const savedWidth = localStorage.getItem('nadi_sidebar_width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed) && parsed >= 70 && parsed <= 420) {
        setSidebarWidth(parsed);
      }
    }
    const checkDesktop = () => {
      setIsDesktopLayout(window.innerWidth >= 768);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const handleSidebarWidthChange = (newWidth: number) => {
    setSidebarWidth(newWidth);
    localStorage.setItem('nadi_sidebar_width', String(newWidth));
  };
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [showCommunity, setShowCommunity] = useState(false);
  const [communityTab, setCommunityTab] = useState<'feed' | 'whistle'>('whistle');
  const fabX = useMotionValue(0);
  const fabY = useMotionValue(0);
  const isDragging = useRef(false);
  const [fabRect, setFabRect] = useState<DOMRect | null>(null);
  const [fabConstraints, setFabConstraints] = useState({ top: -110, bottom: 500, left: -300, right: 0 });

  useEffect(() => {
    const updateConstraints = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const hasSidebar = w >= 768;
      setFabConstraints({
        top: -110, // Allows dragging up to 20px from top
        bottom: h - 130 - 56 - 90, // Allows dragging down to ~90px from bottom edge
        left: -(w - (hasSidebar ? 352 : 96)), // Restrict dragging to the left edge of the main content area
        right: 0 // Cannot drag past the 20px right margin
      });
    };
    updateConstraints();
    window.addEventListener('resize', updateConstraints);
    return () => window.removeEventListener('resize', updateConstraints);
  }, []);

  const [showHeatMap, setShowHeatMap] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  // === Derived State ===
  const userEmail = user?.email ?? '';
  const userInitial = (user?.user_metadata?.full_name as string | undefined)?.charAt(0).toUpperCase() || userEmail.charAt(0).toUpperCase() || 'W';
  const userAvatar = (
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    user?.user_metadata?.avatarUrl ||
    user?.identities?.[0]?.identity_data?.avatar_url ||
    user?.identities?.[0]?.identity_data?.picture
  ) as string | undefined;
  const userName = (user?.user_metadata?.full_name as string | undefined) ?? userEmail.split('@')[0] ?? 'Warga';

  // === Onboarding ===
  useEffect(() => {
    try {
      if (!localStorage.getItem('nadi_onboarded')) setShowOnboarding(true);
    } catch { }
  }, []);

  // === Helpers ===
  const closeAllMenus = () => {
    setShowUserMenu(false);
    setShowNotif(false);
    setShowLangPicker(false);
  };

  const handleTabSwitch = (id: string) => {
    if (id !== activeTab) setActiveTab(id as TabId);
  };

  // === Tabs Config ===
  const tabs = [
    { id: 'aduan', name: 'Aduan', icon: ClipboardList },
    { id: 'komuniti', name: 'Komuniti', icon: ShoppingBag },
    { id: 'utama', name: 'Utama', icon: Home, isCenter: true },
    { id: 'bencana', name: t('nav.bencana') || 'Bencana', icon: AlertTriangle },
    { id: 'bantuan', name: t('bantuan.title') || 'Bantuan', icon: Heart },
  ];

  // === Loading / Auth Gate ===
  if (loading) return <LoadingScreen />;
  if (!user) return <AuthView />;

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300 overflow-hidden font-sans" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* === Overlays === */}
      {showOnboarding && <OnboardingWalkthrough onComplete={() => { setShowOnboarding(false); }} />}
      <AnimatePresence>{showCommunity && <CommunityFeed initialTab={communityTab} onClose={() => setShowCommunity(false)} />}</AnimatePresence>
      <AnimatePresence>{showHeatMap && <CivicHeatMap onClose={() => setShowHeatMap(false)} />}</AnimatePresence>


      {/* === Main App Shell === */}
      <div className="flex-1 w-full h-full relative flex flex-row overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>

        {/* ===== SIDE NAVIGATION (DESKTOP) ===== */}
        <SideNav
          tabs={tabs}
          activeTab={activeTab}
          onTabSwitch={handleTabSwitch}
          sidebarWidth={sidebarWidth}
          onWidthChange={handleSidebarWidthChange}
        />

        {/* ===== RIGHT CONTENT AREA ===== */}
        <div
          className="flex-1 relative flex flex-col min-w-0 overflow-hidden transition-none"
          style={{
            paddingLeft: isDesktopLayout ? `${sidebarWidth}px` : 0
          }}
        >

          {/* ===== HEADER ===== */}
          <header className="px-5 pt-5 pb-4 z-10 border-b shrink-0 flex justify-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="w-full max-w-[1720px]">
              {/* Top row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <button
                      id="user-avatar-btn"
                      aria-label="View Profile"
                      onClick={() => { setShowProfile(true); closeAllMenus(); }}
                      className="w-10 h-10 rounded-full overflow-hidden border-2 transition-colors focus:outline-none flex items-center justify-center shrink-0" style={{ borderColor: 'var(--border-default)' }}
                    >
                      {userAvatar && !avatarError ? (
                        <img
                          src={userAvatar}
                          alt="avatar"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={() => setAvatarError(true)}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-sm" style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}>
                          {userInitial}
                        </div>
                      )}
                    </button>
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
                  <button id="tour-heatmap" aria-label="View Civic Heatmap" onClick={() => setShowHeatMap(true)} className="relative p-3 rounded-xl transition-colors hover:opacity-70" style={{ background: 'var(--bg-subtle)' }}>
                    <Map className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <button id="tour-whistleblower" aria-label="Lapor Sulit (Whistleblower)" onClick={() => { setCommunityTab('whistle'); setShowCommunity(true); }} className="relative p-3 rounded-xl transition-colors hover:opacity-70" style={{ background: 'var(--bg-subtle)' }} title="Lapor Sulit (Whistleblower)">
                    <WhistleIcon className="w-5 h-5 text-red-400" />
                  </button>
                  <button id="notif-btn" aria-label="View Notifications" onClick={() => { setShowNotif(!showNotif); setShowUserMenu(false); setShowLangPicker(false); }}
                    className="relative p-3 rounded-xl transition-colors hover:opacity-70" style={{ background: 'var(--bg-subtle)' }}
                  >
                    <Bell className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                </div>
              </div>

              {/* Settings Button */}
              <div className="flex items-center justify-end">
                <button
                  id="settings-btn"
                  aria-label="Settings"
                  onClick={() => { setShowUserMenu(!showUserMenu); setShowNotif(false); }}
                  className="shrink-0 p-3 rounded-xl transition-colors hover:opacity-70" style={{ background: 'var(--bg-subtle)' }}
                >
                  <Settings className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>
            </div>
          </header>

          {/* === Settings Modal === */}
          <SettingsModal
            isOpen={showUserMenu}
            onClose={() => setShowUserMenu(false)}
            onReplayTutorial={() => setShowOnboarding(true)}
          />

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
                  <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Tiada notifikasi baharu</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('header.notif_hint')}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Backdrop to close menus */}
          {(showUserMenu || showNotif) && (
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
                      <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Profil Pengguna</h2>
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
                      </div>
                    </div>
                  </div>

                  {/* Account Info */}
                  <div className="p-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Maklumat Akaun</p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Shield className="w-4 h-4" style={{ color: 'var(--success, #10B981)' }} />
                        <div>
                          <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Kaedah Log Masuk</p>
                          <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{user?.app_metadata?.provider === 'google' ? 'Google' : 'E-mel'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <div>
                          <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Tarikh Daftar</p>
                          <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{user?.created_at ? new Date(user.created_at).toLocaleDateString('ms-MY', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</p>
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
                      <span className="text-xs font-semibold">Ulang Panduan</span>
                    </button>
                    <button onClick={() => { signOut(); setShowProfile(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                      style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444' }}
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-xs font-semibold">Log Keluar</span>
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>



          {/* === Main Content === */}
          <main className="flex-1 overflow-y-auto relative scroll-smooth pb-24 no-scrollbar">
            <AnimatePresence mode="wait">
              <div className="w-full max-w-[1720px] mx-auto h-full">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="h-full"
                >
                  {activeTab === 'utama' && <DashboardView />}
                  {activeTab === 'bencana' && <BencanaView />}
                  {activeTab === 'bantuan' && <BantuanView />}
                  {activeTab === 'aduan' && <AduanView />}
                  {activeTab === 'komuniti' && <KomunitiView />}
                </motion.div>
              </div>
            </AnimatePresence>
          </main>

          {/* === Bottom Nav (Mobile Only) === */}
          <div className="md:hidden shrink-0">
            <BottomNav tabs={tabs} activeTab={activeTab} onTabSwitch={handleTabSwitch} />
          </div>


        </div>
      </div>
    </div>
  );
}
