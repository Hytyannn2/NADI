'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { useLanguage } from '@/src/context/LanguageContext';
import pkg from '@/package.json';

interface Tab {
  id: string;
  name: string;
  icon: any;
  isCenter?: boolean;
}

interface SideNavProps {
  tabs: Tab[];
  activeTab: string;
  onTabSwitch: (id: string) => void;
  sidebarWidth: number;
  onWidthChange: (width: number) => void;
}

export default function SideNav({ tabs, activeTab, onTabSwitch, sidebarWidth, onWidthChange }: SideNavProps) {
  const { t } = useLanguage();
  const [isResizing, setIsResizing] = useState(false);

  // Threshold for collapsed icon-only mode (180px gives a rock-solid, non-distorting layout)
  const isCollapsed = sidebarWidth < 180;

  // Pointer dragging handler for 5px resizable handle
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const newWidth = Math.min(420, Math.max(70, moveEvent.clientX));
      onWidthChange(newWidth);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  if (!tabs || !Array.isArray(tabs)) return null;

  return (
    <motion.nav
      className="hidden md:flex flex-col h-full fixed left-0 top-0 bottom-0 shrink-0 z-[100] border-r select-none transition-none overflow-hidden"
      style={{
        width: `${sidebarWidth}px`,
        background: 'var(--bg-card)',
        borderColor: 'var(--border-default)',
        padding: isCollapsed ? '16px 8px' : '16px 12px',
      }}
    >
      {/* ===== 5px THICK RESIZABLE SEPARATOR HANDLE ===== */}
      <div
        onPointerDown={handlePointerDown}
        className={`absolute top-0 right-0 bottom-0 w-[5px] cursor-col-resize z-[110] transition-colors select-none group flex items-center justify-center ${
          isResizing ? 'bg-[var(--accent)]' : 'bg-zinc-800/80 hover:bg-[var(--accent)]/80'
        }`}
        title="Tarik untuk ubah saiz bar navigasi (Resize Sidebar)"
      >
        <motion.div
          animate={{
            height: isResizing ? '85%' : '35%',
            width: isResizing ? '3px' : '1px',
            opacity: isResizing ? 1 : 0.6,
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          className="bg-zinc-400 group-hover:bg-white rounded-full"
        />
      </div>

      {/* ===== BRAND HEADER WITH RIGID NON-SQUISHING LAYOUT ===== */}
      <div className={`mb-8 mt-2 flex items-center overflow-hidden w-full ${isCollapsed ? 'justify-center px-0' : 'px-2'}`}>
        <AnimatePresence mode="wait">
          {isCollapsed ? (
            <motion.div
              key="brand-collapsed"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center cursor-pointer shrink-0"
              title="NADI — National Dashboard"
            >
              <img src="/logo.png" alt="NADI Logo" className="w-14 h-14 object-contain drop-shadow-md shrink-0" />
            </motion.div>
          ) : (
            <motion.div
              key="brand-expanded"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="flex flex-col shrink-0 overflow-hidden w-[210px]"
            >
              <div className="text-3xl font-black tracking-tighter flex items-center gap-3 shrink-0">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--accent)] to-blue-500 shrink-0">
                  NADI
                </span>
                <img src="/logo.png" alt="Logo" className="h-14 w-auto object-contain shrink-0 drop-shadow-md" />
              </div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider mt-0.5 whitespace-nowrap shrink-0" style={{ color: 'var(--text-muted)' }}>
                Platform Komuniti & Respons Bencana
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== NAV ITEMS WITH RIGID NON-SQUISHING BUTTON CONTENTS ===== */}
      <div className="flex flex-col gap-2 flex-1 items-center justify-center overflow-y-auto no-scrollbar w-full my-auto">
        {tabs.map((tab, index) => {
          if (!tab) return null;
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          // --- CENTER TAB (UTAMA) ---
          if (tab.isCenter) {
            return (
              <motion.button
                layout
                id={`tour-${tab.id}`}
                key={tab.id}
                aria-label={`Navigate to ${tab.name}`}
                animate={{ y: isActive ? -1 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onTabSwitch(tab.id)}
                className={`flex items-center ${isCollapsed ? 'justify-center w-11 h-11 p-0' : 'w-full px-3 py-2.5 gap-3.5'} rounded-2xl relative overflow-hidden group mb-4 mt-2 mx-auto shrink-0`}
                style={{
                  background: isActive ? 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 80%, #000))' : 'var(--bg-subtle)',
                  border: '1px solid var(--border-default)',
                  boxShadow: isActive ? '0 4px 20px color-mix(in srgb, var(--accent) 40%, transparent)' : 'none',
                }}
              >
                {isActive && !isCollapsed && (
                  <motion.div className="absolute inset-0 opacity-20" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }} animate={{ x: ['-100%', '200%'] }} transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut', repeatDelay: 1 }} />
                )}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative z-10" style={{ background: isActive ? 'transparent' : 'var(--bg-card)' }}>
                  <Icon className="w-5 h-5 shrink-0" style={{ color: isActive ? 'white' : 'var(--text-secondary)' }} />
                </div>
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.12 }} className="text-left relative z-10 overflow-hidden shrink-0">
                      <span className={`text-sm font-bold block whitespace-nowrap shrink-0 ${isActive ? 'text-white' : ''}`} style={{ color: isActive ? 'white' : 'var(--text-secondary)' }}>{tab.name}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          }

          // --- STANDARD TABS ---
          return (
            <motion.button
              layout
              id={`tour-${tab.id}`}
              key={tab.id}
              title={isCollapsed ? tab.name : undefined}
              aria-label={`Navigate to ${tab.name}`}
              onClick={() => onTabSwitch(tab.id)}
              initial={{ opacity: 0, x: isCollapsed ? -10 : 0 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 450, damping: 22, delay: index * 0.03 }}
              whileHover={{ x: isCollapsed ? 0 : 3 }}
              whileTap={{ scale: 0.96 }}
              className={`flex items-center ${isCollapsed ? 'justify-center w-11 h-11 p-0' : 'w-full px-3 py-2.5 gap-3.5'} rounded-xl transition-colors mx-auto shrink-0 ${isActive ? 'shadow-sm' : ''}`}
              style={{
                background: isActive ? 'var(--accent-muted)' : 'transparent',
                border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 shrink-0 transition-colors" style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }} />
              </div>
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -15, width: 0 }}
                    animate={{ opacity: 1, x: 0, width: 'auto' }}
                    exit={{ opacity: 0, x: -15, width: 0 }}
                    transition={{ duration: 0.12 }}
                    className="text-sm font-bold whitespace-nowrap overflow-hidden shrink-0 text-left transition-colors"
                    style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
                  >
                    {tab.name}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>

      {/* ===== FOOTER WITH OVERFLOW PROTECTION ===== */}
      <div className="mt-auto pt-4 overflow-hidden w-full">
        <AnimatePresence mode="wait">
          {isCollapsed ? (
            <motion.div 
              key="footer-collapsed"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="py-2 text-center" 
              title={`NADI v${pkg.version}`}
            >
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                v{pkg.version}
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="footer-expanded"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="p-3.5 rounded-2xl border space-y-2 overflow-hidden"
              style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-default)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>NADI</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                  v{pkg.version}
                </span>
              </div>
              <p className="text-[10px] leading-relaxed truncate" style={{ color: 'var(--text-muted)' }}>
                Platform Komuniti & Respons Bencana
              </p>
              <div className="pt-2 border-t flex items-center justify-center gap-3 text-[9px] font-semibold text-zinc-400" style={{ borderColor: 'var(--border-default)' }}>
                <Link href="/privacy" className="hover:text-white transition-colors">Privasi</Link>
                <span>•</span>
                <Link href="/terms" className="hover:text-white transition-colors">Terma</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
}
