'use client';
import { motion } from 'motion/react';
import { useLanguage } from '@/src/context/LanguageContext';

export default function LoadingScreen() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505]">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-[#C5A367]"
        />
        <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest">{t('loading')}</p>
      </div>
    </div>
  );
}
