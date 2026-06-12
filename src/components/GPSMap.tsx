'use client';

import { useEffect, useRef } from 'react';
import { LocateFixed } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface GPSMapProps {
  lat: number;
  lng: number;
}

export default function GPSMap({ lat, lng }: GPSMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

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

      // Add satellite tile layer (Google Maps Satellite for more recent imagery)
      L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '&copy; Google Maps'
      }).addTo(map);

      // Create custom animated marker
      const userIcon = L.divIcon({
        className: 'custom-leaflet-icon',
        html: `
          <div style="position: relative;">
            <div style="width: 16px; height: 16px; border-radius: 50%; background: #3B82F6; border: 2px solid white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);"></div>
            <div style="position: absolute; inset: 0; width: 16px; height: 16px; border-radius: 50%; background: #3B82F6; opacity: 0.4; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
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
  }, []); // Run only once on mount

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

  return (
    <div className="w-full h-full relative" style={{ zIndex: 1, background: '#000' }}>
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Recenter Button */}
      <button 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          mapInstanceRef.current?.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
        }}
        className="absolute bottom-4 right-4 w-11 h-11 rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all z-[400]"
        aria-label="Recenter map to current location"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
      >
        <LocateFixed className="w-5 h-5" style={{ color: '#3B82F6' }} />
      </button>
    </div>
  );
}
