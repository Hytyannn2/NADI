'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface SensorAnomalyEvent {
  id: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  lat: number;
  lng: number;
  speedKmh: number;
  magnitudeG: number;
  zDropRatio: number;
  zDrop: number;
  durationMs: number;
  waveformDurationMs: number;
  gyroMaxRotationDegSec: number;
  gyroMaxRotation: number;
  confidenceScore: number;
  locationLabel?: string;
}

export type PotholeDetection = SensorAnomalyEvent;

export interface UsePotholeDetectorOptions {
  onAnomalyDetected?: (event: SensorAnomalyEvent) => void;
  enabled?: boolean;
}

// =============================================================================
// ENGINEERING CONSTANTS
// =============================================================================
const SPEED_MIN_KMH = 10;            // Layer 1: Rejects walking/traffic crawl
const SPEED_MAX_KMH = 120;           // Layer 1: Highway max limit
const GRAVITY_LPF_ALPHA = 0.8;       // Layer 2: Low-pass filter constant for gravity
const MAGNITUDE_THRESHOLD = 2.5;     // Layer 3: g-force spike threshold
const POTHOLE_MAX_DURATION_MS = 250; // Layer 3: Pothole impact completes in < 250ms
const SPEEDBUMP_MIN_DURATION_MS = 280; // Layer 3: Speedbump wave duration
const GYRO_MAX_ROTATION_DEG = 150;   // Layer 4: deg/s (above this = phone drop)
const DEBOUNCE_COOLDOWN_MS = 5000;   // Layer 5: 5-second cooldown between reports
const CONFIDENCE_MIN_THRESHOLD = 70; // Layer 5: Required minimum confidence score
const MAX_GPS_ACCURACY_METERS = 25;  // Layer 0: Max allowed GPS uncertainty

