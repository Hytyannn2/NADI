/**
 * Main Civic Dashboard View
 *
 * Provides high-level overview of live weather conditions, flood risk index,
 * quick module shortcuts, and community status.
 */
'use client';

import { useAuth } from '@/src/context/AuthContext';
import pkg from '@/package.json';
import { useLanguage } from '@/src/context/LanguageContext';
import { useWeather } from '@/src/hooks/useWeather';
import { useLiveSensor } from '@/src/hooks/useLiveSensor';
import { sound } from '@/src/lib/audio/soundEffects';
import {
    CloudRain, AlertTriangle, Heart,
    ChevronRight, Thermometer,
    Wind, Droplets, ClipboardList, ShoppingBag,
    Sun, Moon, CloudSun, CloudMoon, CloudLightning,
    CloudDrizzle, Cloud, MapPin
} from 'lucide-react';
import { WeatherSkeleton } from '@/src/components/ui/Skeleton';

export default function DashboardView() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { weather, isWeatherLoading, locationLabel } = useWeather();

    // BME280 temp/humidity from the default sensor node (8s poll, paused while tab hidden)
    const sensorData = useLiveSensor({ intervalMs: 8000 });

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
        const iconClass = 'h-8 w-8 shrink-0 text-ink-2';
        if (!weather) return <Thermometer className={iconClass} />;

        const code = weather.weatherCode ?? 0;
        const rain = weather.rainMm ?? 0;
        const temp = weather.temp ?? 30;
        const isNight = hour < 6 || hour >= 19;

        // 1. Thunderstorm (Ribut Petir) - WMO 95, 96, 99
        if (code === 95 || code === 96 || code === 99) {
            return <CloudLightning className={iconClass} />;
        }

        // 2. Heavy / Moderate Rain (Hujan) - WMO 61, 63, 65, 80, 81, 82 or rain >= 2.5mm
        if (rain >= 2.5 || [61, 63, 65, 80, 81, 82].includes(code)) {
            return <CloudRain className={iconClass} />;
        }

        // 3. Light Drizzle (Hujan Renyai / Gerimis) - WMO 51, 53, 55, 56, 57 or rain >= 0.5mm
        if (rain >= 0.5 || [51, 53, 55, 56, 57].includes(code)) {
            return <CloudDrizzle className={iconClass} />;
        }

        // 4. Overcast / Heavy Clouds (Mendung) - WMO 2, 3
        if (code === 2 || code === 3) {
            return <Cloud className={iconClass} />;
        }

        // 5. Partly Cloudy (Cerah Berawan) - WMO 1
        if (code === 1) {
            return isNight
                ? <CloudMoon className={iconClass} />
                : <CloudSun className={iconClass} />;
        }

        // 6. Clear Night (Malam Tenang)
        if (isNight) {
            return <Moon className={iconClass} />;
        }

        // 7. Hot Sunny / Terik (Panas / Clear Sky)
        if (temp >= 32 || code === 0) {
            return <Sun className={iconClass} />;
        }

        return <Thermometer className={iconClass} />;
    };

    const switchToTab = (tabId: string) => {
        sound.playWaterDrop();
        const btn = document.getElementById(`tour-${tabId}`);
        if (btn) btn.click();
    };

    return (
        <div className="flex min-h-full w-full max-w-6xl flex-col p-4 pb-28 sm:p-6 sm:pb-24">
            {/* Flood alert */}
            {Boolean(weather?.floodRisk === 'High' || (weather?.rainMm && weather.rainMm >= 10.0)) && (
                <div
                    role="alert"
                    className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-card bg-danger-soft p-4 text-danger-soft-ink"
                >
                    <div>
                        <p className="flex items-center gap-2 font-bold">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            Amaran Hujan Lebat
                        </p>
                        <p className="mt-1">Hujan lebat dikesan. Berisiko berlaku banjir kilat.</p>
                    </div>
                    <button type="button" onClick={() => switchToTab('bencana')} className="btn btn--sm">
                        Lihat peta bencana
                    </button>
                </div>
            )}

            {/* 1. Civic Welcome Header */}
            <header className="mb-10">
                <h2 className="text-2xl text-ink">
                    {greetingText}, {userName}
                </h2>
                <p className="mt-2 text-md text-ink-2">
                    Platform Komuniti, Respons Krisis & Bencana Bersepadu
                </p>
            </header>

            <div className="mb-10 grid gap-10 xl:grid-cols-2">
                {/* 2. Weather & Live Sensors Section */}
                <section>
                    <h3 className="mb-4 text-lg text-ink">Keadaan semasa</h3>

                    {isWeatherLoading ? (
                        <WeatherSkeleton />
                    ) : (
                        <div className="well p-4 sm:p-6">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-3">
                                        {renderWeatherIcon()}
                                        <p className="figure">{effectiveTemp}°C</p>
                                    </div>
                                    <p className="mt-2 text-md text-ink-2">
                                        {weather ? `Rasa seperti ${Math.round(weather.feelsLike)}°C` : ''}
                                    </p>
                                    <p className="text-sm text-muted">
                                        {isBmeOnline ? 'Sensor IoT Langsung' : 'Model Satelit Open-Meteo'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {isBmeOnline ? (
                                        <span className="tag tag--in">BME280 On-Site</span>
                                    ) : (
                                        <span className="tag tag--out">API Satelit (Fallback)</span>
                                    )}
                                    {weather?.condition && (
                                        <span className="tag">{weather.condition}</span>
                                    )}
                                </div>
                            </div>

                            <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                                <MapPin className="h-4 w-4 shrink-0" />
                                {locationLabel}
                            </p>

                            {weather && (
                                <div className="mt-6 grid grid-cols-3 gap-x-3 gap-y-1">
                                    <div className="row-span-3 grid grid-rows-subgrid">
                                        <Droplets className="mb-1 h-5 w-5 text-ink-2" />
                                        <p className="text-xl font-bold tabular-nums text-ink">
                                            {effectiveHumidity}% <span className="text-sm font-normal text-muted">{isBmeOnline ? 'BME' : 'Lembap'}</span>
                                        </p>
                                        <p className="text-sm text-muted">Kelembapan Udara</p>
                                    </div>
                                    <div className="row-span-3 grid grid-rows-subgrid border-l border-rule pl-3">
                                        <Wind className="mb-1 h-5 w-5 text-ink-2" />
                                        <p className="text-xl font-bold tabular-nums text-ink">
                                            {weather.windSpeed} <span className="text-sm font-normal text-muted">km/h</span>
                                        </p>
                                        <p className="text-sm text-muted">Kelajuan Angin</p>
                                    </div>
                                    {weather.rainMm > 0 && (
                                        <div className="row-span-3 grid grid-rows-subgrid border-l border-rule pl-3">
                                            <CloudRain className="mb-1 h-5 w-5 text-ink-2" />
                                            <p className="text-xl font-bold tabular-nums text-ink">
                                                {weather.rainMm} <span className="text-sm font-normal text-muted">mm</span>
                                            </p>
                                            <p className="text-sm text-muted">Kadar Hujan</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </section>

                {/* ═══════ 3. CIVIC SERVICES & QUICK PORTAL ═══════ */}
                <section>
                    <h3 className="mb-4 text-lg text-ink">Pusat khidmat warga</h3>

                    <ul className="ruled">
                        {/* Aduan Sivik Card */}
                        <li>
                            <button
                                type="button"
                                onClick={() => switchToTab('aduan')}
                                className="group flex w-full cursor-pointer items-center gap-4 py-4 text-left"
                            >
                                <ClipboardList className="h-5 w-5 shrink-0 text-ink-2" />
                                <span className="min-w-0 flex-1">
                                    <span className="block font-semibold text-ink">Aduan Sivik Pintar</span>
                                    <span className="block text-sm text-ink-2">
                                        Lapor jalan rosak, longkang tersumbat, dan fasiliti awam dengan sokongan AI Vision & Suara Dialek.
                                    </span>
                                </span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-ink" />
                            </button>
                        </li>

                        {/* Bantuan & Sukarelawan Card */}
                        <li>
                            <button
                                type="button"
                                onClick={() => switchToTab('bantuan')}
                                className="group flex w-full cursor-pointer items-center gap-4 py-4 text-left"
                            >
                                <Heart className="h-5 w-5 shrink-0 text-ink-2" />
                                <span className="min-w-0 flex-1">
                                    <span className="block font-semibold text-ink">Bantuan & Sukarelawan</span>
                                    <span className="block text-sm text-ink-2">
                                        Mohon bantuan kecemasan, salurkan sumbangan asas, atau sertai misi sukarelawan krisis.
                                    </span>
                                </span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-ink" />
                            </button>
                        </li>

                        {/* Komuniti & Pekerjaan Card */}
                        <li>
                            <button
                                type="button"
                                onClick={() => switchToTab('komuniti')}
                                className="group flex w-full cursor-pointer items-center gap-4 py-4 text-left"
                            >
                                <ShoppingBag className="h-5 w-5 shrink-0 text-ink-2" />
                                <span className="min-w-0 flex-1">
                                    <span className="block font-semibold text-ink">Papan Komuniti & Kerja</span>
                                    <span className="block text-sm text-ink-2">
                                        Cari peluang kerja bergaji adil dan sokong peniaga tempatan di sekitar kawasan anda.
                                    </span>
                                </span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-ink" />
                            </button>
                        </li>

                        {/* Bencana & PPS Card */}
                        <li>
                            <button
                                type="button"
                                onClick={() => switchToTab('bencana')}
                                className="group flex w-full cursor-pointer items-center gap-4 py-4 text-left"
                            >
                                <AlertTriangle className="h-5 w-5 shrink-0 text-ink-2" />
                                <span className="min-w-0 flex-1">
                                    <span className="block font-semibold text-ink">Respons Bencana & PPS</span>
                                    <span className="block text-sm text-ink-2">
                                        Pantau paras sungai secara langsung, lokasi PPS dibuka, dan laluan selamat banjir.
                                    </span>
                                </span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-ink" />
                            </button>
                        </li>
                    </ul>
                </section>
            </div>

            {/* ═══════ 4. SYSTEM FOOTER ═══════ */}
            <footer className="mt-auto border-t border-rule pt-6">
                <p className="font-bold text-ink">NADI</p>
                <p className="text-sm text-ink-2">Platform Komuniti & Respons Bencana</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span>v{pkg.version}</span>
                    <span>Hak Cipta Terpelihara © {new Date().getFullYear()} NADI</span>
                    <span>Pusat Khidmat Warga</span>
                </div>
            </footer>
        </div>
    );
}
