'use client';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Map, X, AlertTriangle, Droplets, Construction, Loader2, MapPin, Info } from 'lucide-react';
import dynamic from 'next/dynamic';

import { createClient } from '@/src/lib/supabase/client';

// Dynamic import to avoid SSR issues with Leaflet
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(m => m.CircleMarker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });

interface HeatPoint {
    lat: number; lng: number;
    type: 'pothole' | 'flood' | 'volunteer';
    label: string; severity: number;
}

const TYPE_CONFIG = {
    pothole: { color: '#EF4444', label: 'Potholes', icon: Construction },
    flood: { color: '#3B82F6', label: 'Flood Zones', icon: Droplets },
    volunteer: { color: '#F59E0B', label: 'Volunteer', icon: AlertTriangle },
};

// Default center (Bangi / UKM area) — map shows immediately
const DEFAULT_CENTER: [number, number] = [2.9181, 101.7712];

export default function CivicHeatMap({ onClose }: { onClose: () => void }) {
    const [filters, setFilters] = useState({ pothole: true, flood: true, volunteer: true });
    const [points, setPoints] = useState<HeatPoint[]>([]);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const mapRef = useRef<any>(null);
    const supabase = createClient();

    // Fetch detected potholes from localStorage and Supabase DB
    useEffect(() => {
        const loadHeatPoints = async () => {
            const heatPoints: HeatPoint[] = [];

            // 1. Load from localStorage (offline / persistent local detections)
            const savedLocal = localStorage.getItem('nadi_local_potholes');
            if (savedLocal) {
                try {
                    const localAnomalies = JSON.parse(savedLocal);
                    localAnomalies.forEach((a: any) => {
                        if (a.lat && a.lng && a.lat !== 0 && a.lng !== 0) {
                            heatPoints.push({
                                lat: parseFloat(a.lat),
                                lng: parseFloat(a.lng),
                                type: 'pothole',
                                label: `Pothole (${a.status || 'pending'}) - ${a.speedKmh || 0} km/h`,
                                severity: Math.min(5, Math.max(1, Math.round((a.zDropped || 4) / 1.5))),
                            });
                        }
                    });
                } catch (e) {
                    console.error("Error loading local potholes for map", e);
                }
            }

            // 2. Load from Supabase DB (nadi_infra_reports table)
            try {
                const { data } = await supabase.from('nadi_infra_reports').select('*').limit(100);
                if (data) {
                    data.forEach((d: any) => {
                        const lat = parseFloat(d.lat);
                        const lng = parseFloat(d.lng);
                        if (lat && lng && lat !== 0 && lng !== 0) {
                            const exists = heatPoints.some(p => Math.abs(p.lat - lat) < 0.0001 && Math.abs(p.lng - lng) < 0.0001);
                            if (!exists) {
                                heatPoints.push({
                                    lat,
                                    lng,
                                    type: 'pothole',
                                    label: `Pothole Report (${d.status})`,
                                    severity: Math.min(5, Math.max(1, Math.round((d.z_dropped || 4) / 1.5))),
                                });
                            }
                        }
                    });
                }
            } catch (e) {
                console.error("Error loading DB potholes for map", e);
            }

            setPoints(heatPoints);
        };

        loadHeatPoints();
    }, [supabase]);

    // Inject Leaflet CSS immediately
    useEffect(() => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        // Mark map as ready once CSS is injected
        setMapReady(true);

        // Try to get user location in the background — map renders regardless
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                    setUserLocation(loc);
                    // Pan the map if ref is available
                    if (mapRef.current) {
                        mapRef.current.flyTo(loc, 14, { duration: 1.5 });
                    }
                },
                () => {
                    // Geolocation denied — stay at default center, no mock data
                },
                { enableHighAccuracy: true }
            );
        }

        return () => { document.head.removeChild(link); };
    }, []);

    const toggleFilter = (type: keyof typeof filters) => {
        setFilters(prev => ({ ...prev, [type]: !prev[type] }));
    };

    const filteredPoints = points.filter(p => filters[p.type]);
    const countByType = (type: string) => points.filter(p => p.type === type).length;
    const totalReports = points.length;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col md:pl-64"
            style={{ background: 'var(--bg-main)' }}
        >
            <div className="flex items-center justify-between p-4" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-default)' }}>
                <div className="flex items-center gap-2">
                    <Map className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Live Civic Heat Map</h3>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl transition-colors" style={{ color: 'var(--text-muted)' }}>
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex gap-2 p-3 overflow-x-auto no-scrollbar" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-default)' }}>
                {(Object.keys(TYPE_CONFIG) as (keyof typeof TYPE_CONFIG)[]).map(type => {
                    const cfg = TYPE_CONFIG[type];
                    const Icon = cfg.icon;
                    const count = countByType(type);
                    return (
                        <button key={type} onClick={() => toggleFilter(type)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide border whitespace-nowrap transition-all"
                            style={filters[type]
                                ? { backgroundColor: cfg.color + '15', borderColor: cfg.color + '40', color: 'var(--text-primary)' }
                                : { borderColor: 'var(--border-default)', color: 'var(--text-muted)', opacity: 0.5 }
                            }
                        >
                            <Icon className="w-3 h-3" style={filters[type] ? { color: cfg.color } : {}} />
                            {cfg.label} <span className="ml-0.5 opacity-60">{count}</span>
                        </button>
                    );
                })}
            </div>

            <div className="flex-1 relative">
                {mapReady ? (
                    <MapContainer
                        center={DEFAULT_CENTER}
                        zoom={14}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                        ref={mapRef}
                        whenReady={() => {
                            // If user location already resolved, fly to it
                            if (userLocation && mapRef.current) {
                                mapRef.current.flyTo(userLocation, 14, { duration: 1.5 });
                            }
                        }}
                    >
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://carto.com/">CARTO</a>' />
                        {filteredPoints.map((point, i) => (
                            <CircleMarker key={i} center={[point.lat, point.lng]} radius={point.severity * 6}
                                pathOptions={{ color: TYPE_CONFIG[point.type].color, fillColor: TYPE_CONFIG[point.type].color, fillOpacity: 0.4, weight: 2 }}>
                                <Popup>
                                    <div className="text-xs font-semibold">{point.label}</div>
                                    <div className="text-[10px] opacity-60 mt-0.5">Severity: {'●'.repeat(point.severity)}{'○'.repeat(5 - point.severity)}</div>
                                </Popup>
                            </CircleMarker>
                        ))}

                        {/* User location marker */}
                        {userLocation && (
                            <CircleMarker center={userLocation} radius={8}
                                pathOptions={{ color: '#6366F1', fillColor: '#6366F1', fillOpacity: 0.7, weight: 3 }}>
                                <Popup>
                                    <div className="text-xs font-semibold"> Your Location</div>
                                </Popup>
                            </CircleMarker>
                        )}
                    </MapContainer>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--text-muted)' }} />
                    </div>
                )}

                {/* Info overlay */}
                <div className="absolute bottom-4 left-4 right-4 md:left-auto md:w-[360px] md:right-6 rounded-2xl p-4 z-[500] backdrop-blur-xl shadow-2xl"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                >
                    {totalReports > 0 ? (
                        <>
                            <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Reports Near You</p>
                            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                {filteredPoints.length} <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>points</span>
                            </p>
                            <div className="flex gap-3 mt-2">
                                {(Object.keys(TYPE_CONFIG) as (keyof typeof TYPE_CONFIG)[]).map(type => {
                                    const cfg = TYPE_CONFIG[type];
                                    const count = filteredPoints.filter(p => p.type === type).length;
                                    if (count === 0) return null;
                                    return (
                                        <span key={type} className="text-[10px] font-bold flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full inline-block" style={{ background: cfg.color }} />
                                            {count}
                                        </span>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-muted)' }}>
                                <Info className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                            </div>
                            <div>
                                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>No reports yet</p>
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                    Submit civic reports via Suara or Infra to see them here.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
