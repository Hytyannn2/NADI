'use client';
import { motion } from 'motion/react';
import { useLanguage } from '@/src/context/LanguageContext';

interface Tab {
  id: string;
  name: string;
  icon: any;
  isCenter?: boolean;
}

import pkg from '@/package.json';

interface SideNavProps {
  tabs: Tab[];
  activeTab: string;
  onTabSwitch: (id: string) => void;
}

export default function SideNav({ tabs, activeTab, onTabSwitch }: SideNavProps) {
  const { t } = useLanguage();

  return (
    <nav className="hidden md:flex flex-col w-64 h-full fixed left-0 top-0 bottom-0 p-4 shrink-0 z-[100] border-r" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
      <div className="mb-8 px-4 mt-2">
        <div className="text-3xl font-black tracking-tighter flex items-center gap-2">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--accent)] to-blue-500">
            NADI
          </span>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>
          National Dashboard
        </p>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.isCenter) {
            return (
              <motion.button
                id={`tour-${tab.id}`}
                key={tab.id}
                aria-label={`Navigate to ${tab.name}`}
                animate={{ 
                  scale: isActive ? 1.04 : 1,
                  y: isActive ? -2 : 0
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                whileHover={{ scale: isActive ? 1.04 : 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onTabSwitch(tab.id)}
                className="flex items-center gap-4 px-4 py-3 rounded-2xl relative overflow-hidden group mb-4 mt-2"
                style={{
                  background: isActive
                    ? 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 80%, #000))'
                    : 'var(--bg-subtle)',
                  border: '1px solid var(--border-default)',
                  boxShadow: isActive ? '0 4px 20px color-mix(in srgb, var(--accent) 40%, transparent)' : 'none'
                }}
              >
                {isActive && (
                  <motion.div
                    className="absolute inset-0 opacity-20"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }}
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut', repeatDelay: 1 }}
                  />
                )}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative z-10" style={{ background: isActive ? 'transparent' : 'var(--bg-card)' }}>
                  <Icon className="w-5 h-5" style={{ color: isActive ? 'white' : 'var(--text-secondary)' }} />
                </div>
                <div className="text-left relative z-10">
                  <span className={`text-sm font-bold block ${isActive ? 'text-white' : ''}`} style={{ color: isActive ? 'white' : 'var(--text-secondary)' }}>{tab.name}</span>
                </div>
              </motion.button>
            );
          }

          return (
            <motion.button
              id={`tour-${tab.id}`}
              key={tab.id}
              aria-label={`Navigate to ${tab.name}`}
              animate={{ 
                scale: isActive ? 1.05 : 1,
                x: isActive ? 6 : 0
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 12 }}
              whileHover={{ x: isActive ? 6 : 4, scale: isActive ? 1.05 : 1.01 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onTabSwitch(tab.id)}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-colors ${isActive ? 'shadow-sm' : ''}`}
              style={{
                background: isActive ? 'var(--accent-muted)' : 'transparent',
                border: isActive ? '1px solid var(--accent)' : '1px solid transparent'
              }}
            >
              <motion.div animate={{ scale: isActive ? 1.15 : 1 }} transition={{ type: 'spring', stiffness: 500, damping: 12 }}>
                <Icon className="w-5 h-5 shrink-0 transition-colors" style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }} />
              </motion.div>
              <span className="text-sm font-bold transition-colors" style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {tab.name}
              </span>
            </motion.button>
          );
        })}
      </div>
      
      {/* ===== PROFESSIONAL FOOTER ===== */}
      <div className="mt-auto p-3.5 rounded-2xl border transition-all" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-default)' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>NADI</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>v{pkg.version}</span>
        </div>
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Platform Digital Komuniti & Respon Warga
        </p>
      </div>
    </nav>
  );
}
