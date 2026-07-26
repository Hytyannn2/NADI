'use client';

import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Plus, Minus, Maximize2, Minimize2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface GPSMapProps {
  lat: number;
  lng: number;
}

export default function GPSMap({ lat, lng }: GPSMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      // Add satellite tile layer (Google Maps Satellite for recent imagery)
      L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '&copy; Google Maps'
      }).addTo(map);

      // Create custom animated marker
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

  // Handle Full Screen Toggle
  const toggleFullScreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullScreen(true);
      }).catch((err) => {
        console.error('Fullscreen request failed:', err);
        setIsFullScreen(prev => !prev); // Fallback to CSS fullscreen
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullScreen(false);
      }).catch(() => {
        setIsFullScreen(false);
      });
    }

    // Tell Leaflet to recalculate container bounds after fullscreen transition
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 250);
  };

  // Sync state if user exits fullscreen via ESC key
  useEffect(() => {
    const handleFSChange = () => {
      const isFS = !!document.fullscreenElement;
      setIsFullScreen(isFS);
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 200);
    };

    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative transition-all ${
        isFullScreen ? 'fixed inset-0 z-[9999] w-screen h-screen bg-black' : ''
      }`}
      style={{ zIndex: isFullScreen ? 9999 : 1, background: '#000' }}
    >
      <div ref={mapRef} className="w-full h-full" />

      {/* Control Buttons Stack (Zoom In, Zoom Out, Fullscreen, Recenter) */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-[400]">
        {/* Fullscreen Toggle */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFullScreen();
          }}
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all backdrop-blur-md"
          aria-label={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
          title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        >
          {isFullScreen ? <Minimize2 className="w-4 h-4 text-emerald-400" /> : <Maximize2 className="w-4 h-4 text-white" />}
        </button>

        {/* Zoom In */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            mapInstanceRef.current?.zoomIn();
          }}
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all backdrop-blur-md"
          aria-label="Zoom In"
          title="Zoom In"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Zoom Out */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            mapInstanceRef.current?.zoomOut();
          }}
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all backdrop-blur-md"
          aria-label="Zoom Out"
          title="Zoom Out"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* Recenter to User Location */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            mapInstanceRef.current?.flyTo([lat, lng], 17, { animate: true, duration: 1.2 });
          }}
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all backdrop-blur-md mt-1"
          aria-label="Recenter Map"
          title="Recenter to My Location"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
        >
          <LocateFixed className="w-4 h-4 text-blue-400" />
        </button>
      </div>
    </div>
  );
}
