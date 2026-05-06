'use client';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Sparkles, CheckCircle, Circle, Gift, ChevronRight } from 'lucide-react';
import { useGame } from '@/src/context/GameContext';
import { useGamification } from './Gamification';

interface QuestPanelProps {
  visible: boolean;
}

export default function QuestPanel({ visible }: QuestPanelProps) {
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
      color: '#C5A367',
    });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          className="absolute top-[118px] left-5 right-5 z-50 bg-[#111113] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[#C5A367]" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-300">Daily Quests</p>
            </div>
            <span className="text-[9px] font-bold text-[#C5A367] bg-[#C5A367]/10 px-2 py-1 rounded border border-[#C5A367]/20">{completedQuests}/{quests.length}</span>
          </div>

          {/* Progress ring */}
          <div className="px-4 pt-4 pb-2 flex items-center gap-4">
            <div className="relative w-14 h-14 shrink-0">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke="#27272A" strokeWidth="3" />
                <motion.circle
                  cx="22" cy="22" r="18" fill="none"
                  stroke={allQuestsComplete ? '#10B981' : '#C5A367'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={113}
                  initial={{ strokeDashoffset: 113 }}
                  animate={{ strokeDashoffset: 113 - (progress / 100) * 113 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                {allQuestsComplete ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.5 }}>
                    <Sparkles className="w-5 h-5 text-[#10B981]" />
                  </motion.div>
                ) : (
                  <span className="text-xs font-black text-[#C5A367]">{completedQuests}</span>
                )}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">
                {allQuestsComplete ? 'All Complete! 🎉' : `${quests.length - completedQuests} quests remaining`}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {allQuestsComplete ? 'Collect your bonus reward below' : 'Complete quests to earn XP and climb ranks'}
              </p>
            </div>
          </div>

          {/* Quest list */}
          <div className="p-3 space-y-2">
            {quests.map((q, i) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${q.completed ? 'bg-[#10B981]/5 border-[#10B981]/20' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${q.completed ? 'bg-[#10B981]/20' : 'bg-zinc-800'}`}>
                  {q.completed ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                      <CheckCircle className="w-4 h-4 text-[#10B981]" />
                    </motion.div>
                  ) : (
                    <Circle className="w-4 h-4 text-zinc-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold ${q.completed ? 'text-[#10B981] line-through opacity-70' : 'text-zinc-300'}`}>{q.title}</p>
                  <p className="text-[9px] text-zinc-600 mt-0.5">{q.description}</p>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold ${q.completed ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#C5A367]/10 text-[#C5A367]'}`}>
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
                className="w-full mt-2 bg-gradient-to-r from-[#C5A367] to-[#E8C34B] text-[#0A0A0C] py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
                <Gift className="w-4 h-4" />
                Collect Bonus Chest
                <span className="bg-[#0A0A0C]/20 px-2 py-0.5 rounded text-[9px]">+50 XP</span>
              </motion.button>
            )}
            {bonusCollected && (
              <div className="text-center py-2 text-[9px] font-bold uppercase tracking-widest text-[#10B981]">
                ✓ Bonus collected today
              </div>
            )}
          </div>

          {/* Badges footer */}
          <div className="px-4 py-3 border-t border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Badges ({unlockedBadges}/{badges.length})</p>
              <p className="text-[9px] font-bold text-zinc-600">CRS: <span className="text-[#C5A367]">{crs}/1000</span></p>
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
