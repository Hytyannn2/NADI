'use client';
import { Trophy, Star, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '@/src/context/LanguageContext';
import { useGamification } from './Gamification';
import { useEffect } from 'react';

interface LevelUpToastProps {
  visible: boolean;
  level: number;
  rank: string;
}

export default function LevelUpToast({ visible, level, rank }: LevelUpToastProps) {
  const { t } = useLanguage();
  const { triggerConfetti } = useGamification();

  useEffect(() => {
    if (visible) triggerConfetti();
  }, [visible, triggerConfetti]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.5 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] max-w-xs w-full"
        >
          <div className="relative bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-[#0A0A0C] px-5 py-4 rounded-2xl shadow-[0_0_40px_rgba(197,163,103,0.5)] overflow-hidden">
            {/* Shimmer */}
            <div className="absolute inset-0 animate-shimmer pointer-events-none" />

            <div className="flex items-center gap-3 relative z-10">
              <motion.div
                initial={{ rotate: -180, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="w-12 h-12 rounded-xl bg-[#0A0A0C]/20 flex items-center justify-center"
              >
                <Trophy className="w-6 h-6" />
              </motion.div>
              <div className="flex-1">
                <motion.p
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="font-bold text-base flex items-center gap-1"
                >
                  {t('levelup')}
                </motion.p>
                <motion.p
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-[10px] opacity-80 font-medium"
                >
                  {t('levelup.desc')} {level} — {rank}
                </motion.p>
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="flex items-center gap-1 bg-[#0A0A0C]/20 px-2 py-1 rounded-lg"
              >
                <Star className="w-3 h-3" />
                <span className="text-[10px] font-black">LV{level}</span>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
