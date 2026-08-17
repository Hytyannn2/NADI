'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Map,
  X,
  AlertTriangle,
  Droplets,
  Construction,
  Loader2,
  MapPin,
  Info,
  Home,
  Radio,
  Store,
  Navigation,
  ZoomIn,
  Search,
  Crosshair,
  Compass,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  Car,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

import { createClient } from '@/src/lib/supabase/client';
import { useWeather } from '@/src/hooks/useWeather';
import { useLanguage } from '@/src/context/LanguageContext';
import { ALL_KELANTAN_PPS_CENTERS, JAJAHAN_CENTER_COORDS, SUBDISTRICT_COORDS } from '@/src/data/kelantanPpsCenters';

// Dynamic import to avoid SSR issues with Leaflet
const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then((m) => m.CircleMarker), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then((m) => m.Circle), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });

export type HeatType = 'pothole' | 'flood' | 'volunteer' | 'pps' | 'sensor' | 'vendor';

interface HeatPoint {
  lat: number;
  lng: number;
  type: HeatType;
  label: string;
  sublabel?: string;
  severity: number;
}

interface ClusterPoint {
  id: string;
  isCluster: boolean;
  lat: number;
  lng: number;
  count: number;
  points: HeatPoint[];
  type: HeatType;
  radius?: number; // pixel radius for union-merged bounding blobs
  label?: string;
  sublabel?: string;
  severity?: number;
}

const TYPE_CONFIG: Record<
  HeatType,
  { color: string; labelMs: string; labelEn: string; icon: any }
> = {
  pothole: { color: '#EF4444', labelMs: 'Jalan Berlubang', labelEn: 'Potholes', icon: Construction },
  flood: { color: '#3B82F6', labelMs: 'Zon Banjir', labelEn: 'Flood Zones', icon: Droplets },
  volunteer: { color: '#F59E0B', labelMs: 'Misi Sukarelawan', labelEn: 'Volunteer Jobs', icon: AlertTriangle },
  pps: { color: '#10B981', labelMs: 'Pusat Pemindahan (PPS)', labelEn: 'PPS Shelters', icon: Home },
  sensor: { color: '#8B5CF6', labelMs: 'Pengesan Sungai', labelEn: 'River Sensors', icon: Radio },
  vendor: { color: '#EC4899', labelMs: 'Perniagaan Komuniti', labelEn: 'Local Businesses', icon: Store },
};

// Default center (Kota Bharu, Kelantan)
const DEFAULT_CENTER: [number, number] = [6.1256, 102.2386];

// Web Mercator pixel projection at given zoom (256px tile standard)
function projectLatLonToPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = 256 * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const phi = (clampedLat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2) * scale;
  return { x, y };
}

// Inverse Web Mercator projection from pixels back to lat/lng at given zoom
function unprojectPixelToLatLon(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const scale = 256 * Math.pow(2, zoom);
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (Math.atan(Math.sinh(n)) * 180) / Math.PI;
  return { lat, lng };
}

// Bounding-Circle Union Merge Pass: Merges any overlapping circles tip-to-tip across all zoom levels
function runUnionMergePass(items: ClusterPoint[], zoom: number): ClusterPoint[] {
  let currentList: (ClusterPoint & { radius: number })[] = items.map((it) => ({
    ...it,
    radius: it.radius ?? (it.isCluster ? (Math.min(72, Math.max(38, Math.round(32 + Math.log2(it.count) * 6))) / 2) : (it.type === 'sensor' ? 14 : 11)),
  }));

  let changed = true;
  let passes = 0;

  while (changed && passes < 10) {
    changed = false;
    passes++;
    const nextList: (ClusterPoint & { radius: number })[] = [];

    for (let i = 0; i < currentList.length; i++) {
      const item = currentList[i];
      let merged = false;
      const cA = projectLatLonToPixel(item.lat, item.lng, zoom);
      const rA = item.radius || 11;

      for (let j = 0; j < nextList.length; j++) {
        const existing = nextList[j];
        const cB = projectLatLonToPixel(existing.lat, existing.lng, zoom);
        const rB = existing.radius || 11;

        const dx = cB.x - cA.x;
        const dy = cB.y - cA.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Merge test: pixel distance between centers < rA + rB (+ 1px epsilon)
        if (dist < rA + rB + 1.0) {
          // Calculate Merged Radius R = (dist + rA + rB) / 2 (tip-to-tip diameter span)
          let mergedR = (dist + rA + rB) / 2;
          mergedR = Math.min(90, Math.max(rA, rB, mergedR)); // Cap at 90px so one blob never eats the city

          // Calculate Merged Center C = (cA + cB)/2 + u * (rB - rA)/2 (Midpoint of outer tips)
          let cx: number;
          let cy: number;
          if (dist > 0.001) {
            const ux = dx / dist;
            const uy = dy / dist;
            cx = (cA.x + cB.x) / 2 + (ux * (rB - rA)) / 2;
            cy = (cA.y + cB.y) / 2 + (uy * (rB - rA)) / 2;
          } else {
            cx = cA.x;
            cy = cA.y;
            mergedR = Math.min(90, Math.max(rA, rB) + 1.5);
          }

          const newCenter = unprojectPixelToLatLon(cx, cy, zoom);
          const unionPoints = [...existing.points, ...item.points];
          const totalCount = existing.count + item.count;

          // Dominant type for color styling
          const counts: Record<string, number> = {};
          unionPoints.forEach((p) => {
            counts[p.type] = (counts[p.type] || 0) + 1;
          });
          const dominantType = (Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || existing.type) as HeatType;

          existing.lat = newCenter.lat;
          existing.lng = newCenter.lng;
          existing.radius = mergedR;
          existing.count = totalCount;
          existing.points = unionPoints;
          existing.type = dominantType;
          existing.isCluster = true;
          existing.id = `union-${existing.lat.toFixed(5)}-${existing.lng.toFixed(5)}-${totalCount}`;

          merged = true;
          changed = true;
          break;
        }
      }

      if (!merged) {
        nextList.push({ ...item });
      }
    }

    currentList = nextList;
  }

  return currentList;
}

