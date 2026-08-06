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
const LPF_WARMUP_DURATION_MS = 3000; // 3-second warm-up for LPF gravity convergence
const HYSTERESIS_GRACE_PERIOD_MS = 50; // 50ms grace period to prevent signal chatter

// Haversine Distance Helper for GPS Speed Fallback (when coords.speed is null)
function calculateHaversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function usePotholeDetector({
  onAnomalyDetected,
  enabled = true,
}: UsePotholeDetectorOptions = {}) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [potholeCount, setPotholeCount] = useState(0);
  const [lastAnomaly, setLastAnomaly] = useState<SensorAnomalyEvent | null>(null);
  const [motionError, setMotionError] = useState<string | null>(null);

  // Dynamic Gravity Vector Baseline Tracker (Layer 2 - Earth Frame Isolation)
  const gravityRef = useRef({ x: 0, y: 0, z: 9.81 });

  // LPF Convergence Warm-up Clock
  const detectorStartTimeRef = useRef<number>(0);

  // Tracking impact duration (Layer 3)
  const impactStartTimeRef = useRef<number | null>(null);
  const lastBelowThresholdTimeRef = useRef<number>(0);
  const peakMagnitudeRef = useRef<number>(0);
  const peakGyroRef = useRef<number>(0);
  const peakZDropRef = useRef<number>(0);
  const lastDetectionTimeRef = useRef<number>(0);

  // GPS Velocity & Accuracy Tracking (Layer 0 & Layer 1)
  // FIX: Initialize accuracy to 999 so un-located signals are blocked initially
  const gpsAccuracyRef = useRef<number>(999);
  const gpsSpeedKmhRef = useRef<number>(0);
  const gpsCoordsRef = useRef<{ lat: number; lng: number }>({ lat: 6.1251, lng: 102.2345 });
  const lastGpsPointRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  // Helper function to reset impact peak refs
  const resetPeakRefs = useCallback(() => {
    impactStartTimeRef.current = null;
    lastBelowThresholdTimeRef.current = 0;
    peakMagnitudeRef.current = 0;
    peakGyroRef.current = 0;
    peakZDropRef.current = 0;
  }, []);

  // 1. GPS Velocity & Location Listener (with Haversine Speed Fallback & dt > 500ms safeguard)
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        gpsAccuracyRef.current = position.coords.accuracy ?? 999;

        let calculatedSpeedKmh = 0;

        // FIX: If coords.speed is available, use it. Otherwise, calculate via Haversine
        if (position.coords.speed !== null && position.coords.speed !== undefined && position.coords.speed >= 0) {
          calculatedSpeedKmh = position.coords.speed * 3.6;
          // Exponential Moving Average (EMA) for GPS speed smoothing
          gpsSpeedKmhRef.current = (gpsSpeedKmhRef.current * 0.6) + (calculatedSpeedKmh * 0.4);
        } else if (lastGpsPointRef.current) {
          const dtSec = (now - lastGpsPointRef.current.time) / 1000;
          if (dtSec >= 0.5) { // dt > 500ms safeguard against division-by-zero
            const distMeters = calculateHaversineMeters(
              lastGpsPointRef.current.lat,
              lastGpsPointRef.current.lng,
              lat,
              lng
            );
            calculatedSpeedKmh = (distMeters / dtSec) * 3.6;
            gpsSpeedKmhRef.current = (gpsSpeedKmhRef.current * 0.6) + (calculatedSpeedKmh * 0.4);
          }
        }

        lastGpsPointRef.current = { lat, lng, time: now };
        gpsCoordsRef.current = { lat, lng };
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
      // LPF CONVERGENCE WARM-UP WINDOW (3 Seconds)
      // Suppresses false positives while LPF converges to phone mounting tilt
      // =========================================================================
      if (now - detectorStartTimeRef.current < LPF_WARMUP_DURATION_MS) {
        resetPeakRefs();
        return;
      }

      // =========================================================================
      // LAYER 0: GPS ACCURACY GATE
      // Rejects scattered or un-located GPS signals (> 25m uncertainty)
      // =========================================================================
      if (gpsAccuracy > MAX_GPS_ACCURACY_METERS) {
        resetPeakRefs();
        return;
      }

      // =========================================================================
      // LAYER 1: GPS SPEED GATE
      // Rejects stationary movements, traffic crawl, or extreme highway noise
      // =========================================================================
      if (currentSpeed < SPEED_MIN_KMH || currentSpeed > SPEED_MAX_KMH) {
        resetPeakRefs();
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

      // VECTOR DOT PRODUCT: Project 3D linear acceleration onto normalized gravity vector
      // Isolates true Earth-frame vertical drop magnitude regardless of phone mounting angle
      const gMag = Math.sqrt(g.x ** 2 + g.y ** 2 + g.z ** 2) || 9.81;
      const gNormX = g.x / gMag;
      const gNormY = g.y / gMag;
      const gNormZ = g.z / gMag;

      const earthVerticalAccelMps2 = (linX * gNormX) + (linY * gNormY) + (linZ * gNormZ);
      const verticalDropG = Math.abs(earthVerticalAccelMps2) / 9.81;

      // Overall linear acceleration magnitude (Earth Frame)
      const linearMagnitudeMps2 = Math.sqrt(linX ** 2 + linY ** 2 + linZ ** 2);
      const magnitudeG = linearMagnitudeMps2 / 9.81;

      // =========================================================================
      // LAYER 4: GYROSCOPE TUMBLE REJECTION & SAFE UNIT NORMALIZATION
      // =========================================================================
      let gyroMaxDegSec = 0;
      if (event.rotationRate) {
        let rotAlpha = Math.abs(event.rotationRate.alpha ?? 0);
        let rotBeta = Math.abs(event.rotationRate.beta ?? 0);
        let rotGamma = Math.abs(event.rotationRate.gamma ?? 0);

        const rawMax = Math.max(rotAlpha, rotBeta, rotGamma);

        // FIX: Only convert if rawMax < Math.PI (~3.14 rad/s).
        // Prevents converting gentle deg/s turns (5-11 deg/s) into false 286 deg/s tumbles!
        if (rawMax < Math.PI && rawMax > 0.001) {
          rotAlpha *= 180 / Math.PI;
          rotBeta *= 180 / Math.PI;
          rotGamma *= 180 / Math.PI;
        }

        gyroMaxDegSec = Math.max(rotAlpha, rotBeta, rotGamma);
      }

      // =========================================================================
      // LAYER 3: WAVEFORM DURATION SIGNATURE & 50MS HYSTERESIS GRACE PERIOD
      // =========================================================================
      if (magnitudeG >= MAGNITUDE_THRESHOLD) {
        lastBelowThresholdTimeRef.current = 0; // Reset hysteresis timer on spike

        if (!impactStartTimeRef.current) {
          // Impact peak onset
          impactStartTimeRef.current = now;
          peakMagnitudeRef.current = magnitudeG;
          peakGyroRef.current = gyroMaxDegSec;
          peakZDropRef.current = verticalDropG;
        } else {
          // Track highest values during impact window
          peakMagnitudeRef.current = Math.max(peakMagnitudeRef.current, magnitudeG);
          peakGyroRef.current = Math.max(peakGyroRef.current, gyroMaxDegSec);
          peakZDropRef.current = Math.max(peakZDropRef.current, verticalDropG);
        }
      } else if (impactStartTimeRef.current !== null) {
        // Magnitude dropped below threshold -> start 50ms hysteresis grace period
        if (lastBelowThresholdTimeRef.current === 0) {
          lastBelowThresholdTimeRef.current = now;
        } else if (now - lastBelowThresholdTimeRef.current >= HYSTERESIS_GRACE_PERIOD_MS) {
          // Signal stayed low for 50ms -> Evaluate completed impact duration
          const durationMs = lastBelowThresholdTimeRef.current - impactStartTimeRef.current;
          
          const peakGyro = peakGyroRef.current;
          const peakMag = peakMagnitudeRef.current;
          const peakZDrop = peakZDropRef.current;

          resetPeakRefs(); // Clean state reset

          // LAYER 4 CHECK: Reject phone tumble / drop (> 150 deg/s)
          if (peakGyro > GYRO_MAX_ROTATION_DEG) {
            return;
          }

          // LAYER 3 CHECK: Reject speedbumps (> 280ms duration)
          if (durationMs > SPEEDBUMP_MIN_DURATION_MS) {
            return;
          }

          // Verify pothole impact duration (< 250ms sharp drop)
          if (durationMs <= POTHOLE_MAX_DURATION_MS) {
            // LAYER 5: CONFIDENCE EVALUATOR & DEBOUNCE COOLDOWN
            if (now - lastDetectionTimeRef.current < DEBOUNCE_COOLDOWN_MS) {
              return;
            }

            // Calculate weighted confidence score (0-100%)
            let confidence = 50;
            if (peakMag > 3.5) confidence += 20;
            if (peakZDrop > 1.2) confidence += 15;
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
                magnitudeG: parseFloat(peakMag.toFixed(2)),
                zDropRatio: parseFloat(peakZDrop.toFixed(2)),
                zDrop: parseFloat(peakZDrop.toFixed(2)),
                durationMs: Math.round(durationMs),
                waveformDurationMs: Math.round(durationMs),
                gyroMaxRotationDegSec: Math.round(peakGyro),
                gyroMaxRotation: Math.round(peakGyro),
                confidenceScore: finalConfidence,
              };

              setPotholeCount((prev) => prev + 1);
              setLastAnomaly(anomalyEvent);
              onAnomalyDetected?.(anomalyEvent);
            }
          }
        }
      }
    },
    [onAnomalyDetected, resetPeakRefs]
  );

  // 3. Start/Stop Detection Listener
  const startDetection = useCallback(async () => {
    if (typeof window === 'undefined') return;

    if (
      typeof (DeviceMotionEvent as any).requestPermission === 'function'
    ) {
      try {
        const state = await (DeviceMotionEvent as any).requestPermission();
        if (state !== 'granted') {
          setMotionError('Kebenaran sensor gerakan diperlukan untuk pengesanan lubang jalan.');
          return;
        }
      } catch (e) {
        console.error('Sensor permission error:', e);
        return;
      }
    }

    detectorStartTimeRef.current = performance.now(); // Start 3-second LPF warm-up timer
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
    motionError,
    clearMotionError: () => setMotionError(null),
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
