/**
 * Interactive GPS & Evacuation Map Component
 * 
 * Embeds a responsive Leaflet map displaying real-time citizen GPS positioning,
 * closest evacuation shelters (PPS), and multiple tile styles (Dark, Streets, Satellite).
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Plus, Minus, Maximize2, Minimize2, Layers, Globe, MapPin, Eye, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLanguage } from '@/src/context/LanguageContext';

export interface EvacShelterMarker {
  name: string;
  lat: number;
  lng: number;
  type: string;
  capacity?: number;
  distanceKm?: number | null;
}

interface GPSMapProps {
  lat: number;
  lng: number;
  shelters?: EvacShelterMarker[];
}

export default function GPSMap({ lat, lng, shelters = [] }: GPSMapProps) {
  const { lang } = useLanguage();
  const isMs = lang === 'ms';
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const shelterLayerRef = useRef<L.LayerGroup | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isAnimatingFS, setIsAnimatingFS] = useState(false);
  const [layerMode, setLayerMode] = useState<'dark' | 'streets' | 'satellite'>('dark');
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initializes Leaflet map instance
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        center: [lat, lng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      // Layer group for evacuation shelter markers
      shelterLayerRef.current = L.layerGroup().addTo(map);

      // Custom pulsing marker for user GPS location
      const userIcon = L.divIcon({
        className: 'custom-leaflet-icon',
        html: `
          <div style="position: relative;">
            <div style="width: 18px; height: 18px; border-radius: 50%; background: #3B82F6; border: 2.5px solid white; box-shadow: 0 4px 8px -1px rgb(0 0 0 / 0.3);"></div>
            <div style="position: absolute; inset: 0; width: 18px; height: 18px; border-radius: 50%; background: #3B82F6; opacity: 0.4; animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          </div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marker = L.marker([lat, lng], { icon: userIcon }).addTo(map);

      mapInstanceRef.current = map;
      markerRef.current = marker;

      // Force size recalculation across all render ticks
      const invalidate = () => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      };

      [50, 150, 300, 600, 1000].forEach(delay => setTimeout(invalidate, delay));

      // ResizeObserver to automatically handle container size changes
      if (containerRef.current && typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => invalidate());
        ro.observe(containerRef.current);
      }
    }

    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map tile layer dynamically when layerMode changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (currentTileLayerRef.current) {
      currentTileLayerRef.current.remove();
    }

    let tileUrl = 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png';
    let options: L.TileLayerOptions = {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c', 'd'],
      attribution: '&copy; CARTO &copy; OpenStreetMap',
    };

    if (layerMode === 'streets') {
      tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      options = { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' };
    } else if (layerMode === 'satellite') {
      tileUrl = 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
      options = { maxZoom: 20, subdomains: ['0', '1', '2', '3'], attribution: '&copy; Google Maps Satellite' };
    }

    const tileLayer = L.tileLayer(tileUrl, options);

    tileLayer.on('tileerror', () => {
      if (layerMode === 'satellite') {
        console.warn('[GPSMap] Google Satellite tiles error — swapping to Esri World Imagery fallback');
        tileLayer.remove();
        const esriFallback = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri',
        });
        esriFallback.addTo(mapInstanceRef.current!);
        currentTileLayerRef.current = esriFallback;
      } else if (layerMode === 'dark') {
        console.warn('[GPSMap] CartoDB dark tiles error — swapping to Stadia Dark fallback');
        tileLayer.remove();
        const stadiaFallback = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          attribution: '&copy; Stadia Maps',
        });
        stadiaFallback.addTo(mapInstanceRef.current!);
        currentTileLayerRef.current = stadiaFallback;
      }
    });

    tileLayer.addTo(mapInstanceRef.current);
    currentTileLayerRef.current = tileLayer;
  }, [layerMode]);

  // Update map center and marker when coordinates change
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], mapInstanceRef.current.getZoom(), {
        animate: true,
        duration: 1.5,
      });
      markerRef.current.setLatLng([lat, lng]);
    }
  }, [lat, lng]);

  // Update shelter markers on map whenever shelters prop changes
  useEffect(() => {
    if (!shelterLayerRef.current) return;
    shelterLayerRef.current.clearLayers();

    shelters.forEach((shelter) => {
      const shelterIcon = L.divIcon({
        className: 'custom-shelter-icon',
        html: `
          <div style="position: relative; display: flex; items-center; justify-content: center; width: 26px; height: 26px; border-radius: 10px; background: rgba(16, 185, 129, 0.9); border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.4); text-align: center; line-height: 22px; font-size: 13px;">
            ${shelter.type === 'Sekolah' ? '🏫' : shelter.type === 'Masjid' ? '🕌' : shelter.type === 'Dewan' ? '🏛️' : '📍'}
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const shelterMarker = L.marker([shelter.lat, shelter.lng], { icon: shelterIcon });
      const distLabel = shelter.distanceKm != null ? ` · ${shelter.distanceKm} km` : '';

      shelterMarker.bindPopup(`
        <div style="font-family: sans-serif; padding: 4px; color: #111;">
          <strong style="font-size: 12px; display: block; margin-bottom: 2px;">${shelter.name}</strong>
          <span style="font-size: 10px; color: #666;">${shelter.type}${distLabel}</span>
        </div>
      `);

      shelterLayerRef.current?.addLayer(shelterMarker);
    });
  }, [shelters]);

  // Smooth Fullscreen Toggle Helper
  const toggleFullScreen = () => {
    if (!containerRef.current) return;

    setIsAnimatingFS(true);

    const invalidateSmoothly = () => {
      [50, 150, 300, 500].forEach((delay) => {
        setTimeout(() => {
          mapInstanceRef.current?.invalidateSize();
        }, delay);
      });
      setTimeout(() => setIsAnimatingFS(false), 550);
    };

    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen()
        .then(() => {
          setIsFullScreen(true);
          invalidateSmoothly();
        })
        .catch((err) => {
          console.error('Fullscreen request failed:', err);
          setIsFullScreen((prev) => !prev);
          invalidateSmoothly();
        });
    } else {
      document
        .exitFullscreen()
        .then(() => {
          setIsFullScreen(false);
          invalidateSmoothly();
        })
        .catch(() => {
          setIsFullScreen(false);
          invalidateSmoothly();
        });
    }
  };

  // Sync state if user exits fullscreen via ESC key
  useEffect(() => {
    const handleFSChange = () => {
      const isFS = !!document.fullscreenElement;
      setIsFullScreen(isFS);
      [50, 150, 300, 500].forEach((delay) => {
        setTimeout(() => {
          mapInstanceRef.current?.invalidateSize();
        }, delay);
      });
    };

    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative overflow-hidden transition-all duration-300 ${
        isFullScreen ? 'fixed inset-0 z-[9999] w-screen h-screen bg-black' : ''
      }`}
      style={{ zIndex: isFullScreen ? 9999 : 1, background: '#000' }}
    >
      {/* Ripple Glow Transition Animation */}
      <AnimatePresence>
        {isAnimatingFS && (
          <motion.div
            initial={{ scale: 0.2, opacity: 0.8 }}
            animate={{ scale: 3, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute inset-0 pointer-events-none z-[500] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, rgba(59, 130, 246, 0.2) 50%, transparent 75%)',
            }}
          />
        )}
      </AnimatePresence>

      <div ref={mapRef} className="w-full h-full min-h-[300px] absolute inset-0 z-[1]" />

      {/* Control Buttons Stack (Layers, Zoom, Fullscreen, Recenter) */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-[400]">
        
        {/* Layer Mode Switcher Button */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowLayerMenu((prev) => !prev);
            }}
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-2xl backdrop-blur-xl transition-colors relative overflow-hidden group"
            aria-label={isMs ? 'Pilih Lapisan Peta' : 'Select Map Layer'}
            title={isMs ? 'Pilih Lapisan Peta' : 'Select Map Layer'}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
          >
            <Layers className="w-4 h-4 text-emerald-400 group-hover:rotate-12 transition-transform" />
          </motion.button>

          {/* Layer Menu Popup */}
          <AnimatePresence>
            {showLayerMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                className="absolute right-0 top-12 w-44 rounded-2xl p-2 shadow-2xl backdrop-blur-2xl bg-zinc-900/95 border border-zinc-700/80 flex flex-col gap-1 z-[500]"
              >
                <button
                  onClick={() => {
                    setLayerMode('dark');
                    setShowLayerMenu(false);
                  }}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    layerMode === 'dark' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-zinc-400" /> {isMs ? 'Mod Gelap' : 'Dark Mode'}
                  </span>
                  {layerMode === 'dark' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>

                <button
                  onClick={() => {
                    setLayerMode('streets');
                    setShowLayerMenu(false);
                  }}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    layerMode === 'streets' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-blue-400" /> {isMs ? 'Mod Jalan' : 'Streets Mode'}
                  </span>
                  {layerMode === 'streets' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>

                <button
                  onClick={() => {
                    setLayerMode('satellite');
                    setShowLayerMenu(false);
                  }}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    layerMode === 'satellite' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5 text-amber-400" /> {isMs ? 'Satelit' : 'Satellite'}
                  </span>
                  {layerMode === 'satellite' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Fullscreen Toggle Button */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFullScreen();
          }}
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-2xl backdrop-blur-xl transition-colors relative overflow-hidden group"
          aria-label={isFullScreen ? (isMs ? 'Keluar Skrin Penuh' : 'Exit Full Screen') : (isMs ? 'Skrin Penuh' : 'Full Screen')}
          title={isFullScreen ? (isMs ? 'Keluar Skrin Penuh' : 'Exit Full Screen') : (isMs ? 'Skrin Penuh' : 'Full Screen')}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isFullScreen ? 'exit' : 'enter'}
              initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.2 }}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Maximize2 className="w-4 h-4 text-white group-hover:text-emerald-400 transition-colors" />
              )}
            </motion.div>
          </AnimatePresence>
        </motion.button>

        {/* Zoom In */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            mapInstanceRef.current?.zoomIn();
          }}
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-xl backdrop-blur-xl transition-all"
          aria-label={isMs ? 'Besarkan Peta' : 'Zoom In'}
          title={isMs ? 'Besarkan Peta' : 'Zoom In'}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        >
          <Plus className="w-4 h-4" />
        </motion.button>

        {/* Zoom Out */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            mapInstanceRef.current?.zoomOut();
          }}
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-xl backdrop-blur-xl transition-all"
          aria-label={isMs ? 'Kecilkan Peta' : 'Zoom Out'}
          title={isMs ? 'Kecilkan Peta' : 'Zoom Out'}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        >
          <Minus className="w-4 h-4" />
        </motion.button>

        {/* Recenter to User Location */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            mapInstanceRef.current?.flyTo([lat, lng], 17, { animate: true, duration: 1.2 });
          }}
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-xl backdrop-blur-xl transition-all mt-1"
          aria-label={isMs ? 'Kembali ke Lokasi Saya' : 'Recenter to My Location'}
          title={isMs ? 'Kembali ke Lokasi Saya' : 'Recenter to My Location'}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        >
          <LocateFixed className="w-4 h-4 text-blue-400" />
        </motion.button>
      </div>
    </div>
  );
}
