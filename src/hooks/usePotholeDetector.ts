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

// Detection thresholds and timing constants
const SPEED_MIN_KMH = 10;            // Minimum vehicle speed to filter out walking/foot traffic
const SPEED_MAX_KMH = 120;           // Maximum plausible driving speed
const GRAVITY_LPF_ALPHA = 0.8;       // Low-pass filter alpha to estimate gravity direction
const MAGNITUDE_THRESHOLD = 2.5;     // Acceleration spike threshold in g
const POTHOLE_MAX_DURATION_MS = 250; // Pothole impacts typically finish within 250ms
const SPEEDBUMP_MIN_DURATION_MS = 280; // Speed bumps produce wider waveforms (>280ms)
const GYRO_MAX_ROTATION_DEG = 150;   // Rejects phone drops/handling (deg/s)
const DEBOUNCE_COOLDOWN_MS = 5000;   // Cooldown between repeated reports (5 seconds)
const CONFIDENCE_MIN_THRESHOLD = 70; // Minimum score required to register a pothole
const MAX_GPS_ACCURACY_METERS = 25;  // Ignores readings if GPS uncertainty is above 25m
const LPF_WARMUP_DURATION_MS = 3000; // Warm-up time for gravity filter to stabilize
const HYSTERESIS_GRACE_PERIOD_MS = 50; // Grace period to prevent signal chatter

