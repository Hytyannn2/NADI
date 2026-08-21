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
    <nav
      className="hidden md:flex flex-col h-full fixed left-0 top-0 bottom-0 shrink-0 z-[100] border-r select-none transition-none overflow-hidden"
      style={{
        width: `${sidebarWidth}px`,
        background: 'var(--bg-card)',
        borderColor: 'var(--border-default)',
        paddingTop: '16px',
        paddingBottom: '16px',
        paddingLeft: isCollapsed ? '10px' : '14px',
        paddingRight: isCollapsed ? '10px' : '14px',
      }}
    >
      {/* ===== 4px RESIZABLE SEPARATOR HANDLE ===== */}
      <div
        onPointerDown={handlePointerDown}
        className={`absolute top-0 right-0 bottom-0 w-[5px] cursor-col-resize z-[110] transition-colors select-none group flex items-center justify-center ${
          isResizing ? 'bg-[var(--accent)]' : 'bg-zinc-800/80 hover:bg-[var(--accent)]/80'
        }`}
        title="Tarik untuk ubah saiz bar navigasi (Resize Sidebar)"
      >
        <div
          style={{
            height: isResizing ? '85%' : '35%',
            width: isResizing ? '3px' : '1px',
            opacity: isResizing ? 1 : 0.6,
          }}
          className="bg-zinc-400 group-hover:bg-white rounded-full transition-all"
        />
      </div>

      {/* ===== BRAND HEADER ===== */}
      <div className={`mb-6 mt-1 flex items-center overflow-hidden w-full ${isCollapsed ? 'justify-center px-0' : 'px-1'}`}>
        <AnimatePresence mode="wait">
          {isCollapsed ? (
            <motion.div
              key="brand-collapsed"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer shrink-0"
              title="NADI — National Dashboard"
            >
              <img src="/logo.png" alt="NADI Logo" className="w-12 h-12 object-contain drop-shadow-md shrink-0" />
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
              <div className="text-2xl font-black tracking-tighter flex items-center gap-2.5 shrink-0">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--accent)] to-blue-500 shrink-0">
                  NADI
                </span>
                <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain shrink-0 drop-shadow-md" />
              </div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider mt-0.5 whitespace-nowrap shrink-0" style={{ color: 'var(--text-muted)' }}>
                Platform Komuniti & Respons Bencana
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== NAV ITEMS (NATURAL TOP-ALIGNED LIST) ===== */}
      <div className="flex flex-col gap-1.5 overflow-y-auto no-scrollbar w-full">
        {tabs.map((tab) => {
          if (!tab) return null;
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <motion.button
              id={`tour-${tab.id}`}
              key={tab.id}
              title={isCollapsed ? tab.name : undefined}
              aria-label={`Navigate to ${tab.name}`}
              onClick={() => onTabSwitch(tab.id)}
              whileTap={{ scale: 0.97 }}
              className={`flex items-center ${isCollapsed ? 'justify-center w-11 h-11 p-0' : 'w-full px-3.5 py-2.5 gap-3.5'} rounded-2xl transition-all mx-auto shrink-0 ${
                isActive
                  ? 'border shadow-sm'
                  : 'border border-transparent hover:bg-zinc-800/40 hover:border-zinc-800/60'
              }`}
              style={{
                background: isActive
                  ? tab.isCenter
                    ? 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 80%, #000))'
                    : 'var(--accent-muted)'
                  : tab.isCenter
                    ? 'var(--bg-subtle)'
                    : 'transparent',
                borderColor: isActive ? 'var(--accent)' : tab.isCenter ? 'var(--border-default)' : undefined,
                boxShadow: isActive && tab.isCenter ? '0 4px 20px color-mix(in srgb, var(--accent) 40%, transparent)' : undefined,
              }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 shrink-0 transition-colors" style={{ color: isActive ? (tab.isCenter ? 'white' : 'var(--accent)') : (tab.isCenter ? 'var(--text-secondary)' : 'var(--text-muted)') }} />
              </div>
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10, width: 0 }}
                    animate={{ opacity: 1, x: 0, width: 'auto' }}
                    exit={{ opacity: 0, x: -10, width: 0 }}
                    transition={{ duration: 0.12 }}
                    className="text-sm font-bold whitespace-nowrap overflow-hidden shrink-0 text-left transition-colors"
                    style={{ color: isActive ? (tab.isCenter ? 'white' : 'var(--accent)') : 'var(--text-secondary)' }}
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
      <div className="mt-4 pt-3.5 border-t border-zinc-800/80 overflow-hidden w-full">
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
    </nav>
  );
}
