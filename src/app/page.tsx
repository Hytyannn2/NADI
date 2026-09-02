/**
 * Main Application Shell & Tab Controller
 * 
 * Orchestrates module tab navigation (Dashboard, Bencana, Bantuan, Aduan, Komuniti),
 * global notifications drawer, settings modal, and full-screen GIS heatmap overlay.
 */
"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { AlertTriangle, Home, Heart, ChevronRight, ChevronDown, Bell, LogOut, User, Globe, Sun, Moon, Target, Award, Users, Map, X, Shield, Zap, Trophy, Settings, Calendar, Sparkles, ClipboardList, ShoppingBag, Share2, Siren, Volume2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage, LANGUAGES } from '@/src/context/LanguageContext';
import { useTheme, THEMES, type ThemeId, type FontSize } from '@/src/context/ThemeContext';

import { useGreeting } from '@/src/hooks/useGreeting';

// Module Views
import AuthView from '@/src/views/AuthView';
import AduanView from '../views/AduanView';
import BencanaView from '../views/BencanaView';
import DashboardView from '../views/DashboardView';
import BantuanView from '../views/BantuanView';
import KomunitiView from '../views/KomunitiView';

// Core UI Components
import SettingsModal from '@/src/components/SettingsModal';
import CivicHeatMap from '@/src/components/CivicHeatMap';
import SideNav from '@/src/components/SideNav';
import BottomNav from '../components/BottomNav';
import LoadingScreen from '../components/LoadingScreen';
import { WeatherAtmosphere } from '@/src/components/ambient/WeatherAtmosphere';

// Navigation Tab Identifiers
type TabId = 'utama' | 'bencana' | 'bantuan' | 'aduan' | 'komuniti';

