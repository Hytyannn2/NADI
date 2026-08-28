/**
 * Main Civic Dashboard View
 * 
 * Provides high-level overview of live weather conditions, flood risk index,
 * quick module shortcuts, and community status.
 */
'use client';

import { motion } from 'motion/react';
import { useAuth } from '@/src/context/AuthContext';
import pkg from '@/package.json';
import { useLanguage } from '@/src/context/LanguageContext';
import { useWeather } from '@/src/hooks/useWeather';
import { sound } from '@/src/lib/audio/soundEffects';
import { WeatherAtmosphere } from '@/src/components/ambient/WeatherAtmosphere';
import {
    CloudRain, AlertTriangle, Heart, Activity,
    ChevronRight, Loader2, Thermometer,
    Wind, Droplets, ClipboardList, ShoppingBag
} from 'lucide-react';

export default function DashboardView() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { weather, isWeatherLoading, locationLabel } = useWeather();

    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Warga';

    // Computes localized greeting based on time of day
    const hour = new Date().getHours();
    const greetingText = hour < 12 
        ? (t('greeting.morning') || 'Selamat Pagi') 
        : hour < 14 
            ? (t('greeting.noon') || 'Selamat Tengah Hari') 
            : hour < 19 
                ? (t('greeting.evening') || 'Selamat Petang') 
                : (t('greeting.night') || 'Selamat Malam');

    const switchToTab = (tabId: string) => {
        sound.playWaterDrop();
        const btn = document.getElementById(`tour-${tabId}`);
        if (btn) btn.click();
    };

    return (
        <div className="p-5 min-h-full w-full flex flex-col relative z-0">
            {/* Ambient weather backdrop */}
            <WeatherAtmosphere />

            {/* 1. Civic Welcome Header */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative rounded-2xl p-5 mb-5 overflow-hidden"
                style={{
                    background: '#0D0D10',
                    border: '1px solid var(--border-default)',
                }}
            >
                <div className="relative z-10 flex items-start justify-between">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                            {greetingText}
                        </p>
                        <h2 className="text-xl font-bold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
                            Selamat Datang, {userName}
                        </h2>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Platform Komuniti, Respons Krisis & Bencana Bersepadu
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* 2. Weather & Live Sensors Section */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mb-5 space-y-3"
            >
                <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Keadaan Semasa</h3>

                <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{locationLabel}</span>
                        {isWeatherLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
                        ) : weather ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>Terkini</span>
                        ) : null}
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-subtle)' }}>
                                {weather?.rainMm && weather.rainMm > 0 ? (
                                    <CloudRain className="w-6 h-6" style={{ color: 'var(--info)' }} />
                                ) : (
                                    <Thermometer className="w-6 h-6" style={{ color: 'var(--warning)' }} />
                                )}
                            </div>
                            <div>
                                <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                    {weather ? Math.round(weather.temp) : '--'}°C
                                </div>
                                <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                    {weather ? `Rasa seperti ${Math.round(weather.feelsLike)}°C` : 'Memuatkan...'}
                                </div>
                            </div>
                        </div>

                        {weather && (
                            <div className="flex flex-col gap-2 border-l pl-4" style={{ borderColor: 'var(--border-default)' }}>
                                <div className="flex items-center gap-2">
                                    <Droplets className="w-3 h-3" style={{ color: 'var(--info)' }} />
                                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{weather.humidity}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Wind className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{Math.round(weather.windSpeed * 3.6)} km/h</span>
                                </div>
                                {weather.rainMm > 0 && (
                                    <div className="flex items-center gap-2">
                                        <CloudRain className="w-3 h-3" style={{ color: 'var(--info)' }} />
                                        <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{weather.rainMm}mm</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Flood alert */}
                {Boolean(weather?.floodRisk === 'High' || (weather?.rainMm && weather.rainMm >= 10.0)) && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-2xl p-4 flex items-start gap-3 border"
                        style={{ background: 'var(--danger-muted)', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                    >
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold mb-1">Amaran Hujan Lebat</h4>
                            <p className="text-xs opacity-90 mb-2">Hujan lebat dikesan. Berisiko berlaku banjir kilat.</p>
                            <button onClick={() => switchToTab('bencana')} className="text-xs font-bold underline">Lihat Peta Bencana →</button>
                        </div>
                    </motion.div>
                )}
            </motion.div>

            {/* ═══════ 3. CIVIC SERVICES & QUICK PORTAL ═══════ */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mb-6 space-y-3"
            >
                <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Pusat Khidmat Warga
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Aduan Sivik Card */}
                    <button
                        onClick={() => switchToTab('aduan')}
                        className="p-4 rounded-2xl border text-left flex items-start gap-3 warm-card-hover group cursor-pointer"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
                    >
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 group-hover:bg-blue-500/20 transition-colors">
                            <ClipboardList className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-white flex items-center justify-between">
                                <span>Aduan Sivik Pintar</span>
                                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                            </h4>
                            <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                                Lapor jalan rosak, longkang tersumbat, dan fasiliti awam dengan sokongan AI Vision & Suara Dialek.
                            </p>
                        </div>
                    </button>

                    {/* Bantuan & Sukarelawan Card */}
                    <button
                        onClick={() => switchToTab('bantuan')}
                        className="p-4 rounded-2xl border text-left flex items-start gap-3 warm-card-hover group cursor-pointer"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
                    >
                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0 group-hover:bg-rose-500/20 transition-colors">
                            <Heart className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-white flex items-center justify-between">
                                <span>Bantuan & Sukarelawan</span>
                                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                            </h4>
                            <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                                Mohon bantuan kecemasan, salurkan sumbangan asas, atau sertai misi sukarelawan krisis.
                            </p>
                        </div>
                    </button>

                    {/* Komuniti & Pekerjaan Card */}
                    <button
                        onClick={() => switchToTab('komuniti')}
                        className="p-4 rounded-2xl border text-left flex items-start gap-3 warm-card-hover group cursor-pointer"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
                    >
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                            <ShoppingBag className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-white flex items-center justify-between">
                                <span>Papan Komuniti & Kerja</span>
                                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                            </h4>
                            <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                                Cari peluang kerja bergaji adil dan sokong peniaga tempatan di sekitar kawasan anda.
                            </p>
                        </div>
                    </button>

                    {/* Bencana & PPS Card */}
                    <button
                        onClick={() => switchToTab('bencana')}
                        className="p-4 rounded-2xl border text-left flex items-start gap-3 warm-card-hover group cursor-pointer"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
                    >
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 group-hover:bg-amber-500/20 transition-colors">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-white flex items-center justify-between">
                                <span>Respons Bencana & PPS</span>
                                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                            </h4>
                            <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                                Pantau paras sungai secara langsung, lokasi PPS dibuka, dan laluan selamat banjir.
                            </p>
                        </div>
                    </button>
                </div>
            </motion.div>

            {/* ═══════ 4. SYSTEM FOOTER ═══════ */}
            <footer className="mt-auto pt-6 pb-2 border-t text-center" style={{ borderColor: 'var(--border-default)' }}>
                <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-primary)' }}>
                    NADI
                </p>
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Platform Komuniti & Respons Bencana
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] mt-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                    <span>v{pkg.version}</span>
                    <span>•</span>
                    <span>Hak Cipta Terpelihara © {new Date().getFullYear()} NADI</span>
                    <span>•</span>
                    <span>Pusat Khidmat Warga</span>
                </div>
            </footer>

        </div>
    );
}
