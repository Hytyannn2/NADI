'use client';
import { motion } from 'motion/react';
import { useLanguage } from '@/src/context/LanguageContext';

export default function LoadingScreen() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-[3px] animate-spin" style={{ borderColor: 'var(--border-default)', borderTopColor: 'var(--accent)' }} />
        <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{t('loading')}</p>
      </div>
    </div>
  );
}
