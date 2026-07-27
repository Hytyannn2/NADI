'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MotionConfig } from 'motion/react';

export type ThemeId = 'light' | 'dark';
export type FontSize = 'S' | 'M' | 'L';
export type ColorblindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
export type ClockFormat = '12h' | '24h';
export type AutoRefreshRate = '30s' | '1m' | '5m' | 'off';

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
  clockFormat: ClockFormat;
  soundEnabled: boolean;
  compactView: boolean;
  autoRefresh: AutoRefreshRate;
  setThemeId: (id: ThemeId) => void;
  setFontSize: (fs: FontSize) => void;
  setHighContrast: (val: boolean) => void;
  setColorblindMode: (mode: ColorblindMode) => void;
  setReduceMotion: (val: boolean) => void;
  setDyslexiaFont: (val: boolean) => void;
  setClockFormat: (format: ClockFormat) => void;
  setSoundEnabled: (val: boolean) => void;
  setCompactView: (val: boolean) => void;
  setAutoRefresh: (rate: AutoRefreshRate) => void;
  formatTime: (dateInput?: Date | string | number) => string;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: THEMES.light, themeId: 'light', fontSize: 'M',
  highContrast: false, colorblindMode: 'none', reduceMotion: false, dyslexiaFont: false,
  clockFormat: '12h', soundEnabled: true, compactView: false, autoRefresh: '1m',
  setThemeId: () => {}, setFontSize: () => {},
  setHighContrast: () => {}, setColorblindMode: () => {}, setReduceMotion: () => {}, setDyslexiaFont: () => {},
  setClockFormat: () => {}, setSoundEnabled: () => {}, setCompactView: () => {}, setAutoRefresh: () => {},
  formatTime: () => '',
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>('light');
  const [fontSize, setFontSizeState] = useState<FontSize>('M');
  const [highContrast, setHighContrastState] = useState(false);
  const [colorblindMode, setColorblindModeState] = useState<ColorblindMode>('none');
  const [reduceMotion, setReduceMotionState] = useState(false);
  const [dyslexiaFont, setDyslexiaFontState] = useState(false);
  const [clockFormat, setClockFormatState] = useState<ClockFormat>('12h');
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [compactView, setCompactViewState] = useState(false);
  const [autoRefresh, setAutoRefreshState] = useState<AutoRefreshRate>('1m');

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
      const cf = localStorage.getItem('nadi_clockformat');
      if (cf === '12h' || cf === '24h') setClockFormatState(cf);
      const se = localStorage.getItem('nadi_soundenabled');
      if (se !== null) setSoundEnabledState(se === 'true');
      const cv = localStorage.getItem('nadi_compactview');
      if (cv !== null) setCompactViewState(cv === 'true');
      const ar = localStorage.getItem('nadi_autorefresh');
      if (ar) setAutoRefreshState(ar as AutoRefreshRate);
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

    // Compact View
    if (compactView) root.classList.add('compact-ui');
    else root.classList.remove('compact-ui');

    // Colorblind Modes
    root.classList.remove('colorblind-protanopia', 'colorblind-deuteranopia', 'colorblind-tritanopia');
    if (colorblindMode !== 'none') root.classList.add(`colorblind-${colorblindMode}`);

    root.style.fontSize = FONT_SIZES[fontSize];
  }, [themeId, fontSize, highContrast, dyslexiaFont, colorblindMode, compactView]);

  const setThemeId = (id: ThemeId) => { setThemeIdState(id); try { localStorage.setItem('nadi_theme', id); } catch {} };
  const setFontSize = (fs: FontSize) => { setFontSizeState(fs); try { localStorage.setItem('nadi_fontsize', fs); } catch {} };
  const setHighContrast = (val: boolean) => { setHighContrastState(val); try { localStorage.setItem('nadi_highcontrast', val.toString()); } catch {} };
  const setColorblindMode = (mode: ColorblindMode) => { setColorblindModeState(mode); try { localStorage.setItem('nadi_colorblind', mode); } catch {} };
  const setReduceMotion = (val: boolean) => { setReduceMotionState(val); try { localStorage.setItem('nadi_reducemotion', val.toString()); } catch {} };
  const setDyslexiaFont = (val: boolean) => { setDyslexiaFontState(val); try { localStorage.setItem('nadi_dyslexiafont', val.toString()); } catch {} };
  const setClockFormat = (format: ClockFormat) => { setClockFormatState(format); try { localStorage.setItem('nadi_clockformat', format); } catch {} };
  const setSoundEnabled = (val: boolean) => { setSoundEnabledState(val); try { localStorage.setItem('nadi_soundenabled', val.toString()); } catch {} };
  const setCompactView = (val: boolean) => { setCompactViewState(val); try { localStorage.setItem('nadi_compactview', val.toString()); } catch {} };
  const setAutoRefresh = (rate: AutoRefreshRate) => { setAutoRefreshState(rate); try { localStorage.setItem('nadi_autorefresh', rate); } catch {} };

  const formatTime = (dateInput?: Date | string | number): string => {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: clockFormat === '12h'
    });
  };

  return (
    <ThemeContext.Provider value={{ 
      theme: THEMES[themeId], themeId, fontSize, 
      highContrast, colorblindMode, reduceMotion, dyslexiaFont,
      clockFormat, soundEnabled, compactView, autoRefresh,
      setThemeId, setFontSize, setHighContrast, setColorblindMode, setReduceMotion, setDyslexiaFont,
      setClockFormat, setSoundEnabled, setCompactView, setAutoRefresh, formatTime
    }}>
      <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
        {children}
      </MotionConfig>
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