// Major Flood Risk Corridor Zones (hydro-geological centroids of Kelantan river basins)
const FALLBACK_FLOOD_ZONES: { name: string; center: [number, number]; radius: number }[] = [
  { name: 'Cekungan Sungai Kelantan (Kota Bharu)', center: [6.1200, 102.2250], radius: 3200 },
  { name: 'Zon Limpahan Rantau Panjang (Sungai Golok)', center: [6.0212, 101.9741], radius: 4000 },
  { name: 'Zon Banjir Pasir Mas (Limpahan Sungai)', center: [6.0425, 102.1450], radius: 3500 },
  { name: 'Lembangan Sungai Kuala Krai', center: [5.5347, 102.1975], radius: 4500 },
];

// Static fallback Merchants across Kelantan
const FALLBACK_VENDORS = [
  { name: 'Warung Nasi Ulam Cikgu', category: 'Makanan & Minuman', lat: 6.1280, lng: 102.2370, district: 'Kota Bharu' },
  { name: 'Kedai Runcit Pak Mat', category: 'Runcit & Bekalan', lat: 6.0450, lng: 102.1410, district: 'Pasir Mas' },
  { name: 'Batik Canting Kak Jah', category: 'Kraf Tangan', lat: 6.1220, lng: 102.2410, district: 'Kota Bharu' },
  { name: 'Kedai Serbaneka Pasar Siti Khadijah', category: 'Bekalan Makanan', lat: 6.1305, lng: 102.2388, district: 'Kota Bharu' },
  { name: 'Depot Tabung Gas Pasir Puteh', category: 'Bekalan Asas', lat: 5.8340, lng: 102.4010, district: 'Pasir Puteh' },
];

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

// Calculate dynamic spatial grid size in degrees based on floating zoom level
function getGridSizeForZoom(zoom: number): number {
  if (zoom <= 10.5) return 0.28;    // Statewide view: 1-2 huge circles
  if (zoom <= 11.8) return 0.14;    // Regional view: ~14km grid
  if (zoom <= 12.8) return 0.065;   // Town view: ~6.5km grid
  if (zoom <= 13.8) return 0.028;   // Sub-district view: ~2.8km grid
  if (zoom <= 14.8) return 0.012;   // Neighborhood view: ~1.2km grid
  if (zoom <= 15.8) return 0.005;   // Street block view: ~500m grid
  return 0;                         // Deep street view (zoom > 15.8): Individual street pins
}

