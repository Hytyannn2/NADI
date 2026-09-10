/**
 * Global Pothole Detector Context & Background Accelerometer Pipeline (Pipeline 1)
 * 
 * Runs continuously at root layout level regardless of active tab or page navigation.
 * Captures vehicle motion spikes (impact magnitude, Z-drop, gyroscope rotation),
 * computes confidence scores, auto-persists to Supabase `nadi_infra_reports` (with user_id),
 * syncs user-scoped localStorage, and triggers non-intrusive live notifications.
 */
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { usePotholeDetector, type SensorAnomalyEvent } from '@/src/hooks/usePotholeDetector';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { createClient } from '@/src/lib/supabase/client';

export interface PotholeDetectorContextType {
  isDetecting: boolean;
  isActive: boolean;
  isCalibrating: boolean;
  calibrationProgress: number;
  currentSpeed: number;
  userLat: number;
  userLng: number;
  motionError: string | null;
  clearMotionError: () => void;
  potholeCount: number;
  detectionCount: number;
  lastAnomaly: SensorAnomalyEvent | null;
  lastDetection: SensorAnomalyEvent | null;
  startDetection: () => Promise<void>;
  startDriving: () => Promise<void>;
  stopDetection: () => void;
  stopDriving: () => void;
  recentDetections: SensorAnomalyEvent[];
  lastToastAnomaly: SensorAnomalyEvent | null;
  dismissToast: () => void;
}

const PotholeDetectorContext = createContext<PotholeDetectorContextType | null>(null);

function getDeviceFingerprint(): string {
  const key = 'nadi_device_fp';
  if (typeof window === 'undefined') return 'dev_server';
  let fp = localStorage.getItem(key);
  if (!fp) {
    fp = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, fp);
  }
  return fp;
}

export function PotholeDetectorProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { playAlertSound } = useTheme();
  const [supabase] = useState(() => createClient());
  const [recentDetections, setRecentDetections] = useState<SensorAnomalyEvent[]>([]);
  const [lastToastAnomaly, setLastToastAnomaly] = useState<SensorAnomalyEvent | null>(null);

  const handleAnomalyDetected = useCallback(async (event: SensorAnomalyEvent) => {
    setRecentDetections(prev => [event, ...prev.slice(0, 49)]);
    setLastToastAnomaly(event);

    try {
      playAlertSound('beep');
    } catch {}

    const createdAtIso = new Date().toISOString();
    const cacheKey = user?.id ? `nadi_local_potholes_${user.id}` : 'nadi_local_potholes';

    // 1. Syncs with user-scoped and global local cache
    try {
      const existingStr = localStorage.getItem(cacheKey) || localStorage.getItem('nadi_local_potholes');
      const existing = existingStr ? JSON.parse(existingStr) : [];
      const newCacheItem = {
        id: event.id,
        userId: user?.id,
        lat: event.lat,
        lng: event.lng,
        category: 'jalan',
        suggestedAgency: 'JKR / PBT',
        zDropped: event.zDrop,
        verifications: 1,
        status: 'pending',
        createdAt: createdAtIso,
        time: 'Baru sahaja',
        confidenceScore: event.confidenceScore,
        speedKmh: event.speedKmh,
        title: `Lubang Jalan Dikesan (${event.zDrop.toFixed(1)}g)`,
      };
      localStorage.setItem(cacheKey, JSON.stringify([newCacheItem, ...existing].slice(0, 50)));
    } catch {}

    // 2. Persists verified sensor telemetry record to Supabase
    try {
      const deviceFp = getDeviceFingerprint();
      await supabase.from('nadi_infra_reports').insert({
        user_id: user?.id || null,
        lat: String(event.lat),
        lng: String(event.lng),
        z_dropped: event.zDrop,
        speed_kmh: event.speedKmh,
        gyro_max_rotation: event.gyroMaxRotation,
        waveform_duration_ms: event.waveformDurationMs,
        confidence_score: event.confidenceScore,
        device_fingerprint: deviceFp,
        status: 'pending',
        title: `Lubang Jalan Dikesan (${event.zDrop.toFixed(1)}g)`,
        created_at: createdAtIso,
      });
    } catch (dbErr) {
      console.warn('[PotholeDetectorContext] Supabase insert warning:', dbErr);
    }
  }, [user, supabase, playAlertSound]);

  const detector = usePotholeDetector({
    enabled: true,
    onAnomalyDetected: handleAnomalyDetected,
  });

  const dismissToast = useCallback(() => {
    setLastToastAnomaly(null);
  }, []);

  // Automatically dismisses toast after 4.5 seconds
  useEffect(() => {
    if (!lastToastAnomaly) return;
    const timer = setTimeout(() => {
      setLastToastAnomaly(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [lastToastAnomaly]);

  return (
    <PotholeDetectorContext.Provider
      value={{
        ...detector,
        recentDetections,
        lastToastAnomaly,
        dismissToast,
      }}
    >
      {children}
      {/* Background Pothole Sensor Alert Toast (Active across all tabs) */}
      {lastToastAnomaly && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] max-w-sm w-[90%] bg-zinc-950/95 backdrop-blur-xl border border-red-500/40 p-3.5 rounded-2xl shadow-2xl shadow-red-950/50 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
              <span className="text-base">🚨</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-red-400">Sensor Lubang Jalan</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-red-500/10 text-red-300 font-bold border border-red-500/20">
                  {lastToastAnomaly.zDrop.toFixed(1)}g
                </span>
              </div>
              <p className="text-xs font-semibold text-zinc-100 truncate mt-0.5">
                Laporan didaftarkan ({lastToastAnomaly.speedKmh} km/j)
              </p>
            </div>
          </div>
          <button
            onClick={dismissToast}
            className="text-zinc-400 hover:text-zinc-200 text-xs px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0 font-bold active:scale-95 transition-transform"
          >
            Tutup
          </button>
        </div>
      )}
    </PotholeDetectorContext.Provider>
  );
}

export function usePotholeContext() {
  const context = useContext(PotholeDetectorContext);
  if (!context) {
    throw new Error('usePotholeContext must be used within a PotholeDetectorProvider');
  }
  return context;
}
