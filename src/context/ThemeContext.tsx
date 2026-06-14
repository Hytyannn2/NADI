'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MotionConfig } from 'motion/react';

export type ThemeId = 'light' | 'dark';
export type FontSize = 'S' | 'M' | 'L';
export type ColorblindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

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
  highContrast: boolean;
  colorblindMode: ColorblindMode;
  reduceMotion: boolean;
  dyslexiaFont: boolean;
  setThemeId: (id: ThemeId) => void;
  setFontSize: (fs: FontSize) => void;
  setHighContrast: (val: boolean) => void;
  setColorblindMode: (mode: ColorblindMode) => void;
  setReduceMotion: (val: boolean) => void;
  setDyslexiaFont: (val: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: THEMES.light, themeId: 'light', fontSize: 'M',
  highContrast: false, colorblindMode: 'none', reduceMotion: false, dyslexiaFont: false,
  setThemeId: () => {}, setFontSize: () => {},
  setHighContrast: () => {}, setColorblindMode: () => {}, setReduceMotion: () => {}, setDyslexiaFont: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>('light');
  const [fontSize, setFontSizeState] = useState<FontSize>('M');
  const [highContrast, setHighContrastState] = useState(false);
  const [colorblindMode, setColorblindModeState] = useState<ColorblindMode>('none');
  const [reduceMotion, setReduceMotionState] = useState(false);
  const [dyslexiaFont, setDyslexiaFontState] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem('nadi_theme');
      if (s && THEMES[s as ThemeId]) setThemeIdState(s as ThemeId);
      const fs = localStorage.getItem('nadi_fontsize');
      if (fs) setFontSizeState(fs as FontSize);
      const hc = localStorage.getItem('nadi_highcontrast');
      if (hc) setHighContrastState(hc === 'true');
      const cb = localStorage.getItem('nadi_colorblind');
      if (cb) setColorblindModeState(cb as ColorblindMode);
      const rm = localStorage.getItem('nadi_reducemotion');
      if (rm) setReduceMotionState(rm === 'true');
      const df = localStorage.getItem('nadi_dyslexiafont');
      if (df) setDyslexiaFontState(df === 'true');
    } catch {}
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    // Theme
    if (themeId === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    
    // High Contrast
    if (highContrast) root.classList.add('high-contrast');
    else root.classList.remove('high-contrast');

    // Dyslexia Font
    if (dyslexiaFont) root.classList.add('font-dyslexic');
    else root.classList.remove('font-dyslexic');

    // Colorblind Modes
    root.classList.remove('colorblind-protanopia', 'colorblind-deuteranopia', 'colorblind-tritanopia');
    if (colorblindMode !== 'none') root.classList.add(`colorblind-${colorblindMode}`);

    root.style.fontSize = FONT_SIZES[fontSize];
  }, [themeId, fontSize, highContrast, dyslexiaFont, colorblindMode]);

  const setThemeId = (id: ThemeId) => { setThemeIdState(id); try { localStorage.setItem('nadi_theme', id); } catch {} };
  const setFontSize = (fs: FontSize) => { setFontSizeState(fs); try { localStorage.setItem('nadi_fontsize', fs); } catch {} };
  const setHighContrast = (val: boolean) => { setHighContrastState(val); try { localStorage.setItem('nadi_highcontrast', val.toString()); } catch {} };
  const setColorblindMode = (mode: ColorblindMode) => { setColorblindModeState(mode); try { localStorage.setItem('nadi_colorblind', mode); } catch {} };
  const setReduceMotion = (val: boolean) => { setReduceMotionState(val); try { localStorage.setItem('nadi_reducemotion', val.toString()); } catch {} };
  const setDyslexiaFont = (val: boolean) => { setDyslexiaFontState(val); try { localStorage.setItem('nadi_dyslexiafont', val.toString()); } catch {} };

  return (
    <ThemeContext.Provider value={{ 
      theme: THEMES[themeId], themeId, fontSize, 
      highContrast, colorblindMode, reduceMotion, dyslexiaFont,
      setThemeId, setFontSize, setHighContrast, setColorblindMode, setReduceMotion, setDyslexiaFont 
    }}>
      <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
        {children}
      </MotionConfig>
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
