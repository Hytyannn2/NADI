'use client';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Sparkles, CheckCircle, Circle, Gift, ChevronRight } from 'lucide-react';
import { useGame } from '@/src/context/GameContext';
import { useGamification } from './Gamification';

interface QuestPanelProps {
  visible: boolean;
  fabRect?: DOMRect | null;
}

export default function QuestPanel({ visible, fabRect }: QuestPanelProps) {
  const { quests, allQuestsComplete, bonusCollected, collectBonus, badges, crs, crsLabel } = useGame();
  const { showXPPopup, showCelebration, triggerConfetti } = useGamification();
  const completedQuests = quests.filter(q => q.completed).length;
  const unlockedBadges = badges.filter(b => b.unlocked).length;
  const progress = quests.length > 0 ? (completedQuests / quests.length) * 100 : 0;

  const handleCollectBonus = () => {
    collectBonus();
    showXPPopup(50, 'Bonus Chest');
    showCelebration({
      type: 'quest_complete',
      title: 'All Quests Done! 🎯',
      subtitle: 'You completed every daily quest. Legendary commitment!',
      icon: '🏆',
      color: '#2563EB',
    });
  };

  // Mascot mood based on progress
  const mascotMood = allQuestsComplete ? '🦸' : completedQuests > 0 ? '💪' : '🌱';
  const mascotText = allQuestsComplete
    ? "You're unstoppable today!"
    : completedQuests > 0
      ? `${quests.length - completedQuests} more to go. You got this!`
      : 'Start a quest to grow stronger!';

  let panelStyle: React.CSSProperties = {
    background: 'var(--bg-card)', 
    border: '1px solid var(--border-default)', 
    boxShadow: 'var(--shadow-lg)'
  };

  if (fabRect) {
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1000;
    const isMobile = screenWidth < 768;

    if (isMobile) {
      panelStyle.left = '20px';
      panelStyle.right = '20px';
      if (fabRect.top > screenHeight / 2) {
        panelStyle.bottom = screenHeight - fabRect.top + 16;
      } else {
        panelStyle.top = fabRect.bottom + 16;
      }
    } else {
      const isLeftHalf = fabRect.left < screenWidth / 2;
      if (isLeftHalf) {
        panelStyle.left = fabRect.right + 16;
      } else {
        panelStyle.right = screenWidth - fabRect.left + 16;
      }

      const panelHeight = 400; 
      if (fabRect.top + panelHeight > screenHeight - 20) {
        panelStyle.bottom = 20;
      } else {
        panelStyle.top = Math.max(20, fabRect.top);
      }
    }
  } else {
    panelStyle.top = '118px';
    panelStyle.right = '20px';
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          className="fixed z-[100] w-[calc(100%-40px)] md:w-80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          style={panelStyle}
        >
          {/* Mascot Header */}
          <div className="px-4 py-4 flex items-center gap-4 shrink-0" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="text-4xl select-none"
            >
              {mascotMood}
            </motion.div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Daily Quests</p>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg"
                  style={{ background: allQuestsComplete ? 'var(--success-muted)' : 'var(--accent-muted)', color: allQuestsComplete ? 'var(--success)' : 'var(--accent)' }}
                >{completedQuests}/{quests.length}</span>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{mascotText}</p>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: 'var(--bg-muted)' }}>
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ background: allQuestsComplete ? 'var(--success)' : 'var(--accent)' }}
                />
              </div>
            </div>
          </div>

          {/* Quest list */}
          <div className="p-3 space-y-2 flex-1 overflow-y-auto min-h-0">
            {quests.map((q, i) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-xl transition-all"
                style={q.completed
                  ? { background: 'var(--success-muted)', border: '1px solid transparent' }
                  : { background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }
                }
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: q.completed ? 'var(--success-muted)' : 'var(--bg-muted)' }}
                >
                  {q.completed ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                      <CheckCircle className="w-4 h-4" style={{ color: 'var(--success)' }} />
                    </motion.div>
                  ) : (
                    <Circle className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold ${q.completed ? 'line-through opacity-60' : ''}`}
                    style={{ color: q.completed ? 'var(--success)' : 'var(--text-primary)' }}
                  >{q.title}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{q.description}</p>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold"
                  style={q.completed
                    ? { background: 'var(--success-muted)', color: 'var(--success)' }
                    : { background: 'var(--accent-muted)', color: 'var(--accent)' }
                  }
                >
                  {q.completed ? '✓' : `+${q.xpReward}`}
                </div>
              </motion.div>
            ))}

            {/* Bonus chest */}
            {allQuestsComplete && !bonusCollected && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCollectBonus}
                className="w-full mt-2 py-4 rounded-xl text-sm font-bold shadow-lg flex items-center justify-center gap-2 relative overflow-hidden group btn-primary"
              >
                <Gift className="w-4 h-4" />
                Collect Bonus Chest
                <span className="px-2 py-0.5 rounded text-[10px] opacity-80" style={{ background: 'rgba(255,255,255,0.2)' }}>+50 XP</span>
              </motion.button>
            )}
            {bonusCollected && (
              <div className="text-center py-2 text-xs font-semibold" style={{ color: 'var(--success)' }}>
                ✓ Bonus collected today
              </div>
            )}
          </div>

          {/* Badges footer */}
          <div className="px-4 py-3 shrink-0" style={{ borderTop: '1px solid var(--border-default)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Badges ({unlockedBadges}/{badges.length})</p>
              <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>CRS: <span style={{ color: 'var(--accent)' }}>{crs}/1000</span></p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {badges.map(b => (
                <motion.div
                  key={b.id}
                  whileHover={{ scale: 1.3 }}
                  className={`text-lg cursor-pointer ${b.unlocked ? 'drop-shadow-md' : 'opacity-20 grayscale'}`}
                  title={b.name}
                >
                  {b.icon}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
