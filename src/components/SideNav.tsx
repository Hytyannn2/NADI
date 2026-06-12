'use client';
import { motion } from 'motion/react';

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
}

export default function SideNav({ tabs, activeTab, onTabSwitch }: SideNavProps) {
  return (
    <nav className="hidden md:flex flex-col w-64 h-full fixed left-0 top-0 bottom-0 p-4 shrink-0 z-[100] border-r" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
      <div className="mb-8 px-4 mt-2">
        <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--accent)] to-blue-500">
            NADI
          </span>
        </h1>
        <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>
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
                key={tab.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
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
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative z-10" style={{ background: isActive ? 'transparent' : 'var(--accent)' }}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-left relative z-10">
                  <span className={`text-sm font-bold block ${isActive ? 'text-white' : ''}`} style={{ color: isActive ? 'white' : 'var(--text-primary)' }}>{tab.name}</span>
                  <span className={`text-[10px] font-semibold ${isActive ? 'text-white/80' : ''}`} style={{ color: isActive ? 'white' : 'var(--accent)' }}>Access Pass</span>
                </div>
              </motion.button>
            );
          }

          return (
            <motion.button
              key={tab.id}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onTabSwitch(tab.id)}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${isActive ? 'shadow-sm' : ''}`}
              style={{
                background: isActive ? 'var(--accent-muted)' : 'transparent',
                border: isActive ? '1px solid var(--accent)' : '1px solid transparent'
              }}
            >
              <Icon className="w-5 h-5 shrink-0 transition-colors" style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }} />
              <span className="text-sm font-bold transition-colors" style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {tab.name}
              </span>
            </motion.button>
          );
        })}
      </div>
      
      <div className="mt-auto p-4 rounded-xl" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
         <p className="text-[10px] text-center font-semibold" style={{ color: 'var(--text-muted)' }}>
            NADI Platform<br/>Malaysia MADANI
         </p>
      </div>
    </nav>
  );
}
