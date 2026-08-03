'use client';
import { MapPin, Navigation, AlertTriangle, Radio, Info, Loader2, ShieldAlert, Cloud, Droplets, Wind, Thermometer, Activity, Battery, Signal, Clock, Gauge, BarChart3, Search, X, SlidersHorizontal, Filter, ArrowUpDown, ChevronDown } from 'lucide-react';
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

const SensorTrendChart = dynamic(() => import('@/src/components/SensorTrendChart'), {
    ssr: false,
    loading: () => (
        <div className="h-44 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
    )
});

import { useWeather } from '@/src/hooks/useWeather';
import { createClient } from '@/src/lib/supabase/client';
import useSWR from 'swr';
import { ALL_KELANTAN_PPS_CENTERS, JAJAHAN_CENTER_COORDS } from '@/src/data/kelantanPpsCenters';

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
    lat?: number;
    lng?: number;
}

// Calculate Haversine distance in km between two GPS points
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
}

export default function BencanaView() {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'map' | 'sensors' | 'zones'>('map');
    const [showDashboard, setShowDashboard] = useState(false);

    const { completeQuest } = useGame();
    const { addXp } = useXP();
    const supabase = createClient();

    const { weather, isWeatherLoading, locationLabel, userLat, userLng } = useWeather();

    // LoRaWAN sensor data — full telemetry from hardware + BME280
    interface SensorData {
        id: string | null;
        status: 'safe' | 'warning' | 'danger';
        water_level: number;
        battery_pct: number | null;
        rssi_dbm: number | null;
        temperature_c: number | null;
        humidity_pct: number | null;
        pressure_hpa: number | null;
        rise_rate_cm_hr: number;
        last_reading: string | null;
        is_online: boolean;
    }
    const [sensorData, setSensorData] = useState<SensorData>({
        id: null, status: 'safe', water_level: 0, battery_pct: null, rssi_dbm: null,
        temperature_c: null, humidity_pct: null, pressure_hpa: null,
        rise_rate_cm_hr: 0, last_reading: null, is_online: false,
    });
    const sensorStatus = sensorData.status;
    const sensorLabels = {
        safe: { text: t('bencana.sensor_safe'), style: 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20' },
        warning: { text: t('bencana.sensor_warning'), style: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
        danger: { text: t('bencana.sensor_danger'), style: 'bg-red-500/20 text-red-500 border border-red-500/30' },
    };
    const currentSensor = sensorLabels[sensorStatus];

    // Helper: format "last seen" as relative time
    const formatLastSeen = (iso: string | null) => {
        if (!iso) return 'Never';
        const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    // RSSI signal bars (0-4 bars based on dBm)
    const getSignalBars = (rssi: number | null): number => {
        if (rssi === null) return 0;
        if (rssi >= -50) return 4;
        if (rssi >= -70) return 3;
        if (rssi >= -90) return 2;
        if (rssi >= -110) return 1;
        return 0;
    };

    // Real-time Supabase Subscription & API Polling for LoRaWAN / ESP32 Sensor
    useEffect(() => {
        // Poll local API endpoint for real-time ESP32 sensor updates
        const fetchLatestSensor = () => {
            fetch('/api/bencana/sensors')
                .then(res => res.json())
                .then(resData => {
                    if (resData.success && resData.sensors && resData.sensors.length > 0) {
                        const target = resData.sensors.find((s: any) => s.name === 'Sungai Kelantan Node A') || resData.sensors[0];
                        if (target) {
                            setSensorData({
                                id: target.id ?? null,
                                status: target.status || 'safe',
                                water_level: target.water_level ?? 0,
                                battery_pct: target.battery_pct ?? null,
                                rssi_dbm: target.rssi_dbm ?? null,
                                temperature_c: target.temperature_c ?? null,
                                humidity_pct: target.humidity_pct ?? null,
                                pressure_hpa: target.pressure_hpa ?? null,
                                rise_rate_cm_hr: target.rise_rate_cm_hr ?? 0,
                                last_reading: target.last_reading ?? null,
                                is_online: target.is_online ?? true,
                            });
                        }
                    }
                })
                .catch(() => {});
        };

        fetchLatestSensor();
        const pollInterval = setInterval(fetchLatestSensor, 3000);

        // Fetch initial sensor data from Supabase DB
        supabase.from('nadi_bencana_sensors').select('*').eq('name', 'Sungai Kelantan Node A').single()
            .then(({ data }) => {
                if (data) {
                    setSensorData({
                        id: data.id ?? null,
                        status: data.status || 'safe',
                        water_level: data.water_level ?? 0,
                        battery_pct: data.battery_pct ?? null,
                        rssi_dbm: data.rssi_dbm ?? null,
                        temperature_c: data.temperature_c ?? null,
                        humidity_pct: data.humidity_pct ?? null,
                        pressure_hpa: data.pressure_hpa ?? null,
                        rise_rate_cm_hr: data.rise_rate_cm_hr ?? 0,
                        last_reading: data.last_reading ?? null,
                        is_online: data.is_online ?? false,
                    });
                }
            });

        // Subscribe to real-time changes — capture full telemetry
        const channel = supabase.channel('sensor_changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'nadi_bencana_sensors' }, (payload) => {
                if (payload.new) {
                    const d = payload.new;
                    setSensorData({
                        id: d.id ?? null,
                        status: d.status || 'safe',
                        water_level: d.water_level ?? 0,
                        battery_pct: d.battery_pct ?? null,
                        rssi_dbm: d.rssi_dbm ?? null,
                        temperature_c: d.temperature_c ?? null,
                        humidity_pct: d.humidity_pct ?? null,
                        pressure_hpa: d.pressure_hpa ?? null,
                        rise_rate_cm_hr: d.rise_rate_cm_hr ?? 0,
                        last_reading: d.last_reading ?? null,
                        is_online: d.is_online ?? false,
                    });
                }
            })
            .subscribe();

        return () => {
            clearInterval(pollInterval);
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
            centers: centers && centers.length > 0 ? centers.map((c: any) => ({
                name: c.name,
                district: c.district,
                capacity: c.capacity,
                type: c.type,
                lat: c.lat,
                lng: c.lng
            })) : [
                { name: 'SK Kubang Kerian', district: 'Kota Bharu', capacity: 500, type: 'Sekolah', lat: 6.092444, lng: 102.274583 },
                { name: 'Masjid Muhammadi', district: 'Kota Bharu', capacity: 800, type: 'Masjid', lat: 6.132155, lng: 102.236688 },
                { name: 'SK Kuala Krai', district: 'Kuala Krai', capacity: 400, type: 'Sekolah', lat: 5.534744, lng: 102.197519 },
                { name: 'SK Gua Musang', district: 'Gua Musang', capacity: 350, type: 'Sekolah', lat: 4.882100, lng: 101.964500 },
                { name: 'Dewan Sultan Tanah Merah', district: 'Tanah Merah', capacity: 300, type: 'Dewan', lat: 5.808300, lng: 102.148100 }
            ]
        };
    };

    const [selectedJajahan, setSelectedJajahan] = useState<string>('All');
    const [selectedType, setSelectedType] = useState<string>('All');
    const [sortBy, setSortBy] = useState<'nearest' | 'capacity' | 'name'>('nearest');
    const [searchPps, setSearchPps] = useState<string>('');
    const [displayLimit, setDisplayLimit] = useState<number>(24);
    const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false);

    const { data: bencanaData } = useSWR('bencana_data', fetchBencanaData, { revalidateOnFocus: false });
    const floodZones: FloodZone[] = bencanaData?.zones || [];

    // Calculate distance to all official Kelantan PPS centers from live GPS
    const allProcessedEvacCenters = ALL_KELANTAN_PPS_CENTERS.map(center => {
        const dist = (userLat !== null && userLng !== null)
            ? getDistanceKm(userLat, userLng, center.lat, center.lng)
            : null;
        return {
            name: center.name,
            district: center.jajahan,
            capacity: center.capacity,
            type: center.type,
            lat: center.lat,
            lng: center.lng,
            distanceKm: dist,
        };
    });

    const filteredEvacCenters = allProcessedEvacCenters.filter(c => {
        const matchesJajahan = selectedJajahan === 'All' || c.district.toLowerCase() === selectedJajahan.toLowerCase();
        const matchesType = selectedType === 'All' || c.type.toLowerCase().includes(selectedType.toLowerCase());
        const matchesSearch = searchPps === '' || c.name.toLowerCase().includes(searchPps.toLowerCase()) || c.district.toLowerCase().includes(searchPps.toLowerCase());
        return matchesJajahan && matchesType && matchesSearch;
    });

    if (sortBy === 'capacity') {
        filteredEvacCenters.sort((a, b) => b.capacity - a.capacity);
    } else if (sortBy === 'name') {
        filteredEvacCenters.sort((a, b) => a.name.localeCompare(b.name));
    } else {
        if (userLat !== null && userLng !== null) {
            filteredEvacCenters.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
        }
    }

    // Map shelters layer (top 10 nearest centers)
    const mapShelters = filteredEvacCenters.slice(0, 10);

    // Real-time geolocation tracking
    useEffect(() => {
        completeQuest('flood').then(xp => {
            if (xp > 0) addXp(xp);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Signal bars component
    const SignalBars = ({ rssi }: { rssi: number | null }) => {
        const bars = getSignalBars(rssi);
        return (
            <div className="flex items-end gap-[2px] h-3.5">
                {[1, 2, 3, 4].map(i => (
                    <div
                        key={i}
                        className="rounded-sm transition-colors"
                        style={{
                            width: 3,
                            height: `${25 + i * 18}%`,
                            background: i <= bars
                                ? bars >= 3 ? '#10B981' : bars >= 2 ? '#F59E0B' : '#EF4444'
                                : 'rgba(255,255,255,0.1)',
                        }}
                    />
                ))}
            </div>
        );
    };

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
                            {sensorStatus === 'danger'
                                ? `Water Level: ${(sensorData.water_level / 100).toFixed(1)}m (CRITICAL)`
                                : sensorData.water_level > 0
                                    ? `${sensorData.water_level} cm · ${currentSensor.text}`
                                    : currentSensor.text}
                        </span>
                        
                        <button 
                            onClick={async () => {
                                const isDanger = sensorStatus === 'danger';
                                const newStatus = isDanger ? 'safe' : 'danger';
                                const newWaterLevel = isDanger ? 2.1 : 148;
                                const newBattery = isDanger ? null : 73;
                                const newTemp = isDanger ? null : 31.2;
                                const newHumidity = isDanger ? null : 89;
                                const newPressure = isDanger ? null : 1008.3;
                                const newRiseRate = isDanger ? 0 : 8.2;
                                setSensorData(prev => ({
                                    ...prev,
                                    status: newStatus,
                                    water_level: newWaterLevel,
                                    battery_pct: newBattery,
                                    temperature_c: newTemp,
                                    humidity_pct: newHumidity,
                                    pressure_hpa: newPressure,
                                    rise_rate_cm_hr: newRiseRate,
                                    rssi_dbm: isDanger ? null : -67,
                                    last_reading: new Date().toISOString(),
                                    is_online: true,
                                }));
                                await fetch('/api/bencana/sensors', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        name: 'Sungai Kelantan Node A',
                                        status: newStatus,
                                        water_level: newWaterLevel,
                                        battery_pct: newBattery,
                                        temperature_c: newTemp,
                                        humidity_pct: newHumidity,
                                        pressure_hpa: newPressure,
                                        rise_rate_cm_hr: newRiseRate,
                                    }),
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

                                {/* Water Level Gauge + Device Health */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="md:col-span-2 rounded-2xl p-5 relative overflow-hidden" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                        {sensorStatus === 'danger' && <div className="absolute inset-0 bg-red-500/5 animate-pulse" />}
                                        <div className="flex items-end justify-between relative z-10">
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                                                    <Droplets className="w-3 h-3 inline mr-1" />Water Level
                                                </p>
                                                <p className={`text-4xl font-bold tracking-tight leading-none ${sensorStatus === 'danger' ? 'text-red-500' : sensorStatus === 'warning' ? 'text-orange-400' : 'text-emerald-400'}`}>
                                                    {sensorData.water_level !== null && sensorData.water_level !== undefined ? (sensorData.water_level < 10 ? (sensorData.water_level * 100).toFixed(0) : sensorData.water_level.toFixed(0)) : '—'}
                                                    <span className="text-sm font-medium ml-1" style={{ color: 'var(--text-muted)' }}>cm</span>
                                                </p>
                                                {/* Rise rate indicator */}
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                                                        {sensorStatus === 'danger' ? ' Above danger threshold (120cm)'
                                                            : sensorStatus === 'warning' ? ' Approaching warning level (80cm)'
                                                            : sensorData.water_level > 0 ? ' Normal range' : 'No reading yet'}
                                                    </p>
                                                    {sensorData.rise_rate_cm_hr !== 0 && (
                                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                                            sensorData.rise_rate_cm_hr > 5 ? 'bg-red-500/15 text-red-400'
                                                            : sensorData.rise_rate_cm_hr > 0 ? 'bg-orange-500/15 text-orange-400'
                                                            : 'bg-blue-500/15 text-blue-400'
                                                        }`}>
                                                            {sensorData.rise_rate_cm_hr > 0 ? '↑' : '↓'} {Math.abs(sensorData.rise_rate_cm_hr)} cm/hr
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Visual gauge bar */}
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="w-6 h-24 rounded-full relative overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                                                    <motion.div
                                                        className={`absolute bottom-0 left-0 right-0 rounded-full ${sensorStatus === 'danger' ? 'bg-red-500' : sensorStatus === 'warning' ? 'bg-orange-400' : 'bg-emerald-400'}`}
                                                        initial={{ height: '0%' }}
                                                        animate={{ height: `${Math.min(100, Math.max(2, (sensorData.water_level / 200) * 100))}%` }}
                                                        transition={{ duration: 1, ease: 'easeOut' }}
                                                    />
                                                    {/* Danger threshold line at 120/200 = 60% */}
                                                    <div className="absolute left-0 right-0 border-t border-dashed border-red-500/50" style={{ bottom: '60%' }} />
                                                </div>
                                                <span className="text-[8px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Max 200</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Device Health */}
                                    <div className="flex flex-col gap-3">
                                        <div className="flex-1 rounded-2xl p-3.5 flex flex-col justify-center" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                            <Battery className={`w-4 h-4 mb-1.5 ${sensorData.battery_pct !== null && sensorData.battery_pct < 20 ? 'text-red-500' : 'text-emerald-400'}`} />
                                            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                                {sensorData.battery_pct !== null ? `${sensorData.battery_pct}%` : '—'}
                                            </p>
                                            <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Battery</p>
                                        </div>
                                        <div className="flex-1 rounded-2xl p-3.5 flex flex-col justify-center" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <Signal className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                                <SignalBars rssi={sensorData.rssi_dbm} />
                                            </div>
                                            <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                                                {sensorData.rssi_dbm !== null ? `${sensorData.rssi_dbm} dBm` : '—'}
                                            </p>
                                            <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Signal</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Environmental Cards (from BME280 sensor data) */}
                                {(sensorData.temperature_c !== null || sensorData.humidity_pct !== null || sensorData.pressure_hpa !== null) && (
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="rounded-2xl p-3 flex flex-col items-center justify-center text-center" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                            <Thermometer className="w-4 h-4 text-orange-400 mb-1.5" />
                                            <span className="text-sm font-bold text-white">
                                                {sensorData.temperature_c !== null ? sensorData.temperature_c.toFixed(1) : '—'}
                                                <span className="text-[10px] text-zinc-400 ml-0.5">°C</span>
                                            </span>
                                            <span className="text-[8px] uppercase font-bold tracking-widest text-zinc-500 mt-1">Sensor Temp</span>
                                        </div>
                                        <div className="rounded-2xl p-3 flex flex-col items-center justify-center text-center" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                            <Droplets className="w-4 h-4 text-blue-400 mb-1.5" />
                                            <span className="text-sm font-bold text-white">
                                                {sensorData.humidity_pct !== null ? sensorData.humidity_pct : '—'}
                                                <span className="text-[10px] text-zinc-400 ml-0.5">%</span>
                                            </span>
                                            <span className="text-[8px] uppercase font-bold tracking-widest text-zinc-500 mt-1">Humidity</span>
                                        </div>
                                        <div className="rounded-2xl p-3 flex flex-col items-center justify-center text-center relative overflow-hidden" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                            {/* Pressure drop glow if below 1009 hPa (storm indicator) */}
                                            {sensorData.pressure_hpa !== null && sensorData.pressure_hpa < 1009 && (
                                                <div className="absolute inset-0 bg-orange-500/5 animate-pulse" />
                                            )}
                                            <Gauge className="w-4 h-4 text-purple-400 mb-1.5 relative z-10" />
                                            <span className={`text-sm font-bold relative z-10 ${sensorData.pressure_hpa !== null && sensorData.pressure_hpa < 1009 ? 'text-orange-400' : 'text-white'}`}>
                                                {sensorData.pressure_hpa !== null ? sensorData.pressure_hpa.toFixed(1) : '—'}
                                                <span className="text-[10px] text-zinc-400 ml-0.5">hPa</span>
                                            </span>
                                            <span className="text-[8px] uppercase font-bold tracking-widest text-zinc-500 mt-1 relative z-10">
                                                {sensorData.pressure_hpa !== null && sensorData.pressure_hpa < 1009 ? ' Low Pressure' : 'Pressure'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* 24-Hour Trend Chart */}
                                <SensorTrendChart
                                    sensorId={sensorData.id}
                                    currentWaterLevel={sensorData.water_level}
                                    riseRate={sensorData.rise_rate_cm_hr}
                                    unit="m"
                                    status={sensorData.status}
                                    lastReadingTime={sensorData.last_reading}
                                    isOnline={sensorData.is_online}
                                />

                                {/* Online status + last seen */}
                                <div className="flex items-center gap-2 rounded-xl p-2.5" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                    <Clock className="w-3.5 h-3.5" style={{ color: sensorData.is_online ? '#10B981' : 'var(--text-muted)' }} />
                                    <span className="text-[9px] font-bold" style={{ color: sensorData.is_online ? '#10B981' : 'var(--text-muted)' }}>
                                        {sensorData.is_online ? ' Online' : ' Offline'}
                                    </span>
                                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                                        · Last seen: {formatLastSeen(sensorData.last_reading)}
                                    </span>
                                    <span className="ml-auto text-[9px]" style={{ color: 'var(--text-muted)' }}>
                                        Sensor: Sungai Kelantan Node A
                                    </span>
                                </div>

                                {/* Thresholds Reference */}
                                <div className="flex items-center gap-4 text-[9px] font-medium px-1" style={{ color: 'var(--text-muted)' }}>
                                    <span> Safe: &lt;80cm</span>
                                    <span> Warning: 80-119cm</span>
                                    <span> Danger: ≥120cm</span>
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

            {/* Tab Toggle: Map / Sensors / Flood Zones */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                className="flex p-1 rounded-2xl mb-5"
                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
            >
                {([
                    { key: 'map' as const, label: ' Map' },
                    { key: 'sensors' as const, label: ' Sensors' },
                    { key: 'zones' as const, label: ' Flood Zones' },
                ]).map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className="flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all"
                        style={activeTab === tab.key
                            ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }
                            : { color: 'var(--text-muted)' }
                        }
                    >{tab.label}</button>
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
                                                        <p className="text-[9px] font-medium text-gray-300 mt-0.5 tracking-wider"> {userLat.toFixed(4)}°N, {userLng.toFixed(4)}°E</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Official Kelantan Evacuation Centers (PPS) */}
                            <div className="space-y-4">
                                {/* Section Header & Sleek Glassmorphic Search Bar */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                                            <AlertTriangle className="w-4 h-4 text-emerald-400" />
                                            Official Kelantan Evacuation Centers (PPS)
                                        </h3>
                                        <p className="text-[11px] text-zinc-400 mt-1">
                                            Registered Centers: <span className="text-emerald-400 font-bold">{filteredEvacCenters.length}</span> of {allProcessedEvacCenters.length} across Kelantan
                                        </p>
                                    </div>

                                    {/* Sleek Search Bar */}
                                    <div className="relative w-full md:w-80">
                                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                                        <input
                                            type="text"
                                            placeholder="Cari pusat pemindahan (e.g. SK, Masjid, Dewan)..."
                                            value={searchPps}
                                            onChange={(e) => {
                                                setSearchPps(e.target.value);
                                                setDisplayLimit(24);
                                            }}
                                            className="w-full pl-10 pr-9 py-2 rounded-xl text-xs bg-black/60 border border-zinc-700/70 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-white placeholder-zinc-500 transition-all shadow-inner"
                                        />
                                        {searchPps && (
                                            <button onClick={() => setSearchPps('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Filter Controls Bar: Jajahan + Type + Sort */}
                                <div className="space-y-2.5 p-3.5 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                                    {/* Jajahan Pills */}
                                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 shrink-0 mr-1 flex items-center gap-1">
                                            <MapPin className="w-3 h-3 text-emerald-400" /> Jajahan:
                                        </span>
                                        {['All', 'Kota Bharu', 'Pasir Mas', 'Gua Musang', 'Kuala Krai', 'Tumpat', 'Bachok', 'Machang', 'Pasir Puteh', 'Jeli', 'Tanah Merah'].map(jajahan => (
                                            <button
                                                key={jajahan}
                                                onClick={() => {
                                                    setSelectedJajahan(jajahan);
                                                    setDisplayLimit(24);
                                                }}
                                                className={`px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border ${
                                                    selectedJajahan === jajahan
                                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-md'
                                                        : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                                                }`}
                                            >
                                                {jajahan}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Type Filters & Sort By Controls */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-zinc-800/60">
                                        {/* Type Pills */}
                                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 shrink-0 mr-1 flex items-center gap-1">
                                                <Filter className="w-3 h-3 text-blue-400" /> Jenis:
                                            </span>
                                            {[
                                                { id: 'All', label: 'Semua' },
                                                { id: 'Sekolah', label: '🏫 Sekolah' },
                                                { id: 'Masjid', label: '🕌 Masjid' },
                                                { id: 'Dewan', label: '🏛️ Dewan' },
                                                { id: 'Balai Raya', label: '📍 Balai Raya' },
                                                { id: 'Madrasah', label: '🕌 Madrasah' },
                                            ].map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => {
                                                        setSelectedType(t.id);
                                                        setDisplayLimit(24);
                                                    }}
                                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border ${
                                                        selectedType === t.id
                                                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                                                            : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:text-white'
                                                    }`}
                                                >
                                                    {t.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Sort By Dropdown Pills */}
                                        <div className="flex items-center gap-1.5 ml-auto">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1">
                                                <ArrowUpDown className="w-3 h-3 text-purple-400" /> Susun:
                                            </span>
                                            {[
                                                { id: 'nearest', label: '📍 Terdekat' },
                                                { id: 'capacity', label: '👥 Kapasiti' },
                                                { id: 'name', label: '🔤 Nama A-Z' },
                                            ].map(s => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => setSortBy(s.id as any)}
                                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border ${
                                                        sortBy === s.id
                                                            ? 'bg-purple-500/20 text-purple-400 border-purple-500/50'
                                                            : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:text-white'
                                                    }`}
                                                >
                                                    {s.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* PPS Cards Grid */}
                                {filteredEvacCenters.length === 0 ? (
                                    <div className="p-12 text-center rounded-2xl border border-zinc-800 bg-zinc-900/40">
                                        <AlertTriangle className="w-8 h-8 text-orange-400 mx-auto mb-2 opacity-60" />
                                        <p className="text-xs font-bold text-zinc-300">Tiada pusat pemindahan dijumpai</p>
                                        <p className="text-[10px] text-zinc-500 mt-1">Cuba cari nama lain atau tukar jajahan filter.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {filteredEvacCenters.slice(0, displayLimit).map((center, i) => (
                                                <motion.div
                                                    key={`${center.district}-${center.name}-${i}`}
                                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(0.2, 0.03 * (i % 12)) }}
                                                    className="flex items-center justify-between p-3.5 rounded-2xl transition-all hover:border-emerald-500/40 hover:bg-zinc-900/80 group"
                                                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 group-hover:scale-110 transition-transform" style={{ background: 'var(--accent-muted)' }}>
                                                            {center.type === 'Sekolah' ? '🏫' : center.type === 'Masjid' ? '🕌' : center.type === 'Madrasah' ? '🕌' : center.type === 'Dewan' ? '🏛️' : '📍'}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold truncate group-hover:text-emerald-400 transition-colors" style={{ color: 'var(--text-primary)' }}>{center.name}</p>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{center.district} · {center.type}</span>
                                                                {center.distanceKm !== null && (
                                                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                                         {center.distanceKm} km
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0 ml-2">
                                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                            Official PPS
                                                        </span>
                                                        <p className="text-[8px] font-bold uppercase text-zinc-500 mt-0.5">JKM / NADMA</p>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>

                                        {/* Pagination & Load More Controls */}
                                        {filteredEvacCenters.length > displayLimit && (
                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-800">
                                                <span className="text-[11px] font-medium text-zinc-400">
                                                    Menunjukkan <strong className="text-emerald-400">{displayLimit}</strong> daripada <strong>{filteredEvacCenters.length}</strong> Pusat Pemindahan
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setDisplayLimit(prev => Math.min(filteredEvacCenters.length, prev + 24))}
                                                        className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
                                                    >
                                                        Lihat Lagi (+24 Pusat)
                                                    </button>
                                                    <button
                                                        onClick={() => setDisplayLimit(filteredEvacCenters.length)}
                                                        className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 hover:text-white transition-all"
                                                    >
                                                        Tunjukkan Semua ({filteredEvacCenters.length})
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* === SENSORS TAB === */}
                    {activeTab === 'sensors' && (
                        <motion.div
                            key="sensors"
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}
                            className="space-y-4"
                        >
                            {/* Sensor Card Header */}
                            <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                                {sensorStatus === 'danger' && <div className="absolute inset-0 bg-red-500/5 animate-pulse" />}

                                {/* Early Warning Banner */}
                                {sensorData.rise_rate_cm_hr > 5 && (
                                    <div className="mb-4 p-3 rounded-xl flex items-center gap-3 animate-pulse relative z-10" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                                        <div>
                                            <p className="text-xs font-bold text-red-400"> EARLY WARNING: Rapid Rise Detected</p>
                                            <p className="text-[10px] text-red-400/80 mt-0.5">
                                                Water rising {sensorData.rise_rate_cm_hr} cm/hr — estimated {Math.max(1, Math.round((120 - sensorData.water_level) / sensorData.rise_rate_cm_hr))} hours to danger level
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between mb-4 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                            sensorStatus === 'danger' ? 'bg-red-500/20' : sensorStatus === 'warning' ? 'bg-orange-500/20' : 'bg-emerald-500/20'
                                        }`}>
                                            <Radio className={`w-5 h-5 ${
                                                sensorStatus === 'danger' ? 'text-red-500' : sensorStatus === 'warning' ? 'text-orange-400' : 'text-emerald-400'
                                            }`} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Sungai Kelantan Node A</h3>
                                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Kota Bharu · Ultrasonic · LoRaWAN</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <SignalBars rssi={sensorData.rssi_dbm} />
                                        <span className={`text-[9px] font-bold px-3 py-1.5 rounded-full tracking-widest uppercase ${currentSensor.style}`}>
                                            {currentSensor.text}
                                        </span>
                                    </div>
                                </div>

                                {/* Water Level + Stats Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
                                    <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                        <Droplets className={`w-4 h-4 mb-1 ${sensorStatus === 'danger' ? 'text-red-500' : 'text-blue-400'}`} />
                                        <p className={`text-xl font-bold ${sensorStatus === 'danger' ? 'text-red-500' : sensorStatus === 'warning' ? 'text-orange-400' : 'text-emerald-400'}`}>
                                            {sensorData.water_level !== null && sensorData.water_level !== undefined ? Math.round(sensorData.water_level < 10 ? sensorData.water_level * 100 : sensorData.water_level) : '—'}
                                        </p>
                                        <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Water (cm)</p>
                                    </div>
                                    <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                        <Battery className={`w-4 h-4 mb-1 ${sensorData.battery_pct !== null && sensorData.battery_pct < 20 ? 'text-red-500' : 'text-emerald-400'}`} />
                                        <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                            {sensorData.battery_pct !== null ? `${sensorData.battery_pct}%` : '—'}
                                        </p>
                                        <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Battery</p>
                                    </div>
                                    <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                        <Signal className="w-4 h-4 mb-1" style={{ color: 'var(--text-muted)' }} />
                                        <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                            {sensorData.rssi_dbm !== null ? sensorData.rssi_dbm : '—'}
                                        </p>
                                        <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>RSSI (dBm)</p>
                                    </div>
                                    <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                        <Clock className="w-4 h-4 mb-1" style={{ color: sensorData.is_online ? '#10B981' : 'var(--text-muted)' }} />
                                        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                            {formatLastSeen(sensorData.last_reading)}
                                        </p>
                                        <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                                            {sensorData.is_online ? ' Online' : ' Offline'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Environmental Data (from BME280) */}
                            {(sensorData.temperature_c !== null || sensorData.humidity_pct !== null || sensorData.pressure_hpa !== null) && (
                                <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                                    <p className="text-[9px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                                        <Thermometer className="w-3 h-3" /> On-Site Environmental (BME280)
                                    </p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="rounded-xl p-3 flex flex-col items-center text-center" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                            <Thermometer className="w-5 h-5 text-orange-400 mb-1.5" />
                                            <span className="text-lg font-bold text-white">
                                                {sensorData.temperature_c !== null ? sensorData.temperature_c.toFixed(1) : '—'}°
                                            </span>
                                            <span className="text-[8px] uppercase font-bold tracking-widest text-zinc-500 mt-0.5">Temperature</span>
                                        </div>
                                        <div className="rounded-xl p-3 flex flex-col items-center text-center" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                            <Droplets className="w-5 h-5 text-blue-400 mb-1.5" />
                                            <span className="text-lg font-bold text-white">
                                                {sensorData.humidity_pct !== null ? sensorData.humidity_pct : '—'}%
                                            </span>
                                            <span className="text-[8px] uppercase font-bold tracking-widest text-zinc-500 mt-0.5">Humidity</span>
                                        </div>
                                        <div className="rounded-xl p-3 flex flex-col items-center text-center relative overflow-hidden" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                                            {sensorData.pressure_hpa !== null && sensorData.pressure_hpa < 1009 && (
                                                <div className="absolute inset-0 bg-orange-500/8 animate-pulse" />
                                            )}
                                            <Gauge className="w-5 h-5 text-purple-400 mb-1.5 relative z-10" />
                                            <span className={`text-lg font-bold relative z-10 ${sensorData.pressure_hpa !== null && sensorData.pressure_hpa < 1009 ? 'text-orange-400' : 'text-white'}`}>
                                                {sensorData.pressure_hpa !== null ? sensorData.pressure_hpa.toFixed(0) : '—'}
                                            </span>
                                            <span className="text-[8px] uppercase font-bold tracking-widest text-zinc-500 mt-0.5 relative z-10">
                                                {sensorData.pressure_hpa !== null && sensorData.pressure_hpa < 1009 ? ' Storm Signal' : 'Pressure (hPa)'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 24-Hour Trend Chart */}
                            <SensorTrendChart
                                sensorId={sensorData.id}
                                currentWaterLevel={sensorData.water_level}
                                riseRate={sensorData.rise_rate_cm_hr}
                                unit="m"
                                status={sensorData.status}
                                lastReadingTime={sensorData.last_reading}
                                isOnline={sensorData.is_online}
                            />

                            {/* Thresholds + Info */}
                            <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                                <p className="text-[9px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                                    <BarChart3 className="w-3 h-3" /> Threshold Reference
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                                        <p className="text-[10px] font-bold text-emerald-400">SAFE</p>
                                        <p className="text-[8px] text-emerald-400/60">&lt; 80 cm</p>
                                    </div>
                                    <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.15)' }}>
                                        <p className="text-[10px] font-bold text-orange-400">WARNING</p>
                                        <p className="text-[8px] text-orange-400/60">80 — 119 cm</p>
                                    </div>
                                    <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                                        <p className="text-[10px] font-bold text-red-500">DANGER</p>
                                        <p className="text-[8px] text-red-500/60">≥ 120 cm</p>
                                    </div>
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
                                                <span> Pop: {zone.population.toLocaleString()}</span>
                                                <span> {zone.historicLevel}</span>
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
