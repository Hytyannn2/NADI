'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import {
  X, Sun, Moon, Monitor, Globe, LogOut, Award, Eye, Baseline, Activity, Palette,
  Clock, Volume2, RefreshCw, LayoutGrid, SlidersHorizontal, ShieldCheck, Scale,
  Bell, BellOff, Siren, MapPin, MapPinOff, Download, Trash2, Radio, Gauge,
  MoonStar, Shield, FileJson, FileSpreadsheet, Smartphone
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage, LANGUAGES } from '@/src/context/LanguageContext';
import {
  useTheme, THEMES, SENSOR_SAMPLING_RATES,
  type FontSize, type ColorblindMode, type ThemeId, type ClockFormat,
  type AutoRefreshRate, type SensorSamplingRate, type NotifRadius, type LocationPrecision
} from '@/src/context/ThemeContext';

// ── Tab definitions ─────────────────────────────────────────────
type SettingsTab = 'paparan' | 'sensor' | 'amaran' | 'privasi' | 'akses';

const TABS: { id: SettingsTab; label: string; icon: typeof Monitor; color: string }[] = [
  { id: 'paparan', label: 'Paparan', icon: Monitor, color: '#8B5CF6' },
  { id: 'sensor', label: 'Sensor', icon: Radio, color: '#10B981' },
  { id: 'amaran', label: 'Amaran', icon: Bell, color: '#F59E0B' },
  { id: 'privasi', label: 'Privasi', icon: Shield, color: '#3B82F6' },
  { id: 'akses', label: 'Akses', icon: Eye, color: '#EC4899' },
];

// ── Reusable Toggle Switch ──────────────────────────────────────
function ToggleSwitch({ checked, onChange, size = 'md' }: { checked: boolean; onChange: (val: boolean) => void; size?: 'sm' | 'md' }) {
  const w = size === 'sm' ? 'w-9' : 'w-11';
  const h = size === 'sm' ? 'h-5' : 'h-6';
  const dot = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5';
  const translateOn = size === 'sm' ? 'translateX(17px)' : 'translateX(21px)';
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`${w} ${h} rounded-full relative transition-colors duration-200 shrink-0 cursor-pointer`}
      style={{ background: checked ? 'var(--accent)' : 'var(--border-default)' }}
    >
      <div
        className={`${dot} rounded-full bg-white absolute top-1/2 shadow-sm transition-transform duration-200`}
        style={{ transform: `translateY(-50%) ${checked ? translateOn : 'translateX(3px)'}` }}
      />
    </button>
  );
}

