'use client';
import { motion } from 'motion/react';

interface Tab {
  id: string;
  name: string;
  icon: any;
  isCenter?: boolean;
}

interface BottomNavProps {
  tabs: Tab[];
  activeTab: string;
  onTabSwitch: (id: string) => void;
}

export default function BottomNav({ tabs, activeTab, onTabSwitch }: BottomNavProps) {
  return (
    <nav className="absolute bottom-0 left-0 right-0 border-t" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
      <div className="flex justify-around items-end px-2 pt-2 pb-2 max-w-lg mx-auto w-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          // Center tab (Nadi-Pass) gets a prominent raised button
          if (tab.isCenter) {
            return (
              <motion.button
                key={tab.id}
                id={`tab-${tab.id}`}
                aria-label={`Navigate to ${tab.name}`}
                whileTap={{ scale: 0.9 }}
                onClick={() => onTabSwitch(tab.id)}
                className="flex flex-col items-center justify-center focus:outline-none relative -mt-6"
              >
                <motion.div
                  animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden"
                  style={{
                    background: isActive
                      ? 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 80%, #000))'
                      : 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #000))',
                    boxShadow: isActive
                      ? '0 4px 20px color-mix(in srgb, var(--accent) 40%, transparent), 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent)'
                      : '0 2px 12px color-mix(in srgb, var(--accent) 25%, transparent)',
                  }}
                >
                  {/* Shimmer effect */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 opacity-20"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }}
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut', repeatDelay: 1 }}
                    />
                  )}
                  <Icon
                    className="w-6 h-6 relative z-10"
                    style={{ color: 'white' }}
                  />
                </motion.div>
                <span
                  className="text-xs font-bold mt-2 transition-colors duration-200"
                  style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
                >
                  {tab.name}
                </span>
                {/* Active glow ring */}
                {isActive && (
                  <motion.div
                    layoutId="nav-center-glow"
                    className="absolute -top-1 w-16 h-16 rounded-2xl"
                    style={{
                      border: '2px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  />
                )}
              </motion.button>
            );
          }

          // Regular tabs
          return (
            <motion.button
              key={tab.id}
              id={`tab-${tab.id}`}
              aria-label={`Navigate to ${tab.name}`}
              whileTap={{ scale: 0.9 }}
              onClick={() => onTabSwitch(tab.id)}
              className="flex flex-col items-center justify-center w-20 py-2 min-h-[64px] rounded-xl transition-all duration-200 focus:outline-none relative"
            >
              <div
                className="p-2 rounded-xl mb-0.5 transition-all duration-200"
                style={isActive ? { background: 'var(--accent-muted)' } : {}}
              >
                <Icon
                  className="w-5 h-5 transition-colors duration-200"
                  style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
                />
              </div>
              <span
                className="text-xs font-bold transition-colors duration-200"
                style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
              >
                {tab.name}
              </span>
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-0.5 w-8 h-0.5 rounded-full"
                  style={{ background: 'var(--accent)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
