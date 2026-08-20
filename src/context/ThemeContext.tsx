'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { MotionConfig } from 'motion/react';

// ── Types ──────────────────────────────────────────────────────────
export type ThemeId = 'light' | 'dark' | 'system';
export type FontSize = 'S' | 'M' | 'L';
export type ColorblindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
export type ClockFormat = '12h' | '24h';
export type AutoRefreshRate = '30s' | '1m' | '5m' | 'off';
export type SensorSamplingRate = '30s' | '1m' | '2m' | '5m' | '10m' | '30m' | '1h';
export type LocationPrecision = 'high' | 'fuzzy';
export type NotifRadius = '5km' | '10km' | '25km';

export interface ThemeConfig {
  id: ThemeId;
  label: string;
  icon: string;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  light: { id: 'light', label: 'Light', icon: '' },
  dark: { id: 'dark', label: 'Dark', icon: '' },
  system: { id: 'system', label: 'Sistem', icon: '' },
};

const FONT_SIZES: Record<FontSize, string> = { S: '14px', M: '16px', L: '20px' };

export const SENSOR_SAMPLING_RATES: { value: SensorSamplingRate; label: string }[] = [
  { value: '30s', label: '30s' },
  { value: '1m', label: '1 min' },
  { value: '2m', label: '2 min' },
  { value: '5m', label: '5 min' },
  { value: '10m', label: '10 min' },
  { value: '30m', label: '30 min' },
  { value: '1h', label: '1 jam' },
];

// ── Context Interface ──────────────────────────────────────────────
interface ThemeContextType {
  // Existing
  theme: ThemeConfig;
  themeId: ThemeId;
  resolvedTheme: 'light' | 'dark'; // actual applied theme (resolves 'system')
  fontSize: FontSize;
  highContrast: boolean;
  colorblindMode: ColorblindMode;
  reduceMotion: boolean;
  dyslexiaFont: boolean;
  clockFormat: ClockFormat;
  soundEnabled: boolean;
  compactView: boolean;
  autoRefresh: AutoRefreshRate;

  // New — Sensor & IoT
  sensorSamplingRate: SensorSamplingRate;

  // New — Notifications
  emergencySiren: boolean;
  notifAduan: boolean;
  notifBantuan: boolean;
  notifBantuanRadius: NotifRadius;
  notifKomuniti: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:mm
  quietHoursEnd: string;   // HH:mm

  // New — Privacy
  locationPrecision: LocationPrecision;
  largeTouchTargets: boolean;

  // Setters — Existing
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

  // Setters — New
  setSensorSamplingRate: (rate: SensorSamplingRate) => void;
  setEmergencySiren: (val: boolean) => void;
  setNotifAduan: (val: boolean) => void;
  setNotifBantuan: (val: boolean) => void;
  setNotifBantuanRadius: (radius: NotifRadius) => void;
  setNotifKomuniti: (val: boolean) => void;
  setQuietHoursEnabled: (val: boolean) => void;
  setQuietHoursStart: (time: string) => void;
  setQuietHoursEnd: (time: string) => void;
  setLocationPrecision: (mode: LocationPrecision) => void;
  setLargeTouchTargets: (val: boolean) => void;

  // Functional Pipeline Utilities
  formatTime: (dateInput?: Date | string | number) => string;
  applyLocationPrecision: (lat: number, lng: number) => { lat: number; lng: number };
  getSamplingIntervalMs: () => number;
  getAutoRefreshIntervalMs: () => number | null;
  isNotificationAllowed: (category: 'aduan' | 'bantuan' | 'komuniti' | 'disaster', distanceKm?: number) => boolean;
  playAlertSound: (type?: 'beep' | 'siren' | 'success') => void;
}

const defaults: ThemeContextType = {
  theme: THEMES.dark, themeId: 'dark', resolvedTheme: 'dark',
  fontSize: 'M', highContrast: false, colorblindMode: 'none',
  reduceMotion: false, dyslexiaFont: false, clockFormat: '12h',
  soundEnabled: true, compactView: false, autoRefresh: '1m',
  sensorSamplingRate: '5m',
  emergencySiren: true, notifAduan: true, notifBantuan: true, notifBantuanRadius: '10km',
  notifKomuniti: true, quietHoursEnabled: false, quietHoursStart: '23:00', quietHoursEnd: '07:00',
  locationPrecision: 'high', largeTouchTargets: false,
  setThemeId: () => {}, setFontSize: () => {}, setHighContrast: () => {},
  setColorblindMode: () => {}, setReduceMotion: () => {}, setDyslexiaFont: () => {},
  setClockFormat: () => {}, setSoundEnabled: () => {}, setCompactView: () => {},
  setAutoRefresh: () => {}, setSensorSamplingRate: () => {},
  setEmergencySiren: () => {}, setNotifAduan: () => {}, setNotifBantuan: () => {},
  setNotifBantuanRadius: () => {}, setNotifKomuniti: () => {},
  setQuietHoursEnabled: () => {}, setQuietHoursStart: () => {}, setQuietHoursEnd: () => {},
  setLocationPrecision: () => {}, setLargeTouchTargets: () => {},
  formatTime: () => '',
  applyLocationPrecision: (lat, lng) => ({ lat, lng }),
  getSamplingIntervalMs: () => 300000,
  getAutoRefreshIntervalMs: () => 60000,
  isNotificationAllowed: () => true,
  playAlertSound: () => {},
};

