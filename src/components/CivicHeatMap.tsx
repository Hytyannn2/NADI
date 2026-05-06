'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Map, X, Layers, AlertTriangle, Droplets, Construction, ShoppingBag, Loader2 } from 'lucide-react';
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
    volunteer: { color: '#F59E0B', label: 'Volunteer Tasks', icon: AlertTriangle },
    listing: { color: '#10B981', label: 'Niaga Listings', icon: ShoppingBag },
};

export default function CivicHeatMap({ onClose }: { onClose: () => void }) {
    const [loaded, setLoaded] = useState(false);
    const [filters, setFilters] = useState({ pothole: true, flood: true, volunteer: true, listing: true });
    const [userLat, setUserLat] = useState<number | null>(null);
    const [userLng, setUserLng] = useState<number | null>(null);
    const [points] = useState<HeatPoint[]>([]); // Real data would come from API aggregation

    useEffect(() => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setLoaded(true); },
                () => { setUserLat(3.139); setUserLng(101.686); setLoaded(true); },
                { enableHighAccuracy: true }
            );
        } else { setUserLat(3.139); setUserLng(101.686); setLoaded(true); }

        return () => { document.head.removeChild(link); };
    }, []);

    const toggleFilter = (type: keyof typeof filters) => {
        setFilters(prev => ({ ...prev, [type]: !prev[type] }));
    };

    const filteredPoints = points.filter(p => filters[p.type]);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col"
        >
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-[#0A0A0C]">
                <div className="flex items-center gap-2">
                    <Map className="w-5 h-5 text-[#C5A367]" />
                    <h3 className="text-sm font-bold text-white">Live Civic Heat Map</h3>
                </div>
                <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex gap-2 p-3 bg-[#0A0A0C] border-b border-zinc-800 overflow-x-auto no-scrollbar">
                {(Object.keys(TYPE_CONFIG) as (keyof typeof TYPE_CONFIG)[]).map(type => {
                    const cfg = TYPE_CONFIG[type];
                    const Icon = cfg.icon;
                    return (
                        <button key={type} onClick={() => toggleFilter(type)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest border whitespace-nowrap transition-all ${
                                filters[type] ? 'text-white' : 'border-zinc-800 text-zinc-600 opacity-50'
                            }`}
                            style={filters[type] ? { backgroundColor: cfg.color + '15', borderColor: cfg.color + '40' } : {}}
                        >
                            <Icon className="w-3 h-3" style={filters[type] ? { color: cfg.color } : {}} />
                            {cfg.label}
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
                                    <div className="text-xs font-medium">{point.label}</div>
                                    <div className="text-[10px] text-gray-500">Severity: {point.severity}/5</div>
                                </Popup>
                            </CircleMarker>
                        ))}
                    </MapContainer>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
                    </div>
                )}

                <div className="absolute bottom-4 left-4 bg-[#0A0A0C]/90 backdrop-blur-xl border border-zinc-800 rounded-2xl p-3 z-[500]">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Reports Near You</p>
                    <p className="text-lg font-light text-white">{filteredPoints.length} <span className="text-xs text-zinc-600">points</span></p>
                    {filteredPoints.length === 0 && (
                        <p className="text-[8px] text-zinc-600 mt-1">No civic reports in your area yet</p>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