// ── Reusable Setting Row ────────────────────────────────────────
function SettingRow({ icon: Icon, iconColor, title, desc, children, noBorder }: {
  icon: typeof Bell; iconColor?: string; title: string; desc?: string;
  children: React.ReactNode; noBorder?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-3.5 ${noBorder ? '' : 'border-b'} transition-colors hover:bg-white/[0.02]`}
      style={{ borderColor: 'var(--border-default)' }}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="p-1.5 rounded-lg shrink-0" style={{ background: `${iconColor || 'var(--accent)'}20`, color: iconColor || 'var(--accent)' }}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{title}</p>
          {desc && <p className="text-[10px] leading-tight mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{desc}</p>}
        </div>
      </div>
      <div className="shrink-0 ml-3">{children}</div>
    </div>
  );
}

// ── Pill Selector ───────────────────────────────────────────────
function PillSelector<T extends string>({ options, value, onChange, columns }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; columns?: number;
}) {
  return (
    <div className={`grid gap-1.5 ${columns ? `grid-cols-${columns}` : ''}`}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : { display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className="py-2 px-3 rounded-xl text-[11px] font-bold transition-all border text-center"
          style={value === opt.value
            ? { background: 'var(--accent-muted)', color: 'var(--accent)', borderColor: 'var(--accent)' }
            : { background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'transparent' }
          }>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Props ───────────────────────────────────────────────────────
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── Main Component ──────────────────────────────────────────────
export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const themeCtx = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('paparan');
  const [storageUsage, setStorageUsage] = useState<{ used: number; quota: number } | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  // Estimate storage on mount
  useEffect(() => {
    if (isOpen && navigator.storage?.estimate) {
      navigator.storage.estimate().then(est => {
        setStorageUsage({ used: est.usage || 0, quota: est.quota || 0 });
      }).catch(() => {});
    }
  }, [isOpen]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      // Clear caches
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      }
      // Re-estimate
      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        setStorageUsage({ used: est.usage || 0, quota: est.quota || 0 });
      }
    } catch {} finally {
      setClearingCache(false);
    }
  };

  const handleExportAduan = (format: 'json' | 'csv') => {
    try {
      const raw = localStorage.getItem('nadi_aduan_records');
      if (!raw) { alert('Tiada rekod aduan untuk dimuat turun.'); return; }
      const data = JSON.parse(raw);
      let blob: Blob;
      let filename: string;
      if (format === 'json') {
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        filename = `nadi_aduan_${Date.now()}.json`;
      } else {
        const headers = Object.keys(data[0] || {}).join(',');
        const rows = data.map((r: any) => Object.values(r).map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
        filename = `nadi_aduan_${Date.now()}.csv`;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Gagal memuat turun rekod.'); }
  };

  const handleExportLoRaWAN = (format: 'json' | 'csv') => {
    try {
      const raw = localStorage.getItem('nadi_lorawan_records');
      if (!raw) { alert('Tiada rekod paras air untuk dimuat turun.'); return; }
      const data = JSON.parse(raw);
      let blob: Blob;
      let filename: string;
      if (format === 'json') {
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        filename = `nadi_lorawan_${Date.now()}.json`;
      } else {
        const headers = Object.keys(data[0] || {}).join(',');
        const rows = data.map((r: any) => Object.values(r).map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
        filename = `nadi_lorawan_${Date.now()}.csv`;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Gagal memuat turun rekod.'); }
  };

  // Theme switch with view transition
  const handleThemeSwitch = (tid: ThemeId, e: React.MouseEvent) => {
    if (themeCtx.themeId === tid) return;
    // @ts-ignore
    if (!document.startViewTransition || themeCtx.reduceMotion) {
      themeCtx.setThemeId(tid);
      return;
    }
    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    // @ts-ignore
    const transition = document.startViewTransition(() => { themeCtx.setThemeId(tid); });
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
        { duration: 500, easing: 'ease-in', pseudoElement: '::view-transition-new(root)' }
      );
    });
  };

  // ── Tab Content Renderers ─────────────────────────────────────

  const renderPaparan = () => (
    <div className="space-y-4">
      {/* Theme */}
      <div className="p-3 rounded-2xl" style={{ background: 'var(--bg-subtle)' }}>
        <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--text-primary)' }}>{t('settings.theme')}</p>
        <div className="flex items-center gap-2">
          {(['light', 'dark', 'system'] as ThemeId[]).map(tid => (
            <button key={tid} onClick={(e) => handleThemeSwitch(tid, e)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={themeCtx.themeId === tid
                ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }
                : { color: 'var(--text-muted)' }
              }>
              {tid === 'light' ? <Sun className="w-4 h-4" /> : tid === 'dark' ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              {THEMES[tid].label}
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="p-3 rounded-2xl" style={{ background: 'var(--bg-subtle)' }}>
        <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--text-primary)' }}>{t('menu.language')}</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)}
              className="flex-none flex flex-col items-center justify-center gap-1 min-w-[70px] p-2 rounded-xl transition-all border"
              style={lang === l.code
                ? { background: 'var(--accent-muted)', color: 'var(--accent)', borderColor: 'var(--accent)' }
                : { background: 'var(--bg-card)', color: 'var(--text-muted)', borderColor: 'transparent' }
              }>
              <span className="text-lg">{l.flag}</span>
              <span className="text-[10px] font-bold">{l.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Clock Format */}
      <div className="p-3 rounded-2xl" style={{ background: 'var(--bg-subtle)' }}>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Format Jam</p>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
            {themeCtx.clockFormat === '12h' ? '1:30 PM' : '13:30'}
          </span>
        </div>
        <PillSelector
          options={[{ value: '12h' as ClockFormat, label: '12-Hour' }, { value: '24h' as ClockFormat, label: '24-Hour' }]}
          value={themeCtx.clockFormat}
          onChange={themeCtx.setClockFormat}
        />
      </div>

      {/* Compact View & Sound */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
        <SettingRow icon={LayoutGrid} iconColor="#8B5CF6" title="Paparan Padat" desc="Kurangkan jarak elemen">
          <ToggleSwitch checked={themeCtx.compactView} onChange={themeCtx.setCompactView} />
        </SettingRow>
        <SettingRow icon={Volume2} iconColor="#F59E0B" title="Kesan Bunyi" desc="Bunyi makluman & pemberitahuan" noBorder>
          <ToggleSwitch checked={themeCtx.soundEnabled} onChange={themeCtx.setSoundEnabled} />
        </SettingRow>
      </div>
    </div>
  );

  const renderSensor = () => (
    <div className="space-y-4">
      {/* Sensor Sampling Rate */}
      <div className="p-3 rounded-2xl" style={{ background: 'var(--bg-subtle)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="w-4 h-4 text-emerald-500" />
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Kadar Persampelan Sensor</p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Frekuensi bacaan data dari nod LoRaWAN</p>
          </div>
        </div>
        <PillSelector
          options={SENSOR_SAMPLING_RATES}
          value={themeCtx.sensorSamplingRate}
          onChange={themeCtx.setSensorSamplingRate}
          columns={4}
        />
      </div>

      {/* Auto-Refresh Rate */}
      <div className="p-3 rounded-2xl" style={{ background: 'var(--bg-subtle)' }}>
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw className="w-4 h-4 text-blue-500" />
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Kadar Kemaskini Paparan</p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Kekerapan data dipaparkan semula di skrin</p>
          </div>
        </div>
        <PillSelector
          options={[
            { value: '30s' as AutoRefreshRate, label: '30s' },
            { value: '1m' as AutoRefreshRate, label: '1 min' },
            { value: '5m' as AutoRefreshRate, label: '5 min' },
            { value: 'off' as AutoRefreshRate, label: 'Off' },
          ]}
          value={themeCtx.autoRefresh}
          onChange={themeCtx.setAutoRefresh}
          columns={4}
        />
      </div>
    </div>
  );

  const renderAmaran = () => (
    <div className="space-y-4">
      {/* Emergency Siren */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
        <SettingRow icon={Siren} iconColor="#EF4444" title="Siren Amaran Kecemasan" desc="Berbunyi walaupun fon dalam mod senyap" noBorder>
          <ToggleSwitch checked={themeCtx.emergencySiren} onChange={themeCtx.setEmergencySiren} />
        </SettingRow>
      </div>

      {/* Per-Category Notifications */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
        <div className="px-3.5 pt-3 pb-1.5">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Kawalan Notifikasi</p>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Pilih kategori yang anda mahu terima</p>
        </div>
        <SettingRow icon={SlidersHorizontal} iconColor="#C5A367" title="Aduan Sivik" desc="Lubang jalan, longkang, lampu padam">
          <ToggleSwitch checked={themeCtx.notifAduan} onChange={themeCtx.setNotifAduan} />
        </SettingRow>
        <SettingRow icon={Bell} iconColor="#10B981" title="Bantuan & Misi" desc="Misi kecemasan sukarelawan">
          <ToggleSwitch checked={themeCtx.notifBantuan} onChange={themeCtx.setNotifBantuan} />
        </SettingRow>

        {/* Bantuan Radius (only if bantuan notif is on) */}
        <AnimatePresence>
          {themeCtx.notifBantuan && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3.5 pb-3 pt-1">
                <p className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Radius Pemberitahuan Bantuan</p>
                <PillSelector
                  options={[
                    { value: '5km' as NotifRadius, label: '5 km' },
                    { value: '10km' as NotifRadius, label: '10 km' },
                    { value: '25km' as NotifRadius, label: '25 km' },
                  ]}
                  value={themeCtx.notifBantuanRadius}
                  onChange={themeCtx.setNotifBantuanRadius}
                  columns={3}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <SettingRow icon={Bell} iconColor="#8B5CF6" title="Komuniti & Pasar" desc="Stok, forum, dan aktiviti" noBorder>
          <ToggleSwitch checked={themeCtx.notifKomuniti} onChange={themeCtx.setNotifKomuniti} />
        </SettingRow>
      </div>

      {/* Quiet Hours */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
        <SettingRow icon={MoonStar} iconColor="#6366F1" title="Waktu Senyap (DND)" desc="Senyapkan semua kecuali amaran bencana">
          <ToggleSwitch checked={themeCtx.quietHoursEnabled} onChange={themeCtx.setQuietHoursEnabled} />
        </SettingRow>
        <AnimatePresence>
          {themeCtx.quietHoursEnabled && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3.5 pb-3 pt-1 flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[10px] font-bold block mb-1" style={{ color: 'var(--text-muted)' }}>Mula</label>
                  <input type="time" value={themeCtx.quietHoursStart} onChange={e => themeCtx.setQuietHoursStart(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
                  />
                </div>
                <span className="text-xs font-bold mt-4" style={{ color: 'var(--text-muted)' }}>→</span>
                <div className="flex-1">
                  <label className="text-[10px] font-bold block mb-1" style={{ color: 'var(--text-muted)' }}>Tamat</label>
                  <input type="time" value={themeCtx.quietHoursEnd} onChange={e => themeCtx.setQuietHoursEnd(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
                  />
                </div>
              </div>
              <div className="px-3.5 pb-3">
                <p className="text-[9px] font-semibold px-2 py-1 rounded-lg flex items-center gap-1.5"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                  <Siren className="w-3 h-3 shrink-0" />
                  Amaran bencana kritikal tetap berbunyi walaupun dalam waktu senyap
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  const renderPrivasi = () => (
    <div className="space-y-4">
      {/* Location Precision */}
      <div className="p-3 rounded-2xl" style={{ background: 'var(--bg-subtle)' }}>
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-blue-500" />
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Ketepatan Lokasi GPS</p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Kawal tahap ketepatan lokasi anda</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'high' as LocationPrecision, label: 'Tepat (GPS)', desc: 'Untuk skuad baiki jalan', icon: MapPin },
            { value: 'fuzzy' as LocationPrecision, label: 'Kabur (500m)', desc: 'Privasi aduan peribadi', icon: MapPinOff },
          ]).map(opt => (
            <button key={opt.value} onClick={() => themeCtx.setLocationPrecision(opt.value)}
              className="p-3 rounded-xl text-left border transition-all"
              style={themeCtx.locationPrecision === opt.value
                ? { background: 'var(--accent-muted)', borderColor: 'var(--accent)' }
                : { background: 'var(--bg-card)', borderColor: 'transparent' }
              }>
              <opt.icon className="w-4 h-4 mb-1.5" style={{ color: themeCtx.locationPrecision === opt.value ? 'var(--accent)' : 'var(--text-muted)' }} />
              <p className="text-xs font-bold" style={{ color: themeCtx.locationPrecision === opt.value ? 'var(--accent)' : 'var(--text-primary)' }}>{opt.label}</p>
              <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Storage / Cache */}
      <div className="p-3 rounded-2xl" style={{ background: 'var(--bg-subtle)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Trash2 className="w-4 h-4 text-orange-500" />
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Storan & Cache</p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Ruang storan yang digunakan oleh NADI</p>
          </div>
        </div>
        {storageUsage && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
                {formatBytes(storageUsage.used)} / {formatBytes(storageUsage.quota)}
              </span>
              <span className="text-[10px] font-bold" style={{ color: 'var(--accent)' }}>
                {storageUsage.quota > 0 ? ((storageUsage.used / storageUsage.quota) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-card)' }}>
              <div className="h-full rounded-full transition-all" style={{
                width: `${storageUsage.quota > 0 ? Math.min(100, (storageUsage.used / storageUsage.quota) * 100) : 0}%`,
                background: 'var(--accent)'
              }} />
            </div>
          </div>
        )}
        <button onClick={handleClearCache} disabled={clearingCache}
          className="w-full py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2"
          style={{ background: 'var(--bg-card)', color: clearingCache ? 'var(--text-muted)' : 'var(--danger, #EF4444)', borderColor: 'var(--border-default)' }}>
          <Trash2 className="w-3.5 h-3.5" />
          {clearingCache ? 'Mengosongkan...' : 'Kosongkan Cache'}
        </button>
      </div>

      {/* Data Export */}
      <div className="p-3 rounded-2xl" style={{ background: 'var(--bg-subtle)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Download className="w-4 h-4 text-blue-500" />
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Eksport Data</p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Muat turun rekod anda</p>
          </div>
        </div>

        {/* Aduan Export */}
        <div className="mb-2.5">
          <p className="text-[10px] font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Rekod Aduan</p>
          <div className="flex gap-2">
            <button onClick={() => handleExportAduan('json')}
              className="flex-1 py-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}>
              <FileJson className="w-3.5 h-3.5 text-emerald-500" /> JSON
            </button>
            <button onClick={() => handleExportAduan('csv')}
              className="flex-1 py-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}>
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" /> CSV
            </button>
          </div>
        </div>

        {/* LoRaWAN Export */}
        <div>
          <p className="text-[10px] font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Rekod Paras Air LoRaWAN</p>
          <div className="flex gap-2">
            <button onClick={() => handleExportLoRaWAN('json')}
              className="flex-1 py-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}>
              <FileJson className="w-3.5 h-3.5 text-emerald-500" /> JSON
            </button>
            <button onClick={() => handleExportLoRaWAN('csv')}
              className="flex-1 py-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}>
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" /> CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAkses = () => (
    <div className="space-y-4">
      {/* Font Size */}
      <div className="p-3 rounded-2xl" style={{ background: 'var(--bg-subtle)' }}>
        <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--text-primary)' }}>{t('settings.scale')}</p>
        <PillSelector
          options={[
            { value: 'S' as FontSize, label: t('settings.scale_s') },
            { value: 'M' as FontSize, label: t('settings.scale_m') },
            { value: 'L' as FontSize, label: t('settings.scale_l') },
          ]}
          value={themeCtx.fontSize}
          onChange={themeCtx.setFontSize}
          columns={3}
        />
      </div>

      {/* Toggles */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
        <SettingRow icon={Baseline} iconColor="#8B5CF6" title={t('settings.dyslexia')} desc={t('settings.dyslexia_desc')}>
          <ToggleSwitch checked={themeCtx.dyslexiaFont} onChange={themeCtx.setDyslexiaFont} />
        </SettingRow>
        <SettingRow icon={Eye} iconColor="#F59E0B" title={t('settings.contrast')} desc={t('settings.contrast_desc')}>
          <ToggleSwitch checked={themeCtx.highContrast} onChange={themeCtx.setHighContrast} />
        </SettingRow>
        <SettingRow icon={Activity} iconColor="#10B981" title={t('settings.motion')} desc={t('settings.motion_desc')}>
          <ToggleSwitch checked={themeCtx.reduceMotion} onChange={themeCtx.setReduceMotion} />
        </SettingRow>
        <SettingRow icon={Smartphone} iconColor="#3B82F6" title="Sasaran Sentuhan Besar" desc="Besarkan butang untuk pengguna OKU" noBorder>
          <ToggleSwitch checked={themeCtx.largeTouchTargets} onChange={themeCtx.setLargeTouchTargets} />
        </SettingRow>
      </div>

      {/* Colorblind */}
      <div className="p-3 rounded-2xl" style={{ background: 'var(--bg-subtle)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-1.5 rounded-lg" style={{ background: '#EC489920', color: '#EC4899' }}>
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t('settings.colorblind')}</p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('settings.colorblind_desc')}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['none', 'protanopia', 'deuteranopia', 'tritanopia'] as ColorblindMode[]).map(mode => (
            <button key={mode} onClick={() => themeCtx.setColorblindMode(mode)}
              className="py-2.5 px-3 rounded-xl text-xs font-bold transition-all border text-left"
              style={themeCtx.colorblindMode === mode
                ? { background: 'var(--accent-muted)', color: 'var(--accent)', borderColor: 'var(--accent)' }
                : { background: 'var(--bg-card)', color: 'var(--text-secondary)', borderColor: 'transparent' }
              }>
              <span className="capitalize">{mode === 'none' ? t('settings.cb_none') : mode}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const tabRenderers: Record<SettingsTab, () => React.ReactNode> = {
    paparan: renderPaparan,
    sensor: renderSensor,
    amaran: renderAmaran,
    privasi: renderPrivasi,
    akses: renderAkses,
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
          >
            {/* ── Header ─────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--border-default)' }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('settings.title')}</h2>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('settings.subtitle')}</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── Body: 2-Column Layout ──────────────────────── */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* Left Sidebar — Tab List */}
              <div className="w-[180px] shrink-0 border-r py-3 px-2 flex flex-col gap-1 overflow-y-auto no-scrollbar hidden md:flex"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all w-full"
                      style={{
                        background: isActive ? 'var(--bg-card)' : 'transparent',
                        boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                      }}>
                      <div className="p-1 rounded-lg shrink-0"
                        style={{ background: isActive ? `${tab.color}20` : 'transparent', color: isActive ? tab.color : 'var(--text-muted)' }}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Mobile Tab Bar (horizontal) */}
              <div className="md:hidden w-full shrink-0 border-b overflow-x-auto no-scrollbar flex"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className="flex flex-col items-center gap-1 px-4 py-2.5 shrink-0 transition-all relative"
                      style={{ color: isActive ? tab.color : 'var(--text-muted)' }}>
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px] font-bold">{tab.label}</span>
                      {isActive && <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ background: tab.color }} />}
                    </button>
                  );
                })}
              </div>

              {/* Right Content Panel */}
              <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    {tabRenderers[activeTab]()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* ── Footer ─────────────────────────────────────── */}
            <div className="p-3.5 border-t flex flex-col gap-2 shrink-0" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-subtle)' }}>
              <div className="flex items-center justify-between px-1 py-0.5 text-[10px] font-semibold text-[#C5A367]">
                <Link href="/privacy" onClick={onClose} className="hover:underline flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Dasar Privasi
                </Link>
                <span className="text-zinc-600">•</span>
                <Link href="/terms" onClick={onClose} className="hover:underline flex items-center gap-1">
                  <Scale className="w-3 h-3" /> Terma Perkhidmatan
                </Link>
              </div>

              <div className="flex gap-2">
                <button onClick={() => { signOut(); onClose(); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-colors"
                  style={{ background: 'var(--danger-muted)', color: 'var(--danger)' }}>
                  <LogOut className="w-4 h-4" /> {t('menu.signout')}
                </button>
              </div>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