export function usePotholeDetector({
  onAnomalyDetected,
  enabled = true,
}: UsePotholeDetectorOptions = {}) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [potholeCount, setPotholeCount] = useState(0);
  const [lastAnomaly, setLastAnomaly] = useState<SensorAnomalyEvent | null>(null);

  // Dynamic Gravity Vector Baseline Tracker (Layer 2 - Earth Frame Isolation)
  const gravityRef = useRef({ x: 0, y: 0, z: 9.81 });

  // Tracking impact duration (Layer 3)
  const impactStartTimeRef = useRef<number | null>(null);
  const peakMagnitudeRef = useRef<number>(0);
  const peakGyroRef = useRef<number>(0);
  const peakZDropRef = useRef<number>(0);
  const lastDetectionTimeRef = useRef<number>(0);

  // GPS Velocity & Accuracy Tracking (Layer 0 & Layer 1)
  const gpsSpeedKmhRef = useRef<number>(0);
  const gpsAccuracyRef = useRef<number>(0);
  const gpsCoordsRef = useRef<{ lat: number; lng: number }>({ lat: 6.1251, lng: 102.2345 });

  // 1. GPS Velocity & Location Listener
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const rawSpeedMps = position.coords.speed ?? 0;
        const currentSpeedKmh = rawSpeedMps * 3.6;
        
        gpsAccuracyRef.current = position.coords.accuracy ?? 0;
        
        // Exponential Moving Average (EMA) for GPS speed smoothing
        gpsSpeedKmhRef.current = (gpsSpeedKmhRef.current * 0.6) + (currentSpeedKmh * 0.4);
        gpsCoordsRef.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
      },
      (err) => console.warn('INFRA Geolocation Speed Error:', err.message),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 1000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  // 2. Motion Sensor Fusion Event Handler
  const handleDeviceMotion = useCallback(
    (event: DeviceMotionEvent) => {
      const now = performance.now();
      const currentSpeed = gpsSpeedKmhRef.current;
      const gpsAccuracy = gpsAccuracyRef.current;

      // =========================================================================
      // LAYER 0: GPS ACCURACY GATE (Rejects scattered GPS signals > 25m)
      // =========================================================================
      if (gpsAccuracy > MAX_GPS_ACCURACY_METERS && gpsAccuracy !== 0) {
        impactStartTimeRef.current = null;
        return;
      }

      // =========================================================================
      // LAYER 1: GPS SPEED GATE
      // Rejects stationary movements, traffic crawl, or extreme highway noise
      // =========================================================================
      if (currentSpeed < SPEED_MIN_KMH || currentSpeed > SPEED_MAX_KMH) {
        impactStartTimeRef.current = null;
        return;
      }

      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

      const rawX = acc.x;
      const rawY = acc.y;
      const rawZ = acc.z;

      // =========================================================================
      // LAYER 2: LPF DYNAMIC GRAVITY BASELINE TRACKER (EARTH FRAME ISOLATION)
      // Eliminates phone mounting tilt (45 deg dashboard vs horizontal)
      // =========================================================================
      const g = gravityRef.current;
      g.x = GRAVITY_LPF_ALPHA * g.x + (1 - GRAVITY_LPF_ALPHA) * rawX;
      g.y = GRAVITY_LPF_ALPHA * g.y + (1 - GRAVITY_LPF_ALPHA) * rawY;
      g.z = GRAVITY_LPF_ALPHA * g.z + (1 - GRAVITY_LPF_ALPHA) * rawZ;

      // Subtract isolated gravity vector to calculate pure Linear Acceleration
      const linX = rawX - g.x;
      const linY = rawY - g.y;
      const linZ = rawZ - g.z;

      // Calculate orientation-independent magnitude in g-force (1g = 9.81 m/s²)
      const linearMagnitudeMps2 = Math.sqrt(linX ** 2 + linY ** 2 + linZ ** 2);
      const magnitudeG = linearMagnitudeMps2 / 9.81;

      // Z-Axis Spike Ratio metric (Vertical displacement magnitude relative to baseline)
      const zDropRatio = Math.abs(linZ) / (Math.abs(g.z) || 9.81);

      // =========================================================================
      // LAYER 4: GYROSCOPE TUMBLE REJECTION & UNIT NORMALIZATION
      // Checks for phone drop/tumble in car (> 150 deg/s)
      // =========================================================================
      let gyroMaxDegSec = 0;
      if (event.rotationRate) {
        let rotAlpha = Math.abs(event.rotationRate.alpha ?? 0);
        let rotBeta = Math.abs(event.rotationRate.beta ?? 0);
        let rotGamma = Math.abs(event.rotationRate.gamma ?? 0);

        // HARDWARE NORMALIZATION: iOS Safari rad/s -> deg/s conversion check
        const rawMax = Math.max(rotAlpha, rotBeta, rotGamma);
        if (rawMax < 12.0 && rawMax > 0) {
          // Input is in radians per second -> convert to degrees per second
          rotAlpha *= 180 / Math.PI;
          rotBeta *= 180 / Math.PI;
          rotGamma *= 180 / Math.PI;
        }

        gyroMaxDegSec = Math.max(rotAlpha, rotBeta, rotGamma);
      }

      // =========================================================================
      // LAYER 3: WAVEFORM DURATION SIGNATURE & PEAK TRACKING
      // =========================================================================
      if (magnitudeG >= MAGNITUDE_THRESHOLD) {
        if (!impactStartTimeRef.current) {
          // Impact peak onset
          impactStartTimeRef.current = now;
          peakMagnitudeRef.current = magnitudeG;
          peakGyroRef.current = gyroMaxDegSec;
          peakZDropRef.current = zDropRatio;
        } else {
          // Track highest values during impact window
          peakMagnitudeRef.current = Math.max(peakMagnitudeRef.current, magnitudeG);
          peakGyroRef.current = Math.max(peakGyroRef.current, gyroMaxDegSec);
          peakZDropRef.current = Math.max(peakZDropRef.current, zDropRatio);
        }
      } else if (impactStartTimeRef.current !== null) {
        // Impact signal has returned below threshold -> evaluate duration
        const durationMs = now - impactStartTimeRef.current;
        impactStartTimeRef.current = null;

        // LAYER 4 CHECK: Reject phone tumble / drop
        if (peakGyroRef.current > GYRO_MAX_ROTATION_DEG) {
          return; // Phone was dropped or tumbled
        }

        // LAYER 3 CHECK: Reject speedbumps (> 280ms duration)
        if (durationMs > SPEEDBUMP_MIN_DURATION_MS) {
          return; // Slow gradual wave = speedbump
        }

        // Verify pothole impact duration (< 250ms sharp drop)
        if (durationMs <= POTHOLE_MAX_DURATION_MS) {
          // LAYER 5: CONFIDENCE EVALUATOR & DEBOUNCE COOLDOWN
          if (now - lastDetectionTimeRef.current < DEBOUNCE_COOLDOWN_MS) {
            return; // Enforce 5-second debouncing cooldown
          }

          // Calculate weighted confidence score (0-100%)
          let confidence = 50;
          if (peakMagnitudeRef.current > 3.5) confidence += 20;
          if (peakZDropRef.current > 1.2) confidence += 15;
          if (durationMs < 180) confidence += 15;

          const finalConfidence = Math.min(99, confidence);

          if (finalConfidence >= CONFIDENCE_MIN_THRESHOLD) {
            lastDetectionTimeRef.current = now;

            const anomalyEvent: SensorAnomalyEvent = {
              id: `POTHOLE-${Math.floor(now)}`,
              timestamp: Date.now(),
              latitude: gpsCoordsRef.current.lat,
              longitude: gpsCoordsRef.current.lng,
              lat: gpsCoordsRef.current.lat,
              lng: gpsCoordsRef.current.lng,
              speedKmh: Math.round(currentSpeed),
              magnitudeG: parseFloat(peakMagnitudeRef.current.toFixed(2)),
              zDropRatio: parseFloat(peakZDropRef.current.toFixed(2)),
              zDrop: parseFloat(peakZDropRef.current.toFixed(2)),
              durationMs: Math.round(durationMs),
              waveformDurationMs: Math.round(durationMs),
              gyroMaxRotationDegSec: Math.round(peakGyroRef.current),
              gyroMaxRotation: Math.round(peakGyroRef.current),
              confidenceScore: finalConfidence,
            };

            setPotholeCount((prev) => prev + 1);
            setLastAnomaly(anomalyEvent);
            onAnomalyDetected?.(anomalyEvent);
          }
        }
      }
    },
    [onAnomalyDetected]
  );

  // 3. Start/Stop Detection Listener
  const startDetection = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // iOS 13+ DeviceMotion Permission Request
    if (
      typeof (DeviceMotionEvent as any).requestPermission === 'function'
    ) {
      try {
        const state = await (DeviceMotionEvent as any).requestPermission();
        if (state !== 'granted') {
          alert('Kebenaran sensor gerakan diperlukan untuk pengesanan lubang jalan.');
          return;
        }
      } catch (e) {
        console.error('Sensor permission error:', e);
        return;
      }
    }

    window.addEventListener('devicemotion', handleDeviceMotion, true);
    setIsDetecting(true);
  }, [handleDeviceMotion]);

  const stopDetection = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('devicemotion', handleDeviceMotion, true);
    setIsDetecting(false);
  }, [handleDeviceMotion]);

  useEffect(() => {
    if (enabled) {
      startDetection();
    } else {
      stopDetection();
    }
    return () => stopDetection();
  }, [enabled, startDetection, stopDetection]);

  return {
    isDetecting,
    isActive: isDetecting,
    isCalibrating: false,
    calibrationProgress: 100,
    currentSpeed: Math.round(gpsSpeedKmhRef.current),
    userLat: gpsCoordsRef.current.lat,
    userLng: gpsCoordsRef.current.lng,
    motionError: null as string | null,
    potholeCount,
    detectionCount: potholeCount,
    lastAnomaly,
    lastDetection: lastAnomaly,
    startDetection,
    startDriving: startDetection,
    stopDetection,
    stopDriving: stopDetection,
  };
}
