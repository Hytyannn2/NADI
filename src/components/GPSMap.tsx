'use client';

import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Plus, Minus, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const shelterLayerRef = useRef<L.LayerGroup | null>(null);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isAnimatingFS, setIsAnimatingFS] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        center: [lat, lng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      // Add CartoDB Dark tile layer for crisp, reliable dark-mode map tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; CARTO &copy; OpenStreetMap'
      }).addTo(map);

      // Layer group for shelter markers
      shelterLayerRef.current = L.layerGroup().addTo(map);

      // Create custom animated user marker
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

    shelters.forEach(s => {
      if (!s.lat || !s.lng) return;
      const emoji = s.type === 'Sekolah' ? '🏫' : s.type === 'Masjid' ? '🕌' : '🏛️';
      const shelterIcon = L.divIcon({
        className: 'shelter-leaflet-icon',
        html: `
          <div style="background: #10B981; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
            <span>${emoji}</span>
            <span>${s.name.slice(0, 16)}${s.name.length > 16 ? '...' : ''}</span>
          </div>
        `,
        iconSize: [120, 24],
        iconAnchor: [60, 12],
      });

      const m = L.marker([s.lat, s.lng], { icon: shelterIcon });
      m.bindPopup(`
        <div style="padding: 4px; font-family: sans-serif;">
          <strong style="font-size: 12px; color: #111;">${s.name}</strong>
          <div style="font-size: 10px; color: #555; margin-top: 2px;">
            ${s.type} · Capacity: <strong>${s.capacity || 400}</strong>
          </div>
          ${s.distanceKm ? `<div style="font-size: 10px; color: #3B82F6; font-weight: bold; margin-top: 4px;">📍 ${s.distanceKm} km from you</div>` : ''}
        </div>
      `);
      shelterLayerRef.current?.addLayer(m);
    });
  }, [shelters]);

  // Handle Full Screen Toggle with smooth progressive tile invalidation
  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    setIsAnimatingFS(true);

    const invalidateSmoothly = () => {
      [50, 150, 300, 500].forEach(delay => {
        setTimeout(() => {
          mapInstanceRef.current?.invalidateSize();
        }, delay);
      });
      setTimeout(() => setIsAnimatingFS(false), 550);
    };

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullScreen(true);
        invalidateSmoothly();
      }).catch((err) => {
        console.error('Fullscreen request failed:', err);
        setIsFullScreen(prev => !prev); // Fallback to CSS fullscreen
        invalidateSmoothly();
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullScreen(false);
        invalidateSmoothly();
      }).catch(() => {
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
      [50, 150, 300, 500].forEach(delay => {
        setTimeout(() => {
          mapInstanceRef.current?.invalidateSize();
        }, delay);
      });
    };

    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  return (
    <motion.div
      ref={containerRef}
      layout
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
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

      {/* Control Buttons Stack (Zoom In, Zoom Out, Fullscreen, Recenter) */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-[400]">
        {/* Fullscreen Toggle Button with Smooth Icon Morph */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFullScreen();
          }}
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-2xl backdrop-blur-xl transition-colors relative overflow-hidden group"
          aria-label={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
          title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
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
          aria-label="Zoom In"
          title="Zoom In"
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
          aria-label="Zoom Out"
          title="Zoom Out"
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
          aria-label="Recenter Map"
          title="Recenter to My Location"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        >
          <LocateFixed className="w-4 h-4 text-blue-400" />
        </motion.button>
      </div>
    </motion.div>
  );
}
