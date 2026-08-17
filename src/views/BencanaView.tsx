'use client';
import { MapPin, Navigation, AlertTriangle, Radio, Info, Loader2, ShieldAlert, Cloud, Droplets, Wind, Thermometer, Activity, Battery, Signal, Clock, Gauge, BarChart3, Search, X, SlidersHorizontal, Filter, ArrowUpDown, ChevronDown, Phone, SunMedium, Sparkles, Check } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '@/src/context/LanguageContext';
import dynamic from 'next/dynamic';

const GPSMap = dynamic(() => import('@/src/components/GPSMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Memuatkan Peta...</p>
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
import { JPS_KELANTAN_STATIONS, TAMBATAN_DRAJA } from '@/src/data/jpsKelantanStations';

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
    const { t, lang } = useLanguage();
    const isMs = lang === 'ms';
    const [activeTab, setActiveTab] = useState<'map' | 'sensors' | 'zones'>('map');

    const supabase = useMemo(() => createClient(), []);

    const { weather, isWeatherLoading, locationLabel, userLat, userLng } = useWeather();

    // LoRaWAN sensor data — full telemetry from hardware + BME280
    interface SensorData {
        id: string | null;
        status: 'safe' | 'warning' | 'danger' | 'offline' | 'sensor_fault' | string;
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
    const sensorLabels: Record<string, { text: string; style: string }> = {
        safe: { text: 'SELAMAT', style: 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20' },
        warning: { text: 'AMARAN', style: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
        danger: { text: 'BAHAYA', style: 'bg-red-500/20 text-red-500 border border-red-500/30' },
        offline: { text: 'TERPUTUS', style: 'bg-zinc-800 text-zinc-400 border border-zinc-700' },
        sensor_fault: { text: 'SENSOR ROSAK', style: 'bg-red-500/20 text-red-400 border border-red-500/40' },
    };
    const currentSensor = sensorLabels[sensorStatus] || sensorLabels.offline;

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
        const calcIsOnline = (lastReading: any, rawIsOnline: any, rawStatus: any) => {
            const lastReadingTs = lastReading ? new Date(lastReading).getTime() : 0;
            const isStale = !lastReadingTs || (Date.now() - lastReadingTs) > 30000;
            return rawIsOnline !== false && !isStale && rawStatus !== 'sensor_fault' && rawStatus !== 'offline';
        };

        const fetchLatestSensor = () => {
            fetch('/api/bencana/sensors')
                .then(res => res.json())
                .then(resData => {
                    if (resData.success && resData.sensors && resData.sensors.length > 0) {
                        const target = resData.sensors.find((s: any) => s.name === 'Sungai Kelantan Node A') || resData.sensors[0];
                        if (target) {
                            const online = calcIsOnline(target.last_reading, target.is_online, target.status);
                            setSensorData({
                                id: target.id ?? null,
                                status: online ? (target.status || 'safe') : 'offline',
                                water_level: target.water_level ?? 0,
                                battery_pct: target.battery_pct ?? null,
                                rssi_dbm: target.rssi_dbm ?? null,
                                temperature_c: target.temperature_c ?? null,
                                humidity_pct: target.humidity_pct ?? null,
                                pressure_hpa: target.pressure_hpa ?? null,
                                rise_rate_cm_hr: target.rise_rate_cm_hr ?? 0,
                                last_reading: target.last_reading ?? null,
                                is_online: online,
                            });
                        }
                    }
                })
                .catch(() => {});
        };

        fetchLatestSensor();
        const pollInterval = setInterval(fetchLatestSensor, 30000);

        // Fetch initial sensor data from Supabase DB
        supabase.from('nadi_bencana_sensors').select('*').eq('name', 'Sungai Kelantan Node A').single()
            .then(({ data }) => {
                if (data) {
                    const online = calcIsOnline(data.last_reading, data.is_online, data.status);
                    setSensorData({
                        id: data.id ?? null,
                        status: online ? (data.status || 'safe') : 'offline',
                        water_level: data.water_level ?? 0,
                        battery_pct: data.battery_pct ?? null,
                        rssi_dbm: data.rssi_dbm ?? null,
                        temperature_c: data.temperature_c ?? null,
                        humidity_pct: data.humidity_pct ?? null,
                        pressure_hpa: data.pressure_hpa ?? null,
                        rise_rate_cm_hr: data.rise_rate_cm_hr ?? 0,
                        last_reading: data.last_reading ?? null,
                        is_online: online,
                    });
                }
            });

        // Subscribe to real-time changes — capture full telemetry
        const channel = supabase.channel('sensor_changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'nadi_bencana_sensors' }, (payload) => {
                if (payload.new) {
                    const d = payload.new;
                    const online = calcIsOnline(d.last_reading, d.is_online, d.status);
                    setSensorData({
                        id: d.id ?? null,
                        status: online ? (d.status || 'safe') : 'offline',
                        water_level: d.water_level ?? 0,
                        battery_pct: d.battery_pct ?? null,
                        rssi_dbm: d.rssi_dbm ?? null,
                        temperature_c: d.temperature_c ?? null,
                        humidity_pct: d.humidity_pct ?? null,
                        pressure_hpa: d.pressure_hpa ?? null,
                        rise_rate_cm_hr: d.rise_rate_cm_hr ?? 0,
                        last_reading: d.last_reading ?? null,
                        is_online: online,
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
    const [searchJps, setSearchJps] = useState<string>('');
    const [displayLimit, setDisplayLimit] = useState<number>(24);
    const [showLocationPicker, setShowLocationPicker] = useState<boolean>(false);
    const [showSosModal, setShowSosModal] = useState<boolean>(false);
    const [mounted, setMounted] = useState<boolean>(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleSosClick = (e: React.MouseEvent) => {
        const isMobileOrTablet = typeof window !== 'undefined' && (
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)
        );
        if (!isMobileOrTablet) {
            e.preventDefault();
            setShowSosModal(true);
        }
    };

    useEffect(() => {
        if (showSosModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [showSosModal]);

    const { data: bencanaData } = useSWR('bencana_data', fetchBencanaData, { revalidateOnFocus: false });
    const floodZones: FloodZone[] = bencanaData?.zones || [];

    // Calculate distance to all official Kelantan PPS centers from live GPS
    const allProcessedEvacCenters = useMemo(() => {
        return ALL_KELANTAN_PPS_CENTERS.map(center => {
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
    }, [userLat, userLng]);

    const filteredEvacCenters = useMemo(() => {
        const filtered = allProcessedEvacCenters.filter(c => {
            const matchesJajahan = selectedJajahan === 'All' || c.district.toLowerCase() === selectedJajahan.toLowerCase();
            const matchesType = selectedType === 'All' || c.type.toLowerCase().includes(selectedType.toLowerCase());
            const matchesSearch = searchPps === '' || c.name.toLowerCase().includes(searchPps.toLowerCase()) || c.district.toLowerCase().includes(searchPps.toLowerCase());
            return matchesJajahan && matchesType && matchesSearch;
        });

        if (sortBy === 'capacity') {
            filtered.sort((a, b) => b.capacity - a.capacity);
        } else if (sortBy === 'name') {
            filtered.sort((a, b) => a.name.localeCompare(b.name));
        } else {
            if (userLat !== null && userLng !== null) {
                filtered.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
            }
        }

        return filtered;
    }, [allProcessedEvacCenters, selectedJajahan, selectedType, searchPps, sortBy, userLat, userLng]);

    // Map shelters layer (top 10 nearest centers)
    const mapShelters = filteredEvacCenters.slice(0, 10);

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

            {/* Simple Clean Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl backdrop-blur-xl relative overflow-hidden border shadow-xl"
                style={{
                    background: '#0D0D10',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
            >
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            LIVE
                        </span>
                        <span className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                            {locationLabel === 'Locating...' ? 'Kelantan, Malaysia' : locationLabel}
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white font-serif">
                        {t('bencana.title')}
                    </h1>
                    <p className="text-xs text-zinc-400 mt-0.5">
                        Pantau paras air sungai, cuaca, dan pusat pemindahan di kawasan anda.
                    </p>
                </div>

                <div className="flex items-center gap-2 relative z-10 shrink-0">
                    <button
                        onClick={() => {
                            setActiveTab('map');
                            setTimeout(() => {
                                const ppsElement = document.getElementById('pps-section');
                                if (ppsElement) {
                                    ppsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                            }, 120);
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all flex items-center gap-1.5 active:scale-95"
                    >
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pusat Pemindahan (PPS)</span>
                    </button>
                    <a
                        href="tel:999"
                        onClick={handleSosClick}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg border border-red-500/50 transition-all flex items-center gap-1.5 active:scale-95 shrink-0 cursor-pointer"
                    >
                        <Phone className="w-3.5 h-3.5 animate-bounce" />
                        <span>SOS 999</span>
                    </a>
                </div>
            </motion.div>

            {/* Environmental & Weather Dashboard */}
            {isWeatherLoading ? (
                <div className="mb-5 space-y-3">
                    <div className="h-32 skeleton rounded-3xl" />
                </div>
            ) : weather && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}
                    className="mb-5 space-y-3"
                >
                    {/* Environmental Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

                        {/* Main Weather Card */}
                        <div
                            className="lg:col-span-5 rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden border shadow-xl backdrop-blur-md"
                            style={{
                                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
                                borderColor: 'rgba(59, 130, 246, 0.2)',
                            }}
                        >
                            <div className="flex items-start justify-between relative z-10">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1 mb-1">
                                        <Cloud className="w-3.5 h-3.5" /> CUACA
                                    </span>
                                    <h3 className="text-3xl font-bold text-white tracking-tight leading-none">
                                        {weather.temp}°<span className="text-xl font-normal text-zinc-400">C</span>
                                    </h3>
                                    <p className="text-xs text-zinc-300 mt-1">
                                        Rasa seperti <strong className="text-white">{weather.feelsLike}°C</strong>
                                    </p>
                                </div>
                                <div className="p-3 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
                                    <SunMedium className="w-7 h-7" />
                                </div>
                            </div>
                        </div>

                        {/* Air Quality (AQI) Tile */}
                        <div
                            className="lg:col-span-7 rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden border shadow-xl backdrop-blur-md"
                            style={{
                                background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.8) 0%, rgba(9, 9, 11, 0.95) 100%)',
                                borderColor: 'rgba(255, 255, 255, 0.08)',
                            }}
                        >
                            <div className="flex items-start justify-between relative z-10 mb-3">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1 mb-1">
                                        <Activity className="w-3.5 h-3.5" /> KUALITI UDARA
                                    </span>
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-3xl font-bold ${weather.aqi > 100 ? 'text-orange-400' : weather.aqi > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                            {weather.aqi} <span className="text-xs text-zinc-400 font-normal">AQI</span>
                                        </span>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                                            weather.aqi > 100 ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : weather.aqi > 50 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                        }`}>
                                            {weather.aqi <= 50 ? 'BAIK' : weather.aqi <= 100 ? 'SEDERHANA' : 'TIDAK SIHAT'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 relative z-10">
                                <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between text-xs">
                                    <span className="text-zinc-400 font-medium">PM2.5</span>
                                    <strong className={weather.pm25 > 12 ? 'text-amber-400' : 'text-emerald-400'}>{weather.pm25} µg/m³</strong>
                                </div>
                                <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-between text-xs">
                                    <span className="text-zinc-400 font-medium">PM10</span>
                                    <strong className={weather.pm10 > 54 ? 'text-amber-400' : 'text-emerald-400'}>{weather.pm10} µg/m³</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3 Simple Parameters: Rain, Wind, Flood Risk */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-2xl p-3.5 border shadow-lg flex items-center gap-3 bg-zinc-900/80 border-zinc-800">
                            <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-400 shrink-0">
                                <Droplets className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-bold text-zinc-400 block">Hujan</span>
                                <span className="text-base font-bold text-white">{weather.rainMm} <span className="text-xs font-normal text-zinc-400">mm</span></span>
                            </div>
                        </div>

                        <div className="rounded-2xl p-3.5 border shadow-lg flex items-center gap-3 bg-zinc-900/80 border-zinc-800">
                            <div className="p-2.5 rounded-xl bg-teal-500/15 text-teal-400 shrink-0">
                                <Wind className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-bold text-zinc-400 block">Angin</span>
                                <span className="text-base font-bold text-white">{weather.windSpeed} <span className="text-xs font-normal text-zinc-400">km/h</span></span>
                            </div>
                        </div>

                        <div className="rounded-2xl p-3.5 border shadow-lg flex items-center gap-3 bg-zinc-900/80 border-zinc-800">
                            <div className={`p-2.5 rounded-xl border shrink-0 ${weather.floodRisk === 'High' ? 'bg-red-500/20 text-red-400 border-red-500/40' : weather.floodRisk === 'Moderate' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'}`}>
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-bold text-zinc-400 block">Risiko Banjir</span>
                                <span className={`text-base font-bold ${weather.floodRisk === 'High' ? 'text-red-400' : weather.floodRisk === 'Moderate' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {weather.floodRisk === 'High' ? 'TINGGI' : weather.floodRisk === 'Moderate' ? 'SEDERHANA' : 'RENDAH'}
                                </span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* River Sensor Status Strip */}
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                className="mb-6 p-4 rounded-3xl border shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/90 border-zinc-800"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 shrink-0">
                        <Radio className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white">Paras Air Sungai</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                            Sungai Kelantan Node A
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                    <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full uppercase transition-colors border ${currentSensor.style}`}>
                        {sensorData.is_online === false || sensorData.status === 'offline' || sensorData.status === 'sensor_fault'
                            ? currentSensor.text
                            : sensorData.water_level > 0
                                ? `${Math.round(sensorData.water_level * 100)} cm · ${currentSensor.text}`
                                : currentSensor.text}
                    </span>

                    <button
                        onClick={() => setActiveTab(activeTab === 'sensors' ? 'map' : 'sensors')}
                        className="text-xs font-bold px-4 py-2 rounded-xl transition-all duration-300 ease-out shadow-md active:scale-95 flex items-center justify-center border"
                        style={activeTab === 'sensors'
                            ? { background: 'var(--accent)', color: '#000', borderColor: 'var(--accent)' }
                            : { background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-primary)', borderColor: 'rgba(255, 255, 255, 0.15)' }
                        }
                    >
                        <div className="flex items-center justify-center">
                            <span
                                className={`transition-all duration-300 ease-out flex items-center overflow-hidden shrink-0 ${
                                    activeTab === 'sensors'
                                        ? 'w-4 opacity-100 scale-100 mr-1.5'
                                        : 'w-0 opacity-0 scale-0 mr-0'
                                }`}
                            >
                                <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                            </span>
                            <span>Sensors</span>
                        </div>
                    </button>
                </div>
            </motion.div>





            {/* Tab Toggle: Map / Sensors / Flood Zones */}
            <motion.div
                initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                className="flex p-1.5 rounded-3xl mb-6 backdrop-blur-xl border shadow-xl"
                style={{
                    background: 'linear-gradient(135deg, rgba(20, 20, 23, 0.8) 0%, rgba(9, 9, 11, 0.95) 100%)',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                }}
            >
                {([
                    { key: 'map' as const, label: 'Peta & PPS', icon: MapPin },
                    { key: 'sensors' as const, label: 'Sensor & Paras Air', icon: Radio },
                    { key: 'zones' as const, label: 'Kawasan Berisiko', icon: ShieldAlert },
                ]).map(tab => {
                    const IconComponent = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className="flex-1 py-3 px-3 text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-2 relative active:scale-98"
                            style={isActive
                                ? {
                                    background: 'linear-gradient(135deg, rgba(39, 39, 42, 0.9) 0%, rgba(24, 24, 27, 0.95) 100%)',
                                    color: '#FFFFFF',
                                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                }
                                : { color: 'var(--text-muted)' }
                            }
                        >
                            <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'opacity-60'}`} />
                            <span className="hidden sm:inline">{tab.label}</span>
                            <span className="sm:hidden">{tab.key.toUpperCase()}</span>
                            {isActive && (
                                <div
                                    className="absolute bottom-1 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981]"
                                />
                            )}
                        </button>
                    );
                })}
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
                                                        BERPINDAH SEGERA
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
                            <div id="pps-section" className="space-y-4">
                                {/* Section Header & Sleek Glassmorphic Search Bar */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                                            <AlertTriangle className="w-4 h-4 text-emerald-400" />
                                            Pusat Pemindahan Sementara (PPS)
                                        </h3>
                                        <p className="text-[11px] text-zinc-400 mt-1">
                                            PPS Berdaftar: <span className="text-emerald-400 font-bold">{filteredEvacCenters.length}</span> daripada {allProcessedEvacCenters.length} di Kelantan
                                        </p>
                                    </div>

                                    {/* Sleek Search Bar */}
                                    <div className="relative w-full md:w-80">
                                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                                        <input
                                            type="text"
                                            placeholder="Cari nama sekolah, masjid, atau dewan..."
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
                                                        Lihat Lagi (+24 PPS)
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
                                            <p className="text-xs font-bold text-red-400"> AMARAN: Paras Air Naik Cepat</p>
                                            <p className="text-[10px] text-red-400/80 mt-0.5">
                                                Paras air naik {sensorData.rise_rate_cm_hr} cm/jam — dianggarkan {Math.max(1, Math.round((120 - sensorData.water_level) / sensorData.rise_rate_cm_hr))} jam sebelum tahap bahaya
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
                                            {sensorData.water_level !== null && sensorData.water_level !== undefined ? Math.round(sensorData.water_level * 100) : '—'}
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

                            {/* Official JPS Threshold Benchmark — Tambatan D'Raja */}
                            <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
                                    <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                        <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                                        Paras Penanda JPS — Sungai Kelantan (Tambatan D'Raja)
                                    </span>
                                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 w-fit">
                                        Disahkan JPS
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 block">Normal</span>
                                        <span className="text-sm font-extrabold text-emerald-300">{TAMBATAN_DRAJA.normal.toFixed(2)} m</span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 block">Waspada</span>
                                        <span className="text-sm font-extrabold text-amber-300">{TAMBATAN_DRAJA.alert.toFixed(2)} m</span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-orange-400 block">Amaran</span>
                                        <span className="text-sm font-extrabold text-orange-300">{TAMBATAN_DRAJA.warning.toFixed(2)} m</span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 block">Bahaya</span>
                                        <span className="text-sm font-extrabold text-red-300">{TAMBATAN_DRAJA.danger.toFixed(2)} m</span>
                                    </div>
                                </div>
                            </div>

                            {/* Official JPS Telemetry Stations — 31 Stations Across Kelantan */}
                            <div className="p-5 rounded-2xl space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                                            <Radio className="w-4 h-4 text-emerald-400" />
                                            Stesen Paras Air Sungai JPS ({JPS_KELANTAN_STATIONS.length} Stesen Rasmi)
                                        </h3>
                                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                            Paras air sungai terkini dan tahap amaran rasmi daripada Jabatan Pengairan dan Saliran
                                        </p>
                                    </div>
                                    <div className="relative w-full md:w-72">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                        <input
                                            type="text"
                                            placeholder="Cari stesen (e.g. Tambatan D'Raja)..."
                                            value={searchJps}
                                            onChange={(e) => setSearchJps(e.target.value)}
                                            className="w-full pl-9 pr-8 py-1.5 rounded-xl text-xs border focus:outline-none text-white placeholder-zinc-500 shadow-inner"
                                            style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-default)' }}
                                        />
                                        {searchJps && (
                                            <button onClick={() => setSearchJps('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 hover:text-white" style={{ color: 'var(--text-muted)' }}>
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {JPS_KELANTAN_STATIONS.filter(st =>
                                        !searchJps ||
                                        st.name.toLowerCase().includes(searchJps.toLowerCase()) ||
                                        st.district.toLowerCase().includes(searchJps.toLowerCase()) ||
                                        st.id.toLowerCase().includes(searchJps.toLowerCase())
                                    ).map((st) => {
                                        const isTambatan = st.id === '0730671WL';
                                        const sb = (() => {
                                            if (st.level === null) return { text: 'TIADA DATA', cls: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
                                            if (st.level >= st.danger) return { text: 'BAHAYA', cls: 'bg-red-500/20 text-red-400 border-red-500/40' };
                                            if (st.level >= st.warning) return { text: 'AMARAN', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/40' };
                                            if (st.level >= st.alert) return { text: 'WASPADA', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
                                            return { text: 'NORMAL', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' };
                                        })();

                                        return (
                                            <div
                                                key={st.id}
                                                className={`p-3.5 rounded-2xl border transition-all ${
                                                    isTambatan
                                                        ? 'bg-emerald-950/20 border-emerald-500/40 shadow-md ring-1 ring-emerald-500/30'
                                                        : 'hover:border-zinc-700'
                                                }`}
                                                style={isTambatan ? {} : { background: 'var(--bg-subtle)', borderColor: 'var(--border-default)' }}
                                            >
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                            <span className={`w-2 h-2 rounded-full shrink-0 ${st.level !== null && st.level >= st.danger ? 'bg-red-500 animate-ping' : st.level !== null && st.level >= st.warning ? 'bg-orange-500 animate-pulse' : st.level !== null && st.level >= st.alert ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                                                            <h4 className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                                                                {st.name}
                                                            </h4>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {isTambatan && (
                                                                <span className="text-[8px] font-bold px-1.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                                                                    NODE A
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{st.district} · {st.id}</p>
                                                    </div>
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${sb.cls}`}>
                                                        {sb.text}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between text-xs p-2 rounded-xl border mb-2" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                                                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Paras Air:</span>
                                                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                                                        {st.level !== null ? `${st.level.toFixed(2)} m` : '—'}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-4 gap-1 text-[8px] text-center font-bold">
                                                    <div className="p-1 rounded border text-zinc-400" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                                                        <span className="block text-[7px] text-zinc-500">NORMAL</span>
                                                        {st.normal.toFixed(1)}m
                                                    </div>
                                                    <div className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                                        <span className="block text-[7px] text-amber-500/60">ALERT</span>
                                                        {st.alert.toFixed(1)}m
                                                    </div>
                                                    <div className="p-1 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400">
                                                        <span className="block text-[7px] text-orange-500/60">WARNING</span>
                                                        {st.warning.toFixed(1)}m
                                                    </div>
                                                    <div className="p-1 rounded bg-red-500/10 border border-red-500/20 text-red-400">
                                                        <span className="block text-[7px] text-red-500/60">DANGER</span>
                                                        {st.danger.toFixed(1)}m
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
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
                                    Risiko banjir mengikut daerah berdasarkan rekod banjir lalu (2014-2024).
                                </p>
                            </div>

                            {floodZones.length === 0 && (
                                <div className="text-center py-12 rounded-3xl text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', border: '1px dashed var(--border-default)' }}>
                                    Tiada rekod kawasan berisiko
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

            {/* Desktop Emergency Hotline Modal Portal */}
            {mounted && showSosModal && createPortal(
                <AnimatePresence>
                    {showSosModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                            onClick={() => setShowSosModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-md p-6 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl text-white relative overflow-hidden"
                            >
                                <button
                                    onClick={() => setShowSosModal(false)}
                                    className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full bg-zinc-800 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>

                                <div className="flex items-center gap-3 mb-5">
                                    <div className="p-3 rounded-2xl bg-red-500/20 text-red-500 border border-red-500/30 shrink-0">
                                        <Phone className="w-6 h-6 animate-pulse" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold">Talian Kecemasan Bencana</h3>
                                        <p className="text-xs text-zinc-400">Panggilan bantuan dan penyelamat 24 jam</p>
                                    </div>
                                </div>

                                <div className="space-y-2.5 text-xs">
                                    <div className="p-3.5 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-between shadow-sm">
                                        <div>
                                            <span className="font-bold text-white block">MERS 999 (Polis, Ambulans, Hospital)</span>
                                            <span className="text-[10px] text-zinc-400">Talian Utama Semua Kecemasan</span>
                                        </div>
                                        <a href="tel:999" className="px-3.5 py-1.5 rounded-xl font-bold bg-red-600 text-white text-xs hover:bg-red-500 transition-colors shrink-0">999</a>
                                    </div>

                                    <div className="p-3.5 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-between shadow-sm">
                                        <div>
                                            <span className="font-bold text-white block">Bomba & Penyelamat</span>
                                            <span className="text-[10px] text-zinc-400">Penyelamatan Banjir & Kebakaran</span>
                                        </div>
                                        <a href="tel:994" className="px-3.5 py-1.5 rounded-xl font-bold bg-amber-600 text-white text-xs hover:bg-amber-500 transition-colors shrink-0">994</a>
                                    </div>

                                    <div className="p-3.5 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-between shadow-sm">
                                        <div>
                                            <span className="font-bold text-white block">Pertahanan Awam (APM)</span>
                                            <span className="text-[10px] text-zinc-400">Bantuan Skuad Bencana Banjir</span>
                                        </div>
                                        <a href="tel:991" className="px-3.5 py-1.5 rounded-xl font-bold bg-blue-600 text-white text-xs hover:bg-blue-500 transition-colors shrink-0">991</a>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
