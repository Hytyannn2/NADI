'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Map, X, Layers, AlertTriangle, Droplets, Construction, ShoppingBag, Loader2, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with Leaflet
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(m => m.CircleMarker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });

interface HeatPoint {
    lat: number; lng: number;
    type: 'pothole' | 'flood' | 'volunteer' | 'listing';
    label: string; severity: number;
}

const TYPE_CONFIG = {
    pothole: { color: '#EF4444', label: 'Potholes', icon: Construction },
    flood: { color: '#3B82F6', label: 'Flood Zones', icon: Droplets },
    volunteer: { color: '#F59E0B', label: 'Volunteer', icon: AlertTriangle },
    listing: { color: '#10B981', label: 'Niaga', icon: ShoppingBag },
};

// Generate realistic civic data points around a user's location
function generateLocalPoints(lat: number, lng: number): HeatPoint[] {
    const points: HeatPoint[] = [];

    // Pothole hotspots — common in Malaysian roads
    const potholeAreas = [
        { offset: [0.008, 0.005], label: 'Jalan utama — lubang besar', sev: 4 },
        { offset: [-0.003, 0.012], label: 'Simpang empat — permukaan rosak', sev: 3 },
        { offset: [0.015, -0.008], label: 'Lorong belakang — jalan pecah', sev: 2 },
        { offset: [-0.01, -0.006], label: 'Depan sekolah — lubang sederhana', sev: 3 },
        { offset: [0.005, 0.018], label: 'Kawasan industri — jalan retak', sev: 4 },
        { offset: [-0.012, 0.009], label: 'Taman perumahan — longkang rosak', sev: 2 },
        { offset: [0.02, 0.003], label: 'Jalan kampung — lubang kecil', sev: 1 },
    ];

    // Flood-prone zones
    const floodZones = [
        { offset: [0.006, -0.015], label: 'Kawasan rendah — risiko banjir kilat', sev: 4 },
        { offset: [-0.008, 0.02], label: 'Tebing sungai — paras air tinggi', sev: 5 },
        { offset: [0.012, 0.01], label: 'Bawah jambatan — air bertakung', sev: 3 },
        { offset: [-0.018, -0.004], label: 'Taman — saliran tersumbat', sev: 2 },
        { offset: [0.003, -0.022], label: 'Padang — tanah lembap', sev: 2 },
    ];

    // Volunteer activity locations
    const volLocations = [
        { offset: [0.01, 0.008], label: 'Gotong-royong pembersihan — Sabtu', sev: 3 },
        { offset: [-0.005, -0.012], label: 'Bantuan makanan komuniti', sev: 4 },
        { offset: [0.018, -0.005], label: 'Kelas tuisyen percuma — setiap minggu', sev: 2 },
        { offset: [-0.015, 0.015], label: 'Lawatan rumah warga emas', sev: 3 },
    ];

    // Niaga listings
    const niagaListings = [
        { offset: [0.004, 0.006], label: 'Ikan segar — RM15/kg', sev: 3 },
        { offset: [-0.007, -0.003], label: 'Sayur organik — RM5/ikat', sev: 2 },
        { offset: [0.009, -0.01], label: 'Telur ayam kampung — RM1.20/biji', sev: 2 },
        { offset: [-0.002, 0.014], label: 'Beras tempatan 10kg — RM32', sev: 3 },
        { offset: [0.013, 0.002], label: 'Kuih-muih — dari RM2', sev: 1 },
    ];

    potholeAreas.forEach(p => points.push({
        lat: lat + p.offset[0], lng: lng + p.offset[1],
        type: 'pothole', label: p.label, severity: p.sev,
    }));
    floodZones.forEach(p => points.push({
        lat: lat + p.offset[0], lng: lng + p.offset[1],
        type: 'flood', label: p.label, severity: p.sev,
    }));
    volLocations.forEach(p => points.push({
        lat: lat + p.offset[0], lng: lng + p.offset[1],
        type: 'volunteer', label: p.label, severity: p.sev,
    }));
    niagaListings.forEach(p => points.push({
        lat: lat + p.offset[0], lng: lng + p.offset[1],
        type: 'listing', label: p.label, severity: p.sev,
    }));

    return points;
}

export default function CivicHeatMap({ onClose }: { onClose: () => void }) {
    const [loaded, setLoaded] = useState(false);
    const [filters, setFilters] = useState({ pothole: true, flood: true, volunteer: true, listing: true });
    const [userLat, setUserLat] = useState<number | null>(null);
    const [userLng, setUserLng] = useState<number | null>(null);
    const [points, setPoints] = useState<HeatPoint[]>([]);

    useEffect(() => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    setUserLat(lat);
                    setUserLng(lng);
                    setPoints(generateLocalPoints(lat, lng));
                    setLoaded(true);
                },
                () => {
                    // Default to Bangi
                    setUserLat(2.9181);
                    setUserLng(101.7712);
                    setPoints(generateLocalPoints(2.9181, 101.7712));
                    setLoaded(true);
                },
                { enableHighAccuracy: true }
            );
        } else {
            setUserLat(2.9181);
            setUserLng(101.7712);
            setPoints(generateLocalPoints(2.9181, 101.7712));
            setLoaded(true);
        }

        return () => { document.head.removeChild(link); };
    }, []);

    const toggleFilter = (type: keyof typeof filters) => {
        setFilters(prev => ({ ...prev, [type]: !prev[type] }));
    };

    const filteredPoints = points.filter(p => filters[p.type]);

    // Count per type
    const countByType = (type: string) => points.filter(p => p.type === type).length;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col"
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
                {loaded && userLat !== null && userLng !== null ? (
                    <MapContainer center={[userLat, userLng]} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
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
                    </MapContainer>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--text-muted)' }} />
                    </div>
                )}

                <div className="absolute bottom-4 left-4 rounded-2xl p-4 z-[500] backdrop-blur-xl"
                    style={{ background: 'var(--bg-card-translucent, rgba(255,255,255,0.92))', border: '1px solid var(--border-default)' }}
                >
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
                </div>
            </div>
        </motion.div>
    );
}
