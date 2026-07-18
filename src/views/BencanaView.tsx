'use client';
import { MapPin, Navigation, AlertTriangle, Radio, Info, Loader2, ShieldAlert, Cloud, Droplets, Wind, Thermometer, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '@/src/context/LanguageContext';
import { useGame } from '@/src/context/GameContext';
import { useXP } from '@/src/hooks/useXP';
import dynamic from 'next/dynamic';

const GPSMap = dynamic(() => import('@/src/components/GPSMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Loading Satellite Map...</p>
        </div>
    )
});

import { useWeather } from '@/src/hooks/useWeather';
import { createClient } from '@/src/lib/supabase/client';
import useSWR from 'swr';

export interface FloodZone {
    district: string;
    risk: 'critical' | 'high' | 'moderate' | 'low';
    river: string;
    historicLevel: string;
    population: number;
}

export interface EvacCenter {
    name: string;
    district: string;
    capacity: number;
    type: string;
}

export default function BencanaView() {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'map' | 'zones'>('map');
    const [showDashboard, setShowDashboard] = useState(false);

    const { completeQuest } = useGame();
    const { addXp } = useXP();
    const supabase = createClient();

    const { weather, isWeatherLoading, locationLabel, userLat, userLng } = useWeather();

    // LoRaWAN sensor status
    const [sensorStatus, setSensorStatus] = useState<'safe' | 'warning' | 'danger'>('safe');
    const sensorLabels = {
        safe: { text: t('bencana.sensor_safe'), style: 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20' },
        warning: { text: t('bencana.sensor_warning'), style: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
        danger: { text: t('bencana.sensor_danger'), style: 'bg-red-500/20 text-red-500 border border-red-500/30' },
    };
    const currentSensor = sensorLabels[sensorStatus];

    // Real-time Supabase Subscription for LoRaWAN
    useEffect(() => {
        // Fetch initial status
        supabase.from('nadi_bencana_sensors').select('*').eq('name', 'Sungai Kelantan Node A').single()
            .then(({ data }) => {
                if (data && data.status) setSensorStatus(data.status);
            });

        // Subscribe to real-time changes
        const channel = supabase.channel('sensor_changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'nadi_bencana_sensors' }, (payload) => {
                if (payload.new && payload.new.status) {
                    setSensorStatus(payload.new.status as any);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    // SWR Caching for Supabase Data
    const fetchBencanaData = async () => {
        const [{ data: zones }, { data: centers }] = await Promise.all([
            supabase.from('nadi_bencana_zones').select('*'),
            supabase.from('nadi_bencana_centers').select('*')
        ]);
        return {
            zones: zones ? zones.map((z: any) => ({
                district: z.district,
                risk: z.risk,
                river: z.river,
                historicLevel: z.historic_level,
                population: z.population
            })) : [],
            centers: centers ? centers.map((c: any) => ({
                name: c.name,
                district: c.district,
                capacity: c.capacity,
                type: c.type
            })) : []
        };
    };

    const { data: bencanaData } = useSWR('bencana_data', fetchBencanaData, { revalidateOnFocus: false });
    const floodZones: FloodZone[] = bencanaData?.zones || [];
    const evacCenters: EvacCenter[] = bencanaData?.centers || [];

    // Real-time geolocation tracking
    useEffect(() => {
        completeQuest('flood').then(xp => {
            if (xp > 0) addXp(xp);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="p-6 h-full flex flex-col relative z-0" style={{ color: 'var(--text-primary)' }}>



            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="mb-6"
            >
                <h2 className="text-2xl font-bold mb-1 tracking-tight" style={{ color: 'var(--text-primary)' }}>{t('bencana.title')}</h2>
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    {t('bencana.subtitle')} · {locationLabel === 'Locating...' ? 'Malaysia' : locationLabel === 'Location Access Denied' ? 'Kuala Lumpur (Fallback)' : locationLabel}
                </p>
            </motion.div>

            {/* Environmental Dashboard */}
            {isWeatherLoading ? (
                <div className="mb-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div className="h-28 skeleton"></div>
                        <div className="h-28 skeleton"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="h-20 skeleton"></div>
                        <div className="h-20 skeleton"></div>
                        <div className="h-20 skeleton"></div>
                    </div>
                </div>
            ) : weather && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}
                    className="mb-5"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        {/* Primary Weather Card */}
                        <div className="rounded-2xl p-4 flex flex-col justify-between" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Cloud className="w-5 h-5 text-blue-400" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Weather</span>
                                </div>
                                <span className="text-2xl font-light text-white">{weather.temp}°C</span>
                            </div>
                            <div>
                                <p className="text-xs text-zinc-400">Feels like {weather.feelsLike}°C</p>
                            </div>
                        </div>

                        {/* AQI Card */}
                        <div className="rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl -translate-y-8 translate-x-8 ${weather.aqi > 100 ? 'bg-orange-500/20' : weather.aqi > 50 ? 'bg-yellow-500/10' : 'bg-emerald-500/10'}`}></div>
                            <div className="flex items-start justify-between mb-2 relative z-10">
                                <div className="flex items-center gap-2">
                                    <Activity className={`w-5 h-5 ${weather.aqi > 100 ? 'text-orange-400' : weather.aqi > 50 ? 'text-yellow-400' : 'text-emerald-400'}`} />
                                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Air Quality</span>
                                </div>
                                <div className="text-right">
                                    <span className={`text-2xl font-light leading-none block ${weather.aqi > 100 ? 'text-orange-400' : weather.aqi > 50 ? 'text-yellow-400' : 'text-emerald-400'}`}>{weather.aqi} <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">AQI</span></span>
                                    <span className={`text-[9px] font-bold uppercase tracking-widest ${weather.aqi > 100 ? 'text-orange-500' : weather.aqi > 50 ? 'text-yellow-500' : 'text-emerald-500'}`}>{weather.aqi <= 50 ? 'Safe (<50)' : weather.aqi <= 100 ? 'Moderate (51-100)' : 'Unsafe (>100)'}</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1 text-[10px] text-zinc-400 relative z-10 mt-1">
                                <div className="flex justify-between items-center">
                                    <span>PM2.5: <strong className={weather.pm25 > 35.4 ? 'text-orange-400' : weather.pm25 > 12 ? 'text-yellow-400' : 'text-emerald-400'}>{weather.pm25}</strong> µg/m³</span>
                                    <span className="text-[8px] opacity-60">Avg Safe: &lt;12</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>PM10: <strong className={weather.pm10 > 154 ? 'text-orange-400' : weather.pm10 > 54 ? 'text-yellow-400' : 'text-emerald-400'}>{weather.pm10}</strong> µg/m³</span>
                                    <span className="text-[8px] opacity-60">Avg Safe: &lt;54</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-2xl p-3 flex flex-col items-center justify-center text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                            <Droplets className="w-4 h-4 text-blue-400 mb-1.5" />
                            <span className="text-sm font-bold text-white">{weather.rainMm}<span className="text-[10px] text-zinc-400 ml-0.5">mm</span></span>
                            <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500 mt-1">Rain</span>
                        </div>
                        <div className="rounded-2xl p-3 flex flex-col items-center justify-center text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                            <Wind className="w-4 h-4 text-teal-400 mb-1.5" />
                            <span className="text-sm font-bold text-white">{weather.windSpeed}<span className="text-[10px] text-zinc-400 ml-0.5">km/h</span></span>
                            <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500 mt-1">Wind</span>
                        </div>
                        <div className="rounded-2xl p-3 flex flex-col items-center justify-center text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                            <div className="w-4 h-4 rounded-full flex items-center justify-center mb-1.5" style={{ background: weather.floodRisk === 'High' ? 'rgba(239,68,68,0.2)' : weather.floodRisk === 'Moderate' ? 'rgba(249,115,22,0.2)' : 'rgba(16,185,129,0.2)' }}>
                                <AlertTriangle className={`w-2.5 h-2.5 ${weather.floodRisk === 'High' ? 'text-red-500' : weather.floodRisk === 'Moderate' ? 'text-orange-500' : 'text-emerald-500'}`} />
                            </div>
                            <span className={`text-sm font-bold ${weather.floodRisk === 'High' ? 'text-red-500' : weather.floodRisk === 'Moderate' ? 'text-orange-500' : 'text-emerald-500'}`}>{weather.floodRisk}</span>
                            <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500 mt-1">Flood Risk</span>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* LoRaWAN Sensor Status */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                className="mb-5 p-4 rounded-2xl shadow-sm relative overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <span className="font-bold text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{t('bencana.lorawan')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-3 py-1.5 rounded-full tracking-widest uppercase shadow-sm transition-colors ${currentSensor.style}`}>
                            {sensorStatus === 'danger' ? 'Water Level: 4.8m (CRITICAL)' : currentSensor.text}
                        </span>
                        
                        <button 
                            onClick={async () => {
                                const newStatus = sensorStatus === 'safe' ? 'danger' : 'safe';
                                setSensorStatus(newStatus); // Optimistic UI update
                                await fetch('/api/bencana/sensors', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ name: 'Sungai Kelantan Node A', status: newStatus }),
                                                });
                            }} 
                            className={`text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg transition-colors border ${sensorStatus === 'danger' ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'text-gray-500 border-gray-600 hover:text-white'}`}
                        >
                            {sensorStatus === 'danger' ? 'Stop Simulation' : 'Simulate Hardware'}
                        </button>

                        <button onClick={() => setShowDashboard(!showDashboard)} className="text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg transition-colors" style={{ color: 'var(--accent)', border: '1px solid var(--border-default)' }}>
                            {showDashboard ? 'Hide' : 'Dashboard'}
                        </button>
                    </div>
                </div>

                <AnimatePresence>
                    {showDashboard && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid var(--border-default)' }}>
                                <div className="text-center py-6 border border-dashed rounded-2xl" style={{ borderColor: 'var(--border-default)' }}>
                                    <Radio className={`w-6 h-6 mx-auto mb-2 ${sensorStatus === 'danger' ? 'text-red-500 animate-bounce' : ''}`} style={sensorStatus !== 'danger' ? { color: 'var(--text-muted)' } : {}} />
                                    <p className={`text-[10px] font-bold uppercase tracking-widest ${sensorStatus === 'danger' ? 'text-red-500' : ''}`} style={sensorStatus !== 'danger' ? { color: 'var(--text-muted)' } : {}}>
                                        {sensorStatus === 'danger' ? 'CRITICAL WATER LEVEL DETECTED' : 'Awaiting Sensor Connection'}
                                    </p>
                                    <p className={`text-[9px] mt-1 max-w-[200px] mx-auto ${sensorStatus === 'danger' ? 'text-red-400' : ''}`} style={sensorStatus !== 'danger' ? { color: 'var(--text-muted)' } : {}}>
                                        {sensorStatus === 'danger' ? 'River Sg. Kelantan has breached the 4.5m danger threshold. Evacuation protocols initiated.' : 'Water level, battery, and uptime data will appear once LoRaWAN sensors are paired along Sungai Kelantan'}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>



            {/* Evacuation Status */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="flex items-center gap-3 p-4 rounded-2xl mb-5"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' }}
            >
                <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t('bencana.evacuation')}</span>
                <span className="ml-auto text-[10px] font-medium px-2.5 py-1 rounded-lg" style={{ background: 'var(--success-muted)', color: 'var(--success)' }}>{t('bencana.standby')}</span>
            </motion.div>

            {/* Tab Toggle: Map / Flood Zones */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                className="flex p-1 rounded-2xl mb-5"
                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
            >
                {(['map', 'zones'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className="flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all"
                        style={activeTab === tab
                            ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }
                            : { color: 'var(--text-muted)' }
                        }
                    >{tab === 'map' ? '📍 Map' : '🌊 Flood Zones'}</button>
                ))}
            </motion.div>

            <div className="flex-1 min-h-0 overflow-y-auto pb-6 relative">
                <AnimatePresence mode="wait">

                    {/* === MAP TAB === */}
                    {activeTab === 'map' && (
                        <motion.div
                            key="map"
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            <div className="w-full h-72 rounded-3xl relative overflow-hidden border-2 shadow-2xl flex items-center justify-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', boxShadow: 'var(--shadow-lg)' }}>
                                {userLat === null || userLng === null ? (
                                    <div className="flex flex-col items-center gap-3">
                                        {locationLabel !== 'Location Access Denied' && <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />}
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: 'var(--text-muted)' }}>
                                            {locationLabel === 'Location Access Denied' ? 'Please enable GPS/Location Services in your browser' : 'Acquiring GPS Signal...'}
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <GPSMap lat={userLat} lng={userLng} />
                                        
                                        {/* Red Alert Map Overlay */}
                                        <AnimatePresence>
                                            {sensorStatus === 'danger' && (
                                                <motion.div 
                                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                    className="absolute inset-0 z-10 pointer-events-none bg-red-500/20 border-4 border-red-500 animate-pulse"
                                                >
                                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest shadow-2xl flex items-center gap-3">
                                                        <ShieldAlert className="w-6 h-6" />
                                                        EVACUATE IMMEDIATELY
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <div className="absolute top-3 left-3 z-20 pointer-events-none">
                                            <div className="flex items-center gap-2 backdrop-blur-md px-3 py-2 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                                                <div className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse" />
                                                <span className="text-[10px] font-semibold" style={{ color: 'var(--success)' }}>Live GPS</span>
                                            </div>
                                        </div>
                                        <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
                                            <div className="backdrop-blur-md bg-black/60 px-4 py-3 rounded-2xl shadow-lg" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
                                                <div className="flex items-center gap-3">
                                                    <Navigation className="w-4 h-4 shrink-0 text-blue-400" />
                                                    <div>
                                                        <p className="text-[11px] font-bold text-white">GPS active · {locationLabel}</p>
                                                        <p className="text-[9px] font-medium text-gray-300 mt-0.5 tracking-wider">📍 {userLat.toFixed(4)}°N, {userLng.toFixed(4)}°E</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Nearest Evacuation Centers */}
                            <div>
                                <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                                    <AlertTriangle className="w-3.5 h-3.5" /> Nearest Evacuation Centers
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {evacCenters.slice(0, 5).map((center, i) => (
                                        <motion.div
                                            key={center.name}
                                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}
                                            className="flex items-center justify-between p-3.5 rounded-xl"
                                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: 'var(--accent-muted)' }}>
                                                    {center.type === 'Sekolah' ? '🏫' : center.type === 'Masjid' ? '🕌' : '🏛️'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{center.name}</p>
                                                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{center.district} · {center.type}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 ml-2">
                                                <p className="text-xs font-bold" style={{ color: 'var(--success)' }}>{center.capacity}</p>
                                                <p className="text-[8px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>capacity</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* === FLOOD ZONES TAB === */}
                    {activeTab === 'zones' && (
                        <motion.div
                            key="zones"
                            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}
                            className="space-y-3"
                        >
                            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl" style={{ background: 'var(--accent-muted)', border: '1px solid var(--border-default)' }}>
                                <Info className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
                                <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                                    Kelantan flood risk by district. Data based on historical flood records (2014-2024).
                                </p>
                            </div>

                            {floodZones.length === 0 && (
                                <div className="text-center py-12 rounded-3xl text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', border: '1px dashed var(--border-default)' }}>
                                    No zones documented
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {floodZones.map((zone, i) => {
                                    const riskColor = (r: string) => {
                                        switch (r) {
                                            case 'critical': return { bg: 'rgba(239,68,68,0.1)', text: '#EF4444', border: 'rgba(239,68,68,0.2)' };
                                            case 'high': return { bg: 'rgba(249,115,22,0.1)', text: '#F97316', border: 'rgba(249,115,22,0.2)' };
                                            case 'moderate': return { bg: 'rgba(245,158,11,0.1)', text: '#F59E0B', border: 'rgba(245,158,11,0.2)' };
                                            default: return { bg: 'rgba(16,185,129,0.1)', text: '#10B981', border: 'rgba(16,185,129,0.2)' };
                                        }
                                    };
                                    const rc = riskColor(zone.risk);
                                    return (
                                        <motion.div
                                            key={zone.district}
                                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}
                                            className="p-4 rounded-2xl"
                                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{zone.district}</h4>
                                                    <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{zone.river}</p>
                                                </div>
                                                <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border"
                                                    style={{ background: rc.bg, color: rc.text, borderColor: rc.border }}
                                                >
                                                    {zone.risk}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                <span>👥 Pop: {zone.population.toLocaleString()}</span>
                                                <span>📊 {zone.historicLevel}</span>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}



                </AnimatePresence>
            </div>
        </div>
    );
}
