'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeId = 'light' | 'dark';
export type FontSize = 'S' | 'M' | 'L';

export interface ThemeConfig {
  id: ThemeId;
  label: string;
  icon: string;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  light: { id: 'light', label: 'Light', icon: '☀️' },
  dark: { id: 'dark', label: 'Dark', icon: '🌙' },
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
  theme: THEMES.light, themeId: 'light', fontSize: 'M',
  setThemeId: () => {}, setFontSize: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>('light');
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
    // Toggle .dark class on <html> for CSS var switching
    if (themeId === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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