export default function App() {
  // Auth and Theme Contexts
  const { user, loading, signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const { themeId, setThemeId, fontSize, setFontSize, isNotificationAllowed, playAlertSound } = useTheme();

  // Hooks
  const greeting = useGreeting();

  // Dynamic Notifications with category & quiet hours filtering
  const [notificationsList, setNotificationsList] = useState<Array<{
    id: string;
    category: 'aduan' | 'bantuan' | 'komuniti' | 'disaster';
    title: string;
    desc: string;
    time: string;
    urgent?: boolean;
    distanceKm?: number;
  }>>([]);

  useEffect(() => {
    fetch('/api/notifications')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.notifications)) {
          setNotificationsList(data.notifications);
        }
      })
      .catch(() => {});
  }, []);

  const visibleNotifications = useMemo(() => {
    return notificationsList.filter(n => isNotificationAllowed(n.category, n.distanceKm));
  }, [notificationsList, isNotificationAllowed]);

  // === UI State ===
  const [activeTab, setActiveTab] = useState<TabId>('utama');
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
    { id: 'aduan', name: t('nav.aduan') || 'Aduan', icon: ClipboardList },
    { id: 'komuniti', name: t('nav.komuniti') || 'Komuniti', icon: ShoppingBag },
    { id: 'utama', name: t('nav.utama') || 'Utama', icon: Home, isCenter: true },
    { id: 'bencana', name: t('nav.bencana') || 'Bencana', icon: AlertTriangle },
    { id: 'bantuan', name: t('nav.bantuan') || t('bantuan.title') || 'Bantuan', icon: Heart },
  ];

  // === Loading / Auth Gate ===
  if (loading) return <LoadingScreen />;
  if (!user) return <AuthView />;

  return (
    <div className="h-screen w-screen fixed inset-0 flex flex-col transition-colors duration-300 overflow-hidden font-sans" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* === Overlays === */}
      <AnimatePresence>{showHeatMap && <CivicHeatMap onClose={() => setShowHeatMap(false)} />}</AnimatePresence>


      {/* === Main App Shell === */}
      <div className="flex-1 w-full h-full relative flex flex-row overflow-hidden" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-default)' }}>

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
          className="flex-1 relative flex flex-col min-w-0 overflow-hidden transition-none md:pl-[var(--sidebar-width,260px)]"
          style={{
            ['--sidebar-width' as any]: `${sidebarWidth}px`,
          }}
        >

          {/* ===== HEADER ===== */}
          <header className="px-5 py-3.5 z-10 border-b shrink-0 flex justify-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="w-full max-w-[1720px] flex items-center justify-between">
              {/* User greeting & avatar */}
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

              {/* Action Buttons (All in one unified row) */}
              <div className="flex items-center gap-2">
                <button id="tour-heatmap" aria-label="View Civic Heatmap" onClick={() => setShowHeatMap(true)} className="relative p-2.5 sm:p-3 rounded-xl transition-colors hover:opacity-70" style={{ background: 'var(--bg-subtle)' }} title="Peta Haba Sivik">
                  <Map className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button id="notif-btn" aria-label="View Notifications" onClick={() => { setShowNotif(!showNotif); setShowUserMenu(false); setShowLangPicker(false); }}
                  className="relative p-2.5 sm:p-3 rounded-xl transition-colors hover:opacity-70" style={{ background: 'var(--bg-subtle)' }} title="Notifikasi"
                >
                  <Bell className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                  {visibleNotifications.length > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </button>
                <button
                  id="settings-btn"
                  aria-label="Settings"
                  onClick={() => { setShowUserMenu(!showUserMenu); setShowNotif(false); }}
                  className="shrink-0 p-2.5 sm:p-3 rounded-xl transition-colors hover:opacity-70" style={{ background: 'var(--bg-subtle)' }} title="Tetapan"
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
          />

          {/* === Notification Panel === */}
          <AnimatePresence>
            {showNotif && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-[118px] right-5 z-50 w-80 rounded-2xl overflow-hidden shadow-2xl"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-lg)' }}
              >
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#C5A367]" />
                    <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{t('header.notifications')}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                    {visibleNotifications.length} Aktif
                  </span>
                </div>
                
                <div className="max-h-72 overflow-y-auto no-scrollbar divide-y" style={{ borderColor: 'var(--border-default)' }}>
                  {visibleNotifications.length > 0 ? (
                    visibleNotifications.map(n => {
                      const meta = n.category === 'disaster'
                        ? { icon: Siren, color: '#EF4444' }
                        : n.category === 'bantuan'
                        ? { icon: Heart, color: '#10B981' }
                        : n.category === 'aduan'
                        ? { icon: CheckCircle2, color: '#C5A367' }
                        : { icon: Users, color: '#8B5CF6' };
                      const Icon = meta.icon;
                      return (
                        <div key={n.id} className="p-3 hover:bg-white/[0.02] transition-colors flex items-start gap-2.5">
                          <div className="p-2 rounded-xl shrink-0 mt-0.5" style={{ background: `${meta.color}20`, color: meta.color }}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                              <span className="text-[9px] shrink-0" style={{ color: 'var(--text-muted)' }}>{n.time}</span>
                            </div>
                            <p className="text-[11px] leading-snug mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{n.desc}</p>
                            {n.urgent && (
                              <button onClick={() => playAlertSound('siren')}
                                className="mt-1.5 px-2 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer">
                                <Volume2 className="w-3 h-3" /> Uji Siren Bencana
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Tiada notifikasi</p>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Mungkin disenyapkan oleh Waktu Senyap (DND) atau Tetapan Kategori.</p>
                    </div>
                  )}
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
                    <button onClick={() => { signOut(); setShowProfile(false); }}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-colors font-bold text-xs"
                      style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444' }}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Keluar</span>
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>



          {/* === Main Content === */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth pb-24 md:pb-6 no-scrollbar flex flex-col">
            {/* Ambient dynamic weather backdrop across all 5 views */}
            <WeatherAtmosphere />

            <AnimatePresence mode="wait">
              <div className="w-full max-w-[1720px] mx-auto flex-1 flex flex-col min-h-full relative z-10">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="flex-1 flex flex-col min-h-full"
                >
                  {activeTab === 'utama' && <DashboardView />}
                  {activeTab === 'bencana' && <BencanaView />}
                  {activeTab === 'bantuan' && <BantuanView />}
                  {activeTab === 'aduan' && <AduanView onNavigateToBencana={() => setActiveTab('bencana')} />}
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
