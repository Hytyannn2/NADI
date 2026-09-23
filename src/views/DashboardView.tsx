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
import {
    CloudRain, AlertTriangle, Heart, Activity,
    ChevronRight, Loader2, Thermometer,
    Wind, Droplets, ClipboardList, ShoppingBag,
    Sun, Moon, CloudSun, CloudMoon, CloudLightning,
    CloudDrizzle, Cloud, MapPin, Zap
} from 'lucide-react';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { WeatherSkeleton } from '@/src/components/ui/Skeleton';

export default function DashboardView() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { weather, isWeatherLoading, locationLabel } = useWeather();

    const [sensorData, setSensorData] = useState<{
        is_online: boolean;
        temperature_c: number | null;
        humidity_pct: number | null;
    }>({
        is_online: false,
        temperature_c: null,
        humidity_pct: null,
    });

    useEffect(() => {
        const fetchSensor = () => {
            fetch(`/api/bencana/sensors?_t=${Date.now()}`, { cache: 'no-store' })
                .then(r => r.json())
                .then(d => {
                    if (d.success && d.sensors && d.sensors.length > 0) {
                        const s = d.sensors[0];
                        const lastReadingTs = s.last_reading ? new Date(s.last_reading).getTime() : 0;
                        const isStale = !lastReadingTs || (Date.now() - lastReadingTs) > 30000;
                        const online = s.is_online !== false && !isStale && s.status !== 'sensor_fault' && s.status !== 'offline';
                        setSensorData({
                            is_online: online,
                            temperature_c: s.temperature_c ?? null,
                            humidity_pct: s.humidity_pct ?? null,
                        });
                    }
                })
                .catch(() => {});
        };

        fetchSensor();
        const interval = setInterval(fetchSensor, 8000);
        return () => clearInterval(interval);
    }, []);

    const isBmeOnline = Boolean(sensorData.is_online && (sensorData.temperature_c !== null || sensorData.humidity_pct !== null));
    const effectiveTemp = (sensorData.is_online && sensorData.temperature_c !== null)
        ? Math.round(sensorData.temperature_c * 10) / 10
        : (weather ? Math.round(weather.temp) : '--');
    const effectiveHumidity = (sensorData.is_online && sensorData.humidity_pct !== null)
        ? Math.round(sensorData.humidity_pct * 10) / 10
        : (weather ? weather.humidity : '--');

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

    // Resolves live contextual weather icon based on WMO code, rainfall, and temperature
    const renderWeatherIcon = () => {
        if (!weather) return <Thermometer className="w-6 h-6" style={{ color: 'var(--warning)' }} />;

        const code = weather.weatherCode ?? 0;
        const rain = weather.rainMm ?? 0;
        const temp = weather.temp ?? 30;
        const isNight = hour < 6 || hour >= 19;

        // 1. Thunderstorm (Ribut Petir) - WMO 95, 96, 99
        if (code === 95 || code === 96 || code === 99) {
            return <CloudLightning className="w-6 h-6 text-amber-400 animate-pulse" />;
        }

        // 2. Heavy / Moderate Rain (Hujan) - WMO 61, 63, 65, 80, 81, 82 or rain >= 2.5mm
        if (rain >= 2.5 || [61, 63, 65, 80, 81, 82].includes(code)) {
            return <CloudRain className="w-6 h-6 text-blue-400" />;
        }

        // 3. Light Drizzle (Hujan Renyai / Gerimis) - WMO 51, 53, 55, 56, 57 or rain >= 0.5mm
        if (rain >= 0.5 || [51, 53, 55, 56, 57].includes(code)) {
            return <CloudDrizzle className="w-6 h-6 text-sky-400" />;
        }

        // 4. Overcast / Heavy Clouds (Mendung) - WMO 2, 3
        if (code === 2 || code === 3) {
            return <Cloud className="w-6 h-6 text-slate-300" />;
        }

        // 5. Partly Cloudy (Cerah Berawan) - WMO 1
        if (code === 1) {
            return isNight 
                ? <CloudMoon className="w-6 h-6 text-indigo-300" />
                : <CloudSun className="w-6 h-6 text-amber-300" />;
        }

        // 6. Clear Night (Malam Tenang)
        if (isNight) {
            return <Moon className="w-6 h-6 text-indigo-300" />;
        }

        // 7. Hot Sunny / Terik (Panas / Clear Sky)
        if (temp >= 32 || code === 0) {
            return <Sun className="w-6 h-6 text-amber-400 animate-[spin_16s_linear_infinite]" />;
        }

        return <Thermometer className="w-6 h-6" style={{ color: 'var(--warning)' }} />;
    };

    const switchToTab = (tabId: string) => {
        sound.playWaterDrop();
        const btn = document.getElementById(`tour-${tabId}`);
        if (btn) btn.click();
    };

    return (
        <div className="p-3.5 sm:p-5 min-h-full w-full flex flex-col relative z-0 pb-28 sm:pb-24">
            {/* 1. Civic Welcome Header */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative rounded-2xl p-4 sm:p-5 mb-4 sm:mb-5 shrink-0 shadow-sm"
                style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                    minHeight: 'fit-content',
                    flexShrink: 0,
                }}
            >
                <div className="relative z-10 flex items-start justify-between">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
                            {greetingText}
                        </p>
                        <h2 className="text-lg sm:text-xl font-bold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
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

                {isWeatherLoading ? (
                    <WeatherSkeleton />
                ) : (
                    <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5 text-left">
                                <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300 truncate max-w-[180px]">
                                    {locationLabel}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {isBmeOnline ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        BME280 On-Site
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                        API Satelit (Fallback)
                                    </span>
                                )}
                                {weather?.condition && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300 border border-zinc-700">
                                        {weather.condition}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-subtle)' }}>
                                    {renderWeatherIcon()}
                                </div>
                                <div>
                                    <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                        {effectiveTemp}°C
                                    </div>
                                    <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                        {weather ? `Rasa seperti ${Math.round(weather.feelsLike)}°C` : ''}
                                        <span className="text-[9px] opacity-75 ml-1.5 font-normal">
                                            · {isBmeOnline ? 'Sensor IoT Langsung' : 'Model Satelit Open-Meteo'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {weather && (
                                <div className="flex flex-col gap-2 border-l pl-4 shrink-0" style={{ borderColor: 'var(--border-default)' }}>
                                    <div className="flex items-center gap-2" title="Kelembapan Udara">
                                        <Droplets className="w-3.5 h-3.5" style={{ color: 'var(--info)' }} />
                                        <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                            {effectiveHumidity}% <span className="text-[9px] font-normal opacity-70">{isBmeOnline ? 'BME' : 'Lembap'}</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2" title="Kelajuan Angin">
                                        <Wind className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                                        <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{weather.windSpeed} km/h</span>
                                    </div>
                                    {weather.rainMm > 0 && (
                                        <div className="flex items-center gap-2" title="Kadar Hujan">
                                            <CloudRain className="w-3.5 h-3.5" style={{ color: 'var(--info)' }} />
                                            <span className="text-[10px] font-semibold text-blue-400">{weather.rainMm} mm</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

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
