'use client';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Star, Lock, Check } from 'lucide-react';
import { RANK_DATA } from '@/src/constants/ranks';

interface RankPanelProps {
  visible: boolean;
  level: number;
  currentRankIndex: number;
}

export default function RankPanel({ visible, level, currentRankIndex }: RankPanelProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="absolute top-[118px] left-5 right-5 z-50 bg-[#111113] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#C5A367]" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-300">Rank Progression</p>
            </div>
            <span className="text-[9px] font-bold text-[#C5A367] bg-[#C5A367]/10 px-2 py-1 rounded border border-[#C5A367]/20">Lv {level}</span>
          </div>
          <div className="p-3 space-y-1.5 max-h-[340px] overflow-y-auto no-scrollbar">
            {RANK_DATA.map((r, i) => {
              const RankIcon = r.icon;
              const isCurrentRank = i === currentRankIndex;
              const isUnlocked = level >= r.level;
              const isNextRank = i === currentRankIndex + 1;
              const levelsToGo = r.level - level;
              return (
                <motion.div
                  key={r.title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isCurrentRank
                      ? 'bg-gradient-to-r from-[#C5A367]/10 to-transparent border-[#C5A367]/30 shadow-[0_0_15px_rgba(197,163,103,0.1)]'
                      : isUnlocked
                        ? 'bg-[#10B981]/5 border-[#10B981]/15'
                        : 'bg-zinc-900/30 border-zinc-800/60'
                  }`}
                >
                  <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    isCurrentRank
                      ? `bg-gradient-to-br ${r.gradient} border-white/20 shadow-lg`
                      : isUnlocked
                        ? 'bg-zinc-800 border-zinc-700'
                        : 'bg-zinc-900 border-zinc-800'
                  }`}>
                    {isUnlocked ? (
                      <RankIcon className="w-5 h-5" style={{ color: isCurrentRank ? '#fff' : r.color }} />
                    ) : (
                      <Lock className="w-4 h-4 text-zinc-700" />
                    )}
                    {isCurrentRank && (
                      <motion.div
                        animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0.2, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 rounded-xl border-2"
                        style={{ borderColor: r.color }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-xs font-bold ${
                        isCurrentRank ? 'text-[#C5A367]' : isUnlocked ? 'text-zinc-300' : 'text-zinc-600'
                      }`}>{r.title}</h4>
                      <span className={`text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                        isCurrentRank
                          ? 'bg-[#C5A367]/20 text-[#C5A367]'
                          : isUnlocked
                            ? 'bg-[#10B981]/10 text-[#10B981]'
                            : 'bg-zinc-800 text-zinc-600'
                      }`}>
                        {isCurrentRank ? 'CURRENT' : isUnlocked ? 'UNLOCKED' : `LV ${r.level}`}
                      </span>
                    </div>
                    <p className={`text-[9px] font-medium mt-0.5 ${
                      isCurrentRank ? 'text-zinc-400' : isUnlocked ? 'text-zinc-500' : 'text-zinc-700'
                    }`}>{r.subtitle} — {r.perk}</p>
                  </div>
                  <div className="shrink-0">
                    {isCurrentRank ? (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `${r.color}20` }}>
                        <Star className="w-3 h-3" style={{ color: r.color }} />
                      </div>
                    ) : isUnlocked ? (
                      <div className="w-6 h-6 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                        <Check className="w-3 h-3 text-[#10B981]" />
                      </div>
                    ) : isNextRank ? (
                      <span className="text-[8px] font-bold text-[#C5A367]">{levelsToGo} LV</span>
                    ) : (
                      <Lock className="w-3 h-3 text-zinc-800" />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
          {currentRankIndex < RANK_DATA.length - 1 && (
            <div className="px-4 py-3 border-t border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">Progress to {RANK_DATA[currentRankIndex + 1].title}</span>
                <span className="text-[8px] font-bold text-[#C5A367]">Lv {level} → Lv {RANK_DATA[currentRankIndex + 1].level}</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(100, ((level - RANK_DATA[currentRankIndex].level) / (RANK_DATA[currentRankIndex + 1].level - RANK_DATA[currentRankIndex].level)) * 100)}%`
                  }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(to right, ${RANK_DATA[currentRankIndex].color}, ${RANK_DATA[currentRankIndex + 1].color})` }}
                />
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