// Create custom Leaflet HTML DivIcon with glowing translucent glassmorphism circle & count inside
const createClusterIcon = (count: number, color: string, diameter?: number) => {
  if (typeof window === 'undefined') return undefined;
  try {
    const L = require('leaflet');
    const size = Math.min(180, Math.max(26, Math.round(diameter ?? (32 + Math.log2(count) * 6))));
    const fontSize = size >= 48 ? 14 : (size >= 32 ? 12 : 10);
    return L.divIcon({
      html: `<div style="
        background-color: ${color}45;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 2.5px solid ${color};
        box-shadow: 0 0 20px ${color}88, inset 0 0 12px ${color}44, 0 8px 24px rgba(0,0,0,0.6);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        color: #ffffff;
        font-weight: 900;
        font-size: ${fontSize}px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: system-ui, -apple-system, sans-serif;
        cursor: pointer;
        text-shadow: 0 1px 3px rgba(0,0,0,0.8);
      ">${count}</div>`,
      className: 'nadi-translucent-cluster-badge',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  } catch {
    return undefined;
  }
};

// Fixed Map event listener component (Stores active map instance & updates state safely on zoom/move)
function MapEventsController({
  onMapInit,
  onMapChange,
}: {
  onMapInit: (map: any) => void;
  onMapChange: (zoom: number, bounds: any) => void;
}) {
  const { useMapEvents } = require('react-leaflet');

  const safeUpdateState = useCallback(() => {
    try {
      if (map && map._loaded && typeof map.getZoom === 'function' && typeof map.getBounds === 'function') {
        const z = map.getZoom();
        const b = map.getBounds();
        if (z !== undefined && b && b.getSouthWest) {
          onMapChange(z, b);
        }
      }
    } catch {}
  }, [onMapChange]);

  const map = useMapEvents({
    zoomend: safeUpdateState,
    moveend: safeUpdateState,
  });

  useEffect(() => {
    if (map) {
      try {
        onMapInit(map);
      } catch {}
      safeUpdateState();

      const timer = setTimeout(() => {
        try {
          if (map && map.invalidateSize) map.invalidateSize();
          safeUpdateState();
        } catch {}
      }, 150);

      return () => {
        clearTimeout(timer);
        try {
          onMapInit(null);
        } catch {}
      };
    }
  }, [map, onMapInit, safeUpdateState]);

  return null;
}

export default function CivicHeatMap({ onClose }: { onClose: () => void }) {
  const { lang } = useLanguage();
  const isMs = lang === 'ms';
  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState<Record<HeatType, boolean>>({
    pothole: true,
    flood: true,
    volunteer: true,
    pps: true,
    sensor: true,
    vendor: true,
  });
  const [radiusFilter, setRadiusFilter] = useState<'all' | 2 | 5 | 10>('all');
  const [points, setPoints] = useState<HeatPoint[]>([]);
  const [floodZones, setFloodZones] = useState<{ name: string; center: [number, number]; radius: number }[]>(FALLBACK_FLOOD_ZONES);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [liveSensorData, setLiveSensorData] = useState<any>({ water_level: 1.74, is_online: true });
  const [zoomLevel, setZoomLevel] = useState<number>(13);
  const [mapBounds, setMapBounds] = useState<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [activeMap, setActiveMap] = useState<any>(null);
  const supabase = useMemo(() => createClient(), []);

  const { userLat, userLng } = useWeather();
  const mapInstanceKey = useMemo(() => `nadi-map-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync exact user GPS coordinates from useWeather hook
  useEffect(() => {
    if (userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)) {
      const loc: [number, number] = [userLat, userLng];
      setUserLocation(loc);
      if (activeMap) {
        try {
          activeMap.flyTo(loc, 13, { duration: 1.5 });
        } catch {}
      }
    }
  }, [userLat, userLng, activeMap]);

  // Fetch real flood risk zones from Supabase nadi_bencana_zones if available
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const { data } = await supabase.from('nadi_bencana_zones').select('*');
        if (data && data.length > 0) {
          const mapped = data.map((z: any) => ({
            name: z.zone_name || z.name || 'Zon Risiko Banjir',
            center: [z.latitude || 6.1200, z.longitude || 102.2250] as [number, number],
            radius: z.radius_meters || 3200,
          }));
          setFloodZones(mapped);
        }
      } catch (err) {
        console.warn('[CivicHeatMap] Flood zones fetch notice:', err);
      }
    };
    fetchZones();
  }, [supabase]);

  // Fetch & poll live sensor telemetry from DB
  useEffect(() => {
    const fetchSensor = async () => {
      try {
        const { data } = await supabase
          .from('nadi_bencana_sensors')
          .select('*')
          .eq('name', 'Sungai Kelantan Node A')
          .single();
        if (data && data.water_level !== null && data.water_level !== undefined) {
          setLiveSensorData(data);
        }
      } catch (err) {
        console.warn('[CivicHeatMap] Sensor fetch notice:', err);
      }
    };

    fetchSensor();
    const interval = setInterval(fetchSensor, 5000);
    return () => clearInterval(interval);
  }, [supabase]);

  // Search Location Handler (Town / Subdistrict / Jajahan)
  const handleSearchInput = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchSuggestions([]);
      return;
    }
    const q = query.toUpperCase();
    const matches: { name: string; lat: number; lng: number }[] = [];

    // Search Jajahan
    Object.entries(JAJAHAN_CENTER_COORDS).forEach(([jajahan, coords]) => {
      if (jajahan.toUpperCase().includes(q)) {
        matches.push({ name: `Jajahan ${jajahan}`, lat: coords.lat, lng: coords.lng });
      }
    });

    // Search Towns / Subdistricts
    Object.entries(SUBDISTRICT_COORDS).forEach(([town, coords]) => {
      if (town.toUpperCase().includes(q)) {
        matches.push({ name: town, lat: coords.lat, lng: coords.lng });
      }
    });

    setSearchSuggestions(matches.slice(0, 5));
  };

  const handleSelectLocation = (lat: number, lng: number) => {
    if (activeMap) {
      try {
        activeMap.flyTo([lat, lng], 14, { duration: 1.2 });
      } catch {}
    }
    setSearchQuery('');
    setSearchSuggestions([]);
  };

  // Fetch all 6 live civic & disaster data streams
  const loadHeatPoints = useCallback(async () => {
    const heatPoints: HeatPoint[] = [];

    // 1. Potholes from localStorage
    const savedLocal = localStorage.getItem('nadi_local_potholes');
    if (savedLocal) {
      try {
        const parsed = JSON.parse(savedLocal);
        parsed.forEach((p: any) => {
          heatPoints.push({
            lat: p.lat,
            lng: p.lng,
            type: 'pothole',
            label: p.label || (isMs ? 'Jalan Berlubang Dikesan' : 'Detected Pothole'),
            sublabel: 'On-device AI Vision',
            severity: p.severity || 3,
          });
        });
      } catch {}
    }

    // 2. Infra Reports (Potholes & Floods) from Supabase
    try {
      const { data: infraData } = await supabase
        .from('nadi_infra_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (infraData) {
        infraData.forEach((r: any) => {
          const lat = r.latitude || r.lat;
          const lng = r.longitude || r.lng;
          if (lat && lng) {
            const reportType = (r.issue_type === 'flood' || r.ai_analysis?.type === 'flood') ? 'flood' : 'pothole';
            heatPoints.push({
              lat: Number(lat),
              lng: Number(lng),
              type: reportType,
              label: r.title || r.ai_analysis?.summary || (isMs ? 'Laporan Awam' : 'Civic Report'),
              sublabel: r.issue_type || r.status || '',
              severity: Number(r.severity || r.ai_analysis?.severity || 3),
            });
          }
        });
      }
    } catch (err) {
      console.warn('[CivicHeatMap] Infra reports fetch notice:', err);
    }

    // 3. Volunteer Jobs from Supabase
    try {
      const { data: jobsData } = await supabase
        .from('nadi_bencana_jobs')
        .select('*')
        .limit(50);

      if (jobsData) {
        jobsData.forEach((j: any) => {
          const lat = j.latitude || j.lat;
          const lng = j.longitude || j.lng;
          if (lat && lng) {
            heatPoints.push({
              lat: Number(lat),
              lng: Number(lng),
              type: 'volunteer',
              label: j.title || j.name || (isMs ? 'Misi Sukarelawan' : 'Volunteer Task'),
              sublabel: j.district || j.dist || j.area || '',
              severity: 4,
            });
          }
        });
      }
    } catch (err) {
      console.warn('[CivicHeatMap] Volunteer jobs fetch notice:', err);
    }

    // 4. Official PPS Evacuation Centers (All 600+ Real Kelantan Centers)
    try {
      const { data: ppsData } = await supabase.from('nadi_bencana_centers').select('*').limit(200);
      if (ppsData && ppsData.length > 0) {
        ppsData.forEach((center) => {
          if (center.latitude && center.longitude) {
            heatPoints.push({
              lat: center.latitude,
              lng: center.longitude,
              type: 'pps',
              label: center.name,
              sublabel: `${center.district} · ${center.type}`,
              severity: center.capacity > 400 ? 3 : 2,
            });
          }
        });
      } else {
        ALL_KELANTAN_PPS_CENTERS.forEach((center, idx) => {
          heatPoints.push({
            lat: center.lat,
            lng: center.lng,
            type: 'pps',
            label: center.name,
            sublabel: `${center.jajahan} · ${center.type}`,
            severity: center.capacity > 400 || idx % 4 === 0 ? 3 : 2,
          });
        });
      }
    } catch {
      ALL_KELANTAN_PPS_CENTERS.forEach((center, idx) => {
        heatPoints.push({
          lat: center.lat,
          lng: center.lng,
          type: 'pps',
          label: center.name,
          sublabel: `${center.jajahan} · ${center.type}`,
          severity: center.capacity > 400 || idx % 4 === 0 ? 3 : 2,
        });
      });
    }

    // 5. River Water Sensor Hardware Nodes (Loaded from DB or User GPS Position)
    try {
      const { data: sensorNodes } = await supabase.from('nadi_bencana_sensors').select('*');
      if (sensorNodes && sensorNodes.length > 0) {
        sensorNodes.forEach((node) => {
          const sLat = node.latitude || (userLat ? userLat + 0.002 : 6.1256);
          const sLng = node.longitude || (userLng ? userLng + 0.002 : 102.2386);
          heatPoints.push({
            lat: sLat,
            lng: sLng,
            type: 'sensor',
            label: node.name || 'Sungai Kelantan Node A',
            sublabel: `Ultrasonic Sonar Telemetry · ${node.status || 'Active'}`,
            severity: 5,
          });
        });
      } else {
        const sLat = userLat ? userLat + 0.002 : 6.1256;
        const sLng = userLng ? userLng + 0.002 : 102.2386;
        heatPoints.push({
          lat: sLat,
          lng: sLng,
          type: 'sensor',
          label: 'Sungai Kelantan Node A',
          sublabel: 'Ultrasonic Sonar Telemetry · Kota Bharu',
          severity: 5,
        });
      }
    } catch {
      const sLat = userLat ? userLat + 0.002 : 6.1256;
      const sLng = userLng ? userLng + 0.002 : 102.2386;
      heatPoints.push({
        lat: sLat,
        lng: sLng,
        type: 'sensor',
        label: 'Sungai Kelantan Node A',
        sublabel: 'Ultrasonic Sonar Telemetry · Kota Bharu',
        severity: 5,
      });
    }

    // 6. Community Merchants / B40 Businesses (Supabase or Fallback)
    try {
      const { data: vendorData } = await supabase.from('nadi_vendors').select('*').limit(50);
      if (vendorData && vendorData.length > 0) {
        vendorData.forEach((v) => {
          if (v.latitude && v.longitude) {
            heatPoints.push({
              lat: v.latitude,
              lng: v.longitude,
              type: 'vendor',
              label: v.name,
              sublabel: v.category || (isMs ? 'Perniagaan Komuniti' : 'Local Business'),
              severity: 1,
            });
          }
        });
      } else {
        FALLBACK_VENDORS.forEach((v) => {
          heatPoints.push({
            lat: v.lat,
            lng: v.lng,
            type: 'vendor',
            label: v.name,
            sublabel: v.category,
            severity: 1,
          });
        });
      }
    } catch {
      FALLBACK_VENDORS.forEach((v) => {
        heatPoints.push({
          lat: v.lat,
          lng: v.lng,
          type: 'vendor',
          label: v.name,
          sublabel: v.category,
          severity: 1,
        });
      });
    }

    setPoints(heatPoints);
  }, [supabase, isMs, userLat, userLng]);

  useEffect(() => {
    loadHeatPoints();
  }, [loadHeatPoints]);

  // Real-time Supabase updates listener
  useEffect(() => {
    const channel = supabase
      .channel('heatmap_realtime_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'nadi_infra_reports' }, () => {
        console.log('⚡ [CivicHeatMap] Live infra report detected — updating map points');
        loadHeatPoints();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'nadi_bencana_jobs' }, () => {
        console.log('⚡ [CivicHeatMap] Live volunteer mission detected — updating map points');
        loadHeatPoints();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadHeatPoints]);

  useEffect(() => {
    setMapReady(true);
  }, []);

  const toggleFilter = (type: HeatType) => {
    setFilters((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  // Real Dynamic Spatial Grid Clustering + Bounding-Circle Union Merge Engine
  const clusterPoints = useMemo<ClusterPoint[]>(() => {
    // 1. Filter base points by layer chip filter & radius filter & viewport bounds
    const basePoints = points.filter((p) => {
      if (!filters[p.type]) return false;
      if (radiusFilter !== 'all' && userLocation) {
        const dist = getDistanceKm(userLocation[0], userLocation[1], p.lat, p.lng);
        if (dist > radiusFilter) return false;
      }
      if (mapBounds) {
        try {
          if (!mapBounds.contains([p.lat, p.lng])) return false;
        } catch {}
      }
      return true;
    });

    const gridSize = getGridSizeForZoom(zoomLevel);
    let initialItems: ClusterPoint[] = [];

    // 2. Deep zoom (zoomLevel > 15.8): Start with individual points
    if (gridSize === 0) {
      initialItems = basePoints.map((p, idx) => ({
        id: `p-${idx}-${p.lat}-${p.lng}`,
        isCluster: false,
        lat: p.lat,
        lng: p.lng,
        count: 1,
        points: [p],
        type: p.type,
        label: p.label,
        sublabel: p.sublabel,
        severity: p.severity,
        radius: p.type === 'sensor' ? 14 : 11,
      }));
    } else {
      // 3. Otherwise, initial spatial grid grouping
      const gridMap: Record<string, HeatPoint[]> = {};
      basePoints.forEach((p) => {
        const key = `${Math.floor(p.lat / gridSize)}_${Math.floor(p.lng / gridSize)}`;
        if (!gridMap[key]) gridMap[key] = [];
        gridMap[key].push(p);
      });

      Object.entries(gridMap).forEach(([key, group], idx) => {
        if (group.length === 1) {
          const p = group[0];
          initialItems.push({
            id: `single-${key}-${idx}`,
            isCluster: false,
            lat: p.lat,
            lng: p.lng,
            count: 1,
            points: [p],
            type: p.type,
            label: p.label,
            sublabel: p.sublabel,
            severity: p.severity,
            radius: p.type === 'sensor' ? 14 : 11,
          });
        } else {
          const avgLat = group.reduce((sum, item) => sum + item.lat, 0) / group.length;
          const avgLng = group.reduce((sum, item) => sum + item.lng, 0) / group.length;
          const counts: Record<string, number> = {};
          group.forEach((item) => {
            counts[item.type] = (counts[item.type] || 0) + 1;
          });
          const dominantType = (Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || 'pps') as HeatType;
          const initialRadius = Math.min(45, Math.max(19, Math.round(16 + Math.log2(group.length) * 3)));

          initialItems.push({
            id: `cluster-${key}-${idx}`,
            isCluster: true,
            lat: avgLat,
            lng: avgLng,
            count: group.length,
            points: group,
            type: dominantType,
            radius: initialRadius,
          });
        }
      });
    }

    // 4. Bounding-Circle Union Merge Pass: Merges any overlapping circles tip-to-tip across ALL zooms!
    return runUnionMergePass(initialItems, zoomLevel);
  }, [points, filters, radiusFilter, userLocation, zoomLevel, mapBounds]);

  const countByType = (type: HeatType) => points.filter((p) => p.type === type).length;

  const handleMapChange = useCallback((z: number, b: any) => {
    setZoomLevel(z);
    setMapBounds(b);
  }, []);

  const handleZoomCluster = useCallback((lat: number, lng: number) => {
    if (activeMap) {
      try {
        activeMap.flyTo([lat, lng], Math.min(16, zoomLevel + 2.5), { duration: 0.8 });
      } catch {}
    }
  }, [activeMap, zoomLevel]);

  const modalContent = (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[99999] flex flex-col bg-[#09090b] text-white overflow-hidden"
    >
      {/* Top Header Navigation & Search Bar (Mobile Ultra-Compact Single Row) */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-6 sm:py-3 bg-zinc-900/95 border-b border-zinc-800 shadow-xl backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Map className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-base font-bold text-white tracking-wide leading-none">
              {isMs ? 'Peta Aduan' : 'Heat Map'}
            </h3>
            <p className="hidden sm:block text-[11px] text-zinc-400 mt-0.5">
              {isMs ? 'Kerosakan Jalan, Banjir, Sukarelawan & PPS' : 'Potholes, Flood Risk, Volunteers & PPS'}
            </p>
          </div>
        </div>

        {/* Live Location Search Bar */}
        <div className="relative flex-1 max-w-[200px] sm:max-w-sm">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800/90 border border-zinc-700/80 focus-within:border-blue-500 transition-colors">
            <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder={isMs ? 'Cari Lokasi...' : 'Search...'}
              className="bg-transparent text-xs text-white placeholder-zinc-400 focus:outline-none w-full"
            />
            {searchQuery && (
              <button onClick={() => handleSearchInput('')} className="text-zinc-400 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Search Autocomplete Suggestions */}
          <AnimatePresence>
            {searchSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700/90 rounded-xl shadow-2xl overflow-hidden z-[1000]"
              >
                {searchSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectLocation(item.lat, item.lng)}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-blue-600/30 hover:text-white transition-colors border-b border-zinc-800/60 last:border-none flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      {item.name}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">GPS</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mobile Filter Toggle Button */}
          <button
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className="sm:hidden p-2 rounded-xl bg-zinc-800 text-zinc-300 border border-zinc-700 active:scale-95"
            title={isMs ? 'Tapis Lapisan' : 'Filter Layers'}
          >
            <SlidersHorizontal className="w-4 h-4 text-blue-400" />
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all border border-zinc-700/80 active:scale-95"
            aria-label={isMs ? 'Tutup Peta Haba' : 'Close Heat Map'}
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Fast District Jump Pills Toolbar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1.5 px-3 bg-zinc-900/90 border-b border-zinc-800/80 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 shrink-0 mr-1">
          {isMs ? 'Jajahan:' : 'District:'}
        </span>
        {Object.entries(JAJAHAN_CENTER_COORDS).map(([jajahan, coords]) => (
          <button
            key={jajahan}
            onClick={() => handleSelectLocation(coords.lat, coords.lng)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-zinc-300 bg-zinc-800/80 hover:bg-blue-600/30 hover:text-blue-300 border border-zinc-700/80 transition-all whitespace-nowrap active:scale-95 shrink-0 shadow-sm"
          >
            {jajahan}
          </button>
        ))}
      </div>

      {/* Desktop Filter Toolbar / Mobile Expandable Drawer */}
      <div className={`${mobileFiltersOpen ? 'block' : 'hidden sm:block'} px-3 py-2 sm:px-6 sm:py-2.5 bg-zinc-900/95 border-b border-zinc-800/80 transition-all shrink-0`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Layer Filters (Horizontal Scroll on Mobile, Flex Wrap on Desktop) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-1">
            {(Object.keys(TYPE_CONFIG) as HeatType[]).map((type) => {
              const cfg = TYPE_CONFIG[type];
              const Icon = cfg.icon;
              const count = countByType(type);
              const label = isMs ? cfg.labelMs : cfg.labelEn;
              const active = filters[type];
              return (
                <button
                  key={type}
                  onClick={() => toggleFilter(type)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap transition-all shadow-sm active:scale-95 shrink-0"
                  style={
                    active
                      ? { backgroundColor: cfg.color + '20', borderColor: cfg.color + '50', color: '#fff' }
                      : { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: '#71717a', opacity: 0.5 }
                  }
                >
                  <Icon className="w-3 h-3" style={active ? { color: cfg.color } : {}} />
                  {label} <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/10 text-[9px]">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Radius Radar Proximity Filter */}
          <div className="flex items-center gap-1.5 shrink-0 bg-zinc-800/60 p-1 rounded-xl border border-zinc-700/60 self-start sm:self-auto">
            <Navigation className="w-3.5 h-3.5 text-blue-400 ml-1.5 shrink-0" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase mr-1">{isMs ? 'Radius:' : 'Radius:'}</span>
            {(['all', 2, 5, 10] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRadiusFilter(r)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                  radiusFilter === r
                    ? 'bg-blue-500/25 text-blue-400 border border-blue-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {r === 'all' ? (isMs ? 'Semua' : 'All') : `< ${r}km`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map Canvas Container */}
      <div className="flex-1 relative w-full h-full min-h-0">
        {mapReady && mapInstanceKey ? (
          <MapContainer
            key={mapInstanceKey}
            center={userLocation || DEFAULT_CENTER}
            zoom={13}
            preferCanvas={true}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <MapEventsController onMapInit={setActiveMap} onMapChange={handleMapChange} />

            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              attribution="&copy; CARTO &copy; OpenStreetMap"
            />

            {/* High-Risk Flood Polygon Zones */}
            {filters.flood &&
              floodZones.map((zone, i) => (
                <Circle
                  key={`flood-zone-${i}`}
                  center={zone.center}
                  radius={zone.radius}
                  interactive={false}
                  pathOptions={{
                    color: '#3B82F6',
                    fillColor: '#3B82F6',
                    fillOpacity: 0.12,
                    weight: 1.5,
                    dashArray: '6, 8',
                  }}
                />
              ))}

            {clusterPoints.map((cluster) => {
              const cfg = TYPE_CONFIG[cluster.type || 'pps'];
              const distFromUser =
                userLocation ? getDistanceKm(userLocation[0], userLocation[1], cluster.lat, cluster.lng) : null;

              // Render Cluster / Union-Merged Marker (HTML DivIcon Badge with tip-to-tip geometric diameter)
              if (cluster.isCluster || cluster.count > 1) {
                const diameter = cluster.radius ? cluster.radius * 2 : undefined;
                const clusterIcon = createClusterIcon(cluster.count, cfg.color, diameter);
                return (
                  <Marker
                    key={cluster.id}
                    position={[cluster.lat, cluster.lng]}
                    icon={clusterIcon}
                    eventHandlers={{
                      click: () => handleZoomCluster(cluster.lat, cluster.lng),
                    }}
                  />
                );
              }

              // Render Individual Circle Marker (Small crisp circle when zoomed in)
              const point = cluster.points[0] || cluster;
              const TypeIcon = cfg.icon;
              return (
                <CircleMarker
                  key={cluster.id}
                  center={[point.lat, point.lng]}
                  radius={point.type === 'sensor' ? 14 : 11}
                  pathOptions={{
                    color: cfg.color,
                    fillColor: cfg.color,
                    fillOpacity: 0.38,
                    weight: 2.5,
                  }}
                >
                  <Popup className="nadi-popup">
                    <div className="nadi-popup-card p-3.5 flex flex-col gap-2.5 relative font-sans text-white">
                      {/* a) TOP HAIRLINE */}
                      <div
                        className="h-[2px] w-full absolute top-0 left-0 right-0"
                        style={{ background: `linear-gradient(90deg, ${cfg.color}, transparent)` }}
                      />

                      {/* b) HEADER ROW */}
                      <div className="flex items-start gap-2.5 pt-0.5">
                        <div
                          className="w-[34px] h-[34px] rounded-xl flex items-center justify-center shrink-0 border"
                          style={{ backgroundColor: cfg.color + '22', borderColor: cfg.color + '44' }}
                        >
                          <TypeIcon className="w-4 h-4" style={{ color: cfg.color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[13px] font-bold text-white leading-tight line-clamp-2 pr-6">{point.label}</h4>
                          {point.sublabel && (
                            <p className="text-[10px] text-zinc-400 truncate mt-0.5">{point.sublabel}</p>
                          )}
                        </div>
                      </div>

                      {/* c) STATUS STRIP */}
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: cfg.color }} />
                        <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: cfg.color }}>
                          {isMs ? cfg.labelMs : cfg.labelEn}
                        </span>
                      </div>

                      {/* d) META ROW */}
                      <div className="flex flex-col gap-1">
                        {distFromUser !== null && (
                          <div className="flex items-center gap-1 text-[10px] font-semibold">
                            <Navigation className="w-3 h-3 text-blue-400 shrink-0" />
                            <span className="text-blue-400">
                              {distFromUser} km {isMs ? 'dari lokasi anda' : 'from your location'}
                            </span>
                          </div>
                        )}

                        {/* Live IoT Sensor Telemetry Card */}
                        {point.type === 'sensor' && (
                          <div className="my-1 p-2.5 rounded-xl bg-zinc-900/80 text-white font-sans border border-purple-500/30">
                            <div className="flex items-center justify-between text-[9px] text-zinc-400 font-bold mb-1">
                              <span>📡 IoT TELEMETRY</span>
                              <span className="text-emerald-400 font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                              </span>
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-base font-black text-purple-400">
                                {(liveSensorData?.water_level ?? 1.74).toFixed(2)}m
                              </span>
                              <span className="text-[10px] text-zinc-400">
                                ({Math.round((liveSensorData?.water_level ?? 1.74) * 100)} cm)
                              </span>
                            </div>
                            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden my-1 border border-zinc-700">
                              <div
                                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(10, ((liveSensorData?.water_level ?? 1.74) / 3.0) * 100))}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[8px] text-zinc-400 font-medium">
                              <span>Biasa &lt;1.8m</span>
                              <span className="text-amber-400">Amaran 1.8m</span>
                              <span className="text-red-400 font-bold">Bahaya 3.0m</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* e) ACTION ROW (Hidden for sensor type) */}
                      {point.type !== 'sensor' && (
                        <div className="grid grid-cols-2 gap-2 h-[34px] mt-0.5">
                          <a
                            href={`https://www.waze.com/ul?ll=${point.lat},${point.lng}&navigate=yes`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 hover:bg-blue-500 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-bold text-white no-underline active:scale-95 transition-all shadow-md"
                          >
                            <Car className="w-3.5 h-3.5 text-white shrink-0" />
                            <span className="text-white">Waze</span>
                          </a>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-bold text-white no-underline active:scale-95 transition-all shadow-md"
                          >
                            <Map className="w-3.5 h-3.5 text-white shrink-0" />
                            <span className="text-white">Maps</span>
                          </a>
                        </div>
                      )}

                      {/* f) TRUST FOOTER (PPS only) */}
                      {point.type === 'pps' && (
                        <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[8px] uppercase tracking-widest text-zinc-500 font-semibold">
                          <span>RASMI · JKM / NADMA</span>
                          <span className="text-emerald-500 font-bold">DISAHKAN</span>
                        </div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* User location marker */}
            {userLocation && (
              <CircleMarker
                center={userLocation}
                radius={8}
                pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.8, weight: 3 }}
              >
                <Popup className="nadi-popup">
                  <div className="nadi-popup-card p-3 font-sans text-xs font-bold text-white flex items-center gap-2">
                    <Navigation className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>{isMs ? 'Lokasi Anda' : 'Your Location'}</span>
                  </div>
                </Popup>
              </CircleMarker>
            )}
          </MapContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-xs font-bold text-zinc-400">
              {isMs ? 'Memuatkan Peta Haba...' : 'Loading Heatmap Canvas...'}
            </p>
          </div>
        )}

        {/* Floating Live GPS Re-Center Target Button */}
        <div className="absolute bottom-20 right-4 sm:bottom-28 sm:right-6 z-[500]">
          <button
            onClick={() => {
              if (userLocation && activeMap) {
                try {
                  activeMap.flyTo(userLocation, 14, { duration: 1.2 });
                } catch {}
              } else if (activeMap) {
                try {
                  activeMap.flyTo(DEFAULT_CENTER, 14, { duration: 1.2 });
                } catch {}
              }
            }}
            className="p-3 rounded-full bg-zinc-900/95 hover:bg-zinc-800 text-blue-400 border border-zinc-700/80 shadow-2xl transition-all active:scale-95 group backdrop-blur-xl"
            title={isMs ? 'Pusatkan Lokasi Saya' : 'Re-center My GPS'}
          >
            <Crosshair className="w-5 h-5 group-hover:rotate-45 transition-transform" />
          </button>
        </div>

        {/* Floating Collapsible Bottom Legend Drawer (Mobile Pill / Desktop Full Card) */}
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:w-[400px] md:right-6 z-[500]">
          {/* Mobile Collapsible Header Toggle Pill */}
          <div className="md:hidden flex justify-start mb-2">
            <button
              onClick={() => setLegendOpen(!legendOpen)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-zinc-900/95 border border-zinc-700/90 text-white shadow-2xl backdrop-blur-xl text-xs font-bold active:scale-95"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{clusterPoints.length} {isMs ? 'titik isyarat' : 'signals near you'}</span>
              {legendOpen ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronUp className="w-4 h-4 text-zinc-400" />}
            </button>
          </div>

          {/* Expanded Card (Always visible on desktop md:, collapsible on mobile) */}
          <div className={`${legendOpen ? 'flex' : 'hidden md:flex'} rounded-2xl p-3.5 backdrop-blur-2xl bg-zinc-900/95 border border-zinc-800 shadow-2xl flex-col gap-2.5 transition-all`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                  {isMs ? 'Senarai Aduan Berdekatan' : 'Signals Near You'}
                </p>
                <p className="text-xl font-bold text-white">
                  {clusterPoints.length} <span className="text-xs font-medium text-zinc-400">{isMs ? 'kawasan' : 'points/clusters'}</span>
                </p>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Canvas GIS
              </span>
            </div>

            {/* Interactive Legend Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-2 border-t border-zinc-800/80">
              {(Object.keys(TYPE_CONFIG) as HeatType[]).map((type) => {
                const cfg = TYPE_CONFIG[type];
                const count = points.filter((p) => p.type === type).length;
                const label = isMs ? cfg.labelMs : cfg.labelEn;
                return (
                  <div key={type} className="flex items-center gap-1.5 p-1 rounded-lg bg-zinc-800/40">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-zinc-200 truncate leading-tight">{label}</p>
                      <p className="text-[9px] text-zinc-400">{count} {isMs ? 'aktif' : 'active'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
