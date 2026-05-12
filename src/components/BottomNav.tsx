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
      <div className="flex justify-around items-center px-2 pt-2 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <motion.button
              key={tab.id}
              id={`tab-${tab.id}`}
              whileTap={{ scale: 0.9 }}
              onClick={() => onTabSwitch(tab.id)}
              className="flex flex-col items-center justify-center w-16 py-1.5 rounded-xl transition-all duration-200 focus:outline-none relative"
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
                className="text-[10px] font-bold transition-colors duration-200"
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
