'use client';
import { useLanguage } from '@/src/context/LanguageContext';
import { useState, useEffect } from 'react';

export function useGreeting() {
  const { t } = useLanguage();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 6) setGreeting(t('greeting.latenight'));
    else if (h < 12) setGreeting(t('greeting.morning'));
    else if (h < 15) setGreeting(t('greeting.noon'));
    else if (h < 18) setGreeting(t('greeting.evening'));
    else setGreeting(t('greeting.night'));
  }, [t]);

  return greeting;
}
