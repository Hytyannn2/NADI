'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeId = 'dark' | 'kerajaan' | 'neon' | 'highcontrast';
export type FontSize = 'S' | 'M' | 'L';

export interface ThemeConfig {
  id: ThemeId;
  label: string;
  bg: string; surface: string; surfaceAlt: string; border: string;
  text: string; textMuted: string; accent: string; accentAlt: string;
  success: string; danger: string; warning: string;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  dark: { id: 'dark', label: 'NADI Dark', bg: '#050505', surface: '#0A0A0C', surfaceAlt: '#121214', border: '#27272a', text: '#FAFAFA', textMuted: '#71717a', accent: '#C5A367', accentAlt: '#E8C34B', success: '#10B981', danger: '#EF4444', warning: '#F59E0B' },
  kerajaan: { id: 'kerajaan', label: 'Kerajaan Light', bg: '#F0F4FF', surface: '#FFFFFF', surfaceAlt: '#E8EDF8', border: '#CBD5E1', text: '#1E293B', textMuted: '#64748B', accent: '#1D4ED8', accentAlt: '#3B82F6', success: '#059669', danger: '#DC2626', warning: '#D97706' },
  neon: { id: 'neon', label: 'Neon Rakyat', bg: '#0A0A14', surface: '#0F0F1E', surfaceAlt: '#161628', border: '#2D2D5E', text: '#E0E0FF', textMuted: '#6B6BA0', accent: '#8B5CF6', accentAlt: '#A78BFA', success: '#22D3EE', danger: '#F43F5E', warning: '#FBBF24' },
  highcontrast: { id: 'highcontrast', label: 'High Contrast', bg: '#000000', surface: '#1A1A1A', surfaceAlt: '#2A2A2A', border: '#FFFFFF', text: '#FFFFFF', textMuted: '#CCCCCC', accent: '#FFD700', accentAlt: '#FFEA00', success: '#00FF88', danger: '#FF3333', warning: '#FF9900' },
};

const FONT_SIZES: Record<FontSize, string> = { S: '14px', M: '16px', L: '20px' };

interface ThemeContextType {
  theme: ThemeConfig;
  themeId: ThemeId;
  fontSize: FontSize;
  setThemeId: (id: ThemeId) => void;
  setFontSize: (fs: FontSize) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: THEMES.dark, themeId: 'dark', fontSize: 'M',
  setThemeId: () => {}, setFontSize: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>('dark');
  const [fontSize, setFontSizeState] = useState<FontSize>('M');

  useEffect(() => {
    try {
      const s = localStorage.getItem('nadi_theme');
      if (s && THEMES[s as ThemeId]) setThemeIdState(s as ThemeId);
      const fs = localStorage.getItem('nadi_fontsize');
      if (fs) setFontSizeState(fs as FontSize);
    } catch {}
  }, []);

  useEffect(() => {
    const t = THEMES[themeId];
    document.documentElement.style.setProperty('--nadi-bg', t.bg);
    document.documentElement.style.setProperty('--nadi-surface', t.surface);
    document.documentElement.style.setProperty('--nadi-surface-alt', t.surfaceAlt);
    document.documentElement.style.setProperty('--nadi-border', t.border);
    document.documentElement.style.setProperty('--nadi-text', t.text);
    document.documentElement.style.setProperty('--nadi-text-muted', t.textMuted);
    document.documentElement.style.setProperty('--nadi-accent', t.accent);
    document.documentElement.style.setProperty('--nadi-success', t.success);
    document.documentElement.style.fontSize = FONT_SIZES[fontSize];
  }, [themeId, fontSize]);

  const setThemeId = (id: ThemeId) => { setThemeIdState(id); try { localStorage.setItem('nadi_theme', id); } catch {} };
  const setFontSize = (fs: FontSize) => { setFontSizeState(fs); try { localStorage.setItem('nadi_fontsize', fs); } catch {} };

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeId], themeId, fontSize, setThemeId, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
