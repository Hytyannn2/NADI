'use client';
import { useLanguage } from '@/src/context/LanguageContext';

export function useGreeting() {
  const { t } = useLanguage();
  const h = new Date().getHours();
  if (h < 6) return t('greeting.latenight');
  if (h < 12) return t('greeting.morning');
  if (h < 15) return t('greeting.noon');
  if (h < 18) return t('greeting.evening');
  return t('greeting.night');
}