// Calculates distance in meters between two GPS coordinates using the Haversine formula
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

  // Estimated gravity vector to isolate linear acceleration
  const gravityRef = useRef({ x: 0, y: 0, z: 9.81 });

  // Timestamp when detector started (used for warm-up period)
  const detectorStartTimeRef = useRef<number>(0);

  // Impact tracking references
  const impactStartTimeRef = useRef<number | null>(null);
  const lastBelowThresholdTimeRef = useRef<number>(0);
  const peakMagnitudeRef = useRef<number>(0);
  const peakGyroRef = useRef<number>(0);
  const peakZDropRef = useRef<number>(0);
  const lastDetectionTimeRef = useRef<number>(0);

  // GPS speed and accuracy tracking
  const gpsAccuracyRef = useRef<number>(999);
  const gpsSpeedKmhRef = useRef<number>(0);
  const gpsCoordsRef = useRef<{ lat: number; lng: number }>({ lat: 6.1251, lng: 102.2345 });
  const lastGpsPointRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  // Resets tracked impact peak values
  const resetPeakRefs = useCallback(() => {
    impactStartTimeRef.current = null;
    lastBelowThresholdTimeRef.current = 0;
    peakMagnitudeRef.current = 0;
    peakGyroRef.current = 0;
    peakZDropRef.current = 0;
  }, []);

  // 1. Listens for GPS updates and calculates smoothed vehicle speed
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        gpsAccuracyRef.current = position.coords.accuracy ?? 999;

        let calculatedSpeedKmh = 0;

        // Use native GPS speed if available; otherwise calculate from distance delta
        if (position.coords.speed !== null && position.coords.speed !== undefined && position.coords.speed >= 0) {
          calculatedSpeedKmh = position.coords.speed * 3.6;
          // Smooth speed using Exponential Moving Average (EMA)
          gpsSpeedKmhRef.current = (gpsSpeedKmhRef.current * 0.6) + (calculatedSpeedKmh * 0.4);
        } else if (lastGpsPointRef.current) {
          const dtSec = (now - lastGpsPointRef.current.time) / 1000;
          if (dtSec >= 0.5) { // Minimum 500ms between calculations to avoid noisy spikes
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

      // Warm-up check: suppress false positives while gravity filter stabilizes
      if (now - detectorStartTimeRef.current < LPF_WARMUP_DURATION_MS) {
        resetPeakRefs();
        return;
      }

      // Layer 0: Check GPS accuracy (reject if uncertainty > 25m)
      if (gpsAccuracy > MAX_GPS_ACCURACY_METERS) {
        resetPeakRefs();
        return;
      }

      // Layer 1: Check vehicle speed (must be between 10 km/h and 120 km/h)
      if (currentSpeed < SPEED_MIN_KMH || currentSpeed > SPEED_MAX_KMH) {
        resetPeakRefs();
        return;
      }

      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

      const rawX = acc.x;
      const rawY = acc.y;
      const rawZ = acc.z;

      // Layer 2: Update low-pass filtered gravity baseline to handle phone mounting angle
      const g = gravityRef.current;
      g.x = GRAVITY_LPF_ALPHA * g.x + (1 - GRAVITY_LPF_ALPHA) * rawX;
      g.y = GRAVITY_LPF_ALPHA * g.y + (1 - GRAVITY_LPF_ALPHA) * rawY;
      g.z = GRAVITY_LPF_ALPHA * g.z + (1 - GRAVITY_LPF_ALPHA) * rawZ;

      // Subtract gravity to isolate linear vehicle acceleration
      const linX = rawX - g.x;
      const linY = rawY - g.y;
      const linZ = rawZ - g.z;

      // Project 3D acceleration onto gravity direction to measure vertical drop
      const gMag = Math.sqrt(g.x ** 2 + g.y ** 2 + g.z ** 2) || 9.81;
      const gNormX = g.x / gMag;
      const gNormY = g.y / gMag;
      const gNormZ = g.z / gMag;

      const earthVerticalAccelMps2 = (linX * gNormX) + (linY * gNormY) + (linZ * gNormZ);
      const verticalDropG = Math.abs(earthVerticalAccelMps2) / 9.81;

      // Calculate total linear acceleration magnitude
      const linearMagnitudeMps2 = Math.sqrt(linX ** 2 + linY ** 2 + linZ ** 2);
      const magnitudeG = linearMagnitudeMps2 / 9.81;

      // Layer 4: Check gyroscope rotation rate to reject phone drops and handling
      let gyroMaxDegSec = 0;
      if (event.rotationRate) {
        let rotAlpha = Math.abs(event.rotationRate.alpha ?? 0);
        let rotBeta = Math.abs(event.rotationRate.beta ?? 0);
        let rotGamma = Math.abs(event.rotationRate.gamma ?? 0);

        const rawMax = Math.max(rotAlpha, rotBeta, rotGamma);

        // Normalize units to degrees per second if browser reports radians
        if (rawMax < Math.PI && rawMax > 0.001) {
          rotAlpha *= 180 / Math.PI;
          rotBeta *= 180 / Math.PI;
          rotGamma *= 180 / Math.PI;
        }

        gyroMaxDegSec = Math.max(rotAlpha, rotBeta, rotGamma);
      }

      // Layer 3: Track impact waveform duration
      if (magnitudeG >= MAGNITUDE_THRESHOLD) {
        lastBelowThresholdTimeRef.current = 0;

        if (!impactStartTimeRef.current) {
          impactStartTimeRef.current = now;
          peakMagnitudeRef.current = magnitudeG;
          peakGyroRef.current = gyroMaxDegSec;
          peakZDropRef.current = verticalDropG;
        } else {
          peakMagnitudeRef.current = Math.max(peakMagnitudeRef.current, magnitudeG);
          peakGyroRef.current = Math.max(peakGyroRef.current, gyroMaxDegSec);
          peakZDropRef.current = Math.max(peakZDropRef.current, verticalDropG);
        }
      } else if (impactStartTimeRef.current !== null) {
        if (lastBelowThresholdTimeRef.current === 0) {
          lastBelowThresholdTimeRef.current = now;
        } else if (now - lastBelowThresholdTimeRef.current >= HYSTERESIS_GRACE_PERIOD_MS) {
          const durationMs = lastBelowThresholdTimeRef.current - impactStartTimeRef.current;
          
          const peakGyro = peakGyroRef.current;
          const peakMag = peakMagnitudeRef.current;
          const peakZDrop = peakZDropRef.current;

          resetPeakRefs();

          // Reject if phone was tumbling (> 150 deg/s)
          if (peakGyro > GYRO_MAX_ROTATION_DEG) {
            return;
          }

          // Reject speed bumps (duration > 280ms)
          if (durationMs > SPEEDBUMP_MIN_DURATION_MS) {
            return;
          }

          // Confirm valid pothole impact (< 250ms duration)
          if (durationMs <= POTHOLE_MAX_DURATION_MS) {
            // Layer 5: Cooldown check between reports
            if (now - lastDetectionTimeRef.current < DEBOUNCE_COOLDOWN_MS) {
              return;
            }

            // Calculate confidence score (0-100%)
            let confidence = 50;
            if (peakMag > 3.5) confidence += 20;
            if (peakZDrop > 1.2) confidence += 15;
            if (durationMs < 180) confidence += 15;

            const finalConfidence = Math.min(99, confidence);

            if (finalConfidence >= CONFIDENCE_MIN_THRESHOLD) {
              lastDetectionTimeRef.current = now;

              const isFuzzy = typeof window !== 'undefined' && localStorage.getItem('nadi_locationprecision') === 'fuzzy';
              const latOffset = isFuzzy ? (Math.sin(gpsCoordsRef.current.lat * 1000) * 0.0035) + 0.001 : 0;
              const lngOffset = isFuzzy ? (Math.cos(gpsCoordsRef.current.lng * 1000) * 0.0035) + 0.001 : 0;
              const finalLat = Number((gpsCoordsRef.current.lat + latOffset).toFixed(5));
              const finalLng = Number((gpsCoordsRef.current.lng + lngOffset).toFixed(5));

              const anomalyEvent: SensorAnomalyEvent = {
                id: `POTHOLE-${Math.floor(now)}`,
                timestamp: Date.now(),
                latitude: finalLat,
                longitude: finalLng,
                lat: finalLat,
                lng: finalLng,
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

  // 3. Start/stop detection listeners and handle iOS device motion permissions
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

    detectorStartTimeRef.current = performance.now(); // Starts warm-up timer
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