const ThemeContext = createContext<ThemeContextType>(defaults);

// ── Helper: localStorage get/set with prefix ──────────────────────
function lsGet(key: string): string | null {
  try { return localStorage.getItem(`nadi_${key}`); } catch { return null; }
}
function lsSet(key: string, val: string) {
  try { localStorage.setItem(`nadi_${key}`, val); } catch {}
}

// ── Provider ──────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Existing state
  const [themeId, setThemeIdState] = useState<ThemeId>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');
  const [fontSize, setFontSizeState] = useState<FontSize>('M');
  const [highContrast, setHighContrastState] = useState(false);
  const [colorblindMode, setColorblindModeState] = useState<ColorblindMode>('none');
  const [reduceMotion, setReduceMotionState] = useState(false);
  const [dyslexiaFont, setDyslexiaFontState] = useState(false);
  const [clockFormat, setClockFormatState] = useState<ClockFormat>('12h');
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [compactView, setCompactViewState] = useState(false);
  const [autoRefresh, setAutoRefreshState] = useState<AutoRefreshRate>('1m');

  // New state — IoT
  const [sensorSamplingRate, setSensorSamplingRateState] = useState<SensorSamplingRate>('5m');

  // New state — Notifications
  const [emergencySiren, setEmergencySirenState] = useState(true);
  const [notifAduan, setNotifAduanState] = useState(true);
  const [notifBantuan, setNotifBantuanState] = useState(true);
  const [notifBantuanRadius, setNotifBantuanRadiusState] = useState<NotifRadius>('10km');
  const [notifKomuniti, setNotifKomunitiState] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabledState] = useState(false);
  const [quietHoursStart, setQuietHoursStartState] = useState('23:00');
  const [quietHoursEnd, setQuietHoursEndState] = useState('07:00');

  // New state — Privacy
  const [locationPrecision, setLocationPrecisionState] = useState<LocationPrecision>('high');
  const [largeTouchTargets, setLargeTouchTargetsState] = useState(false);

  // ── Load from localStorage on mount ────────────────────────────
  useEffect(() => {
    const s = lsGet('theme');
    if (s && (s === 'light' || s === 'dark' || s === 'system')) setThemeIdState(s as ThemeId);
    const fs = lsGet('fontsize');
    if (fs) setFontSizeState(fs as FontSize);
    const hc = lsGet('highcontrast');
    if (hc) setHighContrastState(hc === 'true');
    const cb = lsGet('colorblind');
    if (cb) setColorblindModeState(cb as ColorblindMode);
    const rm = lsGet('reducemotion');
    if (rm) setReduceMotionState(rm === 'true');
    const df = lsGet('dyslexiafont');
    if (df) setDyslexiaFontState(df === 'true');
    const cf = lsGet('clockformat');
    if (cf === '12h' || cf === '24h') setClockFormatState(cf);
    const se = lsGet('soundenabled');
    if (se !== null) setSoundEnabledState(se === 'true');
    const cv = lsGet('compactview');
    if (cv !== null) setCompactViewState(cv === 'true');
    const ar = lsGet('autorefresh');
    if (ar) setAutoRefreshState(ar as AutoRefreshRate);

    // New settings
    const ssr = lsGet('sensorsampling');
    if (ssr) setSensorSamplingRateState(ssr as SensorSamplingRate);
    const es = lsGet('emergencysiren');
    if (es !== null) setEmergencySirenState(es === 'true');
    const na = lsGet('notifaduan');
    if (na !== null) setNotifAduanState(na === 'true');
    const nb = lsGet('notifbantuan');
    if (nb !== null) setNotifBantuanState(nb === 'true');
    const nbr = lsGet('notifbantuanradius');
    if (nbr) setNotifBantuanRadiusState(nbr as NotifRadius);
    const nk = lsGet('notifkomuniti');
    if (nk !== null) setNotifKomunitiState(nk === 'true');
    const qhe = lsGet('quietenabled');
    if (qhe !== null) setQuietHoursEnabledState(qhe === 'true');
    const qhs = lsGet('quietstart');
    if (qhs) setQuietHoursStartState(qhs);
    const qhend = lsGet('quietend');
    if (qhend) setQuietHoursEndState(qhend);
    const lp = lsGet('locationprecision');
    if (lp) setLocationPrecisionState(lp as LocationPrecision);
    const ltt = lsGet('largetouchtargets');
    if (ltt !== null) setLargeTouchTargetsState(ltt === 'true');
  }, []);

  // ── System theme listener ──────────────────────────────────────
  useEffect(() => {
    const resolveTheme = () => {
      if (themeId === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setResolvedTheme(prefersDark ? 'dark' : 'light');
      } else {
        setResolvedTheme(themeId);
      }
    };

    resolveTheme();

    if (themeId === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => resolveTheme();
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
  }, [themeId]);

  // ── Apply theme & classes to DOM ───────────────────────────────
  useEffect(() => {
    const root = document.documentElement;

    // Theme
    if (resolvedTheme === 'dark') root.classList.add('dark');
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

    // Large Touch Targets
    if (largeTouchTargets) root.classList.add('large-touch');
    else root.classList.remove('large-touch');

    // Colorblind Modes
    root.classList.remove('colorblind-protanopia', 'colorblind-deuteranopia', 'colorblind-tritanopia');
    if (colorblindMode !== 'none') root.classList.add(`colorblind-${colorblindMode}`);

    root.style.fontSize = FONT_SIZES[fontSize];
  }, [resolvedTheme, fontSize, highContrast, dyslexiaFont, colorblindMode, compactView, largeTouchTargets]);

  // ── Persisted setters ──────────────────────────────────────────
  const setThemeId = (id: ThemeId) => { setThemeIdState(id); lsSet('theme', id); };
  const setFontSize = (fs: FontSize) => { setFontSizeState(fs); lsSet('fontsize', fs); };
  const setHighContrast = (val: boolean) => { setHighContrastState(val); lsSet('highcontrast', val.toString()); };
  const setColorblindMode = (mode: ColorblindMode) => { setColorblindModeState(mode); lsSet('colorblind', mode); };
  const setReduceMotion = (val: boolean) => { setReduceMotionState(val); lsSet('reducemotion', val.toString()); };
  const setDyslexiaFont = (val: boolean) => { setDyslexiaFontState(val); lsSet('dyslexiafont', val.toString()); };
  const setClockFormat = (format: ClockFormat) => { setClockFormatState(format); lsSet('clockformat', format); };
  const setSoundEnabled = (val: boolean) => { setSoundEnabledState(val); lsSet('soundenabled', val.toString()); };
  const setCompactView = (val: boolean) => { setCompactViewState(val); lsSet('compactview', val.toString()); };
  const setAutoRefresh = (rate: AutoRefreshRate) => { setAutoRefreshState(rate); lsSet('autorefresh', rate); };

  // New setters
  const setSensorSamplingRate = (rate: SensorSamplingRate) => { setSensorSamplingRateState(rate); lsSet('sensorsampling', rate); };
  const setEmergencySiren = (val: boolean) => { setEmergencySirenState(val); lsSet('emergencysiren', val.toString()); };
  const setNotifAduan = (val: boolean) => { setNotifAduanState(val); lsSet('notifaduan', val.toString()); };
  const setNotifBantuan = (val: boolean) => { setNotifBantuanState(val); lsSet('notifbantuan', val.toString()); };
  const setNotifBantuanRadius = (radius: NotifRadius) => { setNotifBantuanRadiusState(radius); lsSet('notifbantuanradius', radius); };
  const setNotifKomuniti = (val: boolean) => { setNotifKomunitiState(val); lsSet('notifkomuniti', val.toString()); };
  const setQuietHoursEnabled = (val: boolean) => { setQuietHoursEnabledState(val); lsSet('quietenabled', val.toString()); };
  const setQuietHoursStart = (time: string) => { setQuietHoursStartState(time); lsSet('quietstart', time); };
  const setQuietHoursEnd = (time: string) => { setQuietHoursEndState(time); lsSet('quietend', time); };
  const setLocationPrecision = (mode: LocationPrecision) => { setLocationPrecisionState(mode); lsSet('locationprecision', mode); };
  const setLargeTouchTargets = (val: boolean) => { setLargeTouchTargetsState(val); lsSet('largetouchtargets', val.toString()); };

  // ── formatTime utility ─────────────────────────────────────────
  const formatTime = useCallback((dateInput?: Date | string | number): string => {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) return '';
    if (clockFormat === '24h') {
      return d.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }
    return d.toLocaleTimeString('ms-MY', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }, [clockFormat]);

  // ── applyLocationPrecision utility ────────────────────────────
  const applyLocationPrecision = useCallback((lat: number, lng: number): { lat: number; lng: number } => {
    if (locationPrecision === 'high') return { lat, lng };
    // Fuzzy mode: offset by ~400-500m (approx 0.004 degrees)
    const latOffset = (Math.sin(lat * 1000) * 0.0035) + 0.001;
    const lngOffset = (Math.cos(lng * 1000) * 0.0035) + 0.001;
    return {
      lat: Number((lat + latOffset).toFixed(5)),
      lng: Number((lng + lngOffset).toFixed(5))
    };
  }, [locationPrecision]);

  // ── getSamplingIntervalMs utility ─────────────────────────────
  const getSamplingIntervalMs = useCallback((): number => {
    switch (sensorSamplingRate) {
      case '30s': return 30000;
      case '1m': return 60000;
      case '2m': return 120000;
      case '5m': return 300000;
      case '10m': return 600000;
      case '30m': return 1800000;
      case '1h': return 3600000;
      default: return 300000;
    }
  }, [sensorSamplingRate]);

  // ── getAutoRefreshIntervalMs utility ──────────────────────────
  const getAutoRefreshIntervalMs = useCallback((): number | null => {
    switch (autoRefresh) {
      case '30s': return 30000;
      case '1m': return 60000;
      case '5m': return 300000;
      case 'off': return null;
      default: return 60000;
    }
  }, [autoRefresh]);

  // ── isNotificationAllowed utility ─────────────────────────────
  const isNotificationAllowed = useCallback((category: 'aduan' | 'bantuan' | 'komuniti' | 'disaster', distanceKm?: number): boolean => {
    // Disaster / Bencana alerts ALWAYS bypass quiet hours
    if (category === 'disaster') return true;

    // Check quiet hours (DND)
    if (quietHoursEnabled) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [startH, startM] = quietHoursStart.split(':').map(Number);
      const [endH, endM] = quietHoursEnd.split(':').map(Number);
      const startMinutes = (startH || 0) * 60 + (startM || 0);
      const endMinutes = (endH || 0) * 60 + (endM || 0);

      const inQuietHours = startMinutes <= endMinutes
        ? currentMinutes >= startMinutes && currentMinutes <= endMinutes
        : currentMinutes >= startMinutes || currentMinutes <= endMinutes; // spans midnight

      if (inQuietHours) return false;
    }

    // Check category toggles
    if (category === 'aduan' && !notifAduan) return false;
    if (category === 'komuniti' && !notifKomuniti) return false;
    if (category === 'bantuan') {
      if (!notifBantuan) return false;
      if (distanceKm !== undefined) {
        const radiusNum = parseInt(notifBantuanRadius.replace('km', ''), 10) || 10;
        if (distanceKm > radiusNum) return false;
      }
    }

    return true;
  }, [quietHoursEnabled, quietHoursStart, quietHoursEnd, notifAduan, notifBantuan, notifBantuanRadius, notifKomuniti]);

  // ── playAlertSound utility ────────────────────────────────────
  const playAlertSound = useCallback((type: 'beep' | 'siren' | 'success' = 'beep') => {
    if (type === 'siren' && !emergencySiren) return;
    if (type !== 'siren' && !soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      if (type === 'siren') {
        // Dual-tone emergency siren
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(800, ctx.currentTime);
        osc1.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.3);
        osc1.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.6);
        osc2.frequency.setValueAtTime(790, ctx.currentTime);
        osc2.frequency.linearRampToValueAtTime(1190, ctx.currentTime + 0.3);
        osc2.frequency.linearRampToValueAtTime(790, ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 0.8);
        osc2.stop(ctx.currentTime + 0.8);
      } else if (type === 'success') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        // Default subtle alert beep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch {}
  }, [soundEnabled, emergencySiren]);

  return (
    <ThemeContext.Provider value={{ 
      theme: THEMES[themeId], themeId, resolvedTheme, fontSize, 
      highContrast, colorblindMode, reduceMotion, dyslexiaFont,
      clockFormat, soundEnabled, compactView, autoRefresh,
      sensorSamplingRate,
      emergencySiren, notifAduan, notifBantuan, notifBantuanRadius,
      notifKomuniti, quietHoursEnabled, quietHoursStart, quietHoursEnd,
      locationPrecision, largeTouchTargets,
      setThemeId, setFontSize, setHighContrast, setColorblindMode, setReduceMotion, setDyslexiaFont,
      setClockFormat, setSoundEnabled, setCompactView, setAutoRefresh,
      setSensorSamplingRate,
      setEmergencySiren, setNotifAduan, setNotifBantuan, setNotifBantuanRadius,
      setNotifKomuniti, setQuietHoursEnabled, setQuietHoursStart, setQuietHoursEnd,
      setLocationPrecision, setLargeTouchTargets,
      formatTime, applyLocationPrecision, getSamplingIntervalMs, getAutoRefreshIntervalMs,
      isNotificationAllowed, playAlertSound
    }}>
      <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
        {children}
      </MotionConfig>
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
