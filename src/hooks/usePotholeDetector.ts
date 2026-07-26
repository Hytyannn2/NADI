'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================
// NADI Pothole Detector — Sensor Fusion Engine
// ============================================
// Uses 4 filters + gravity calibration to eliminate false positives:
//   1. Speed Gate (10-120 km/h from GPS)
//   2. Waveform Signature (duration-based pothole vs speedbump)
//   3. Gyroscope Stability (rejects phone drops/tumbles)
//   4. Debounce (3s cooldown prevents duplicate reports)
//
// Also performs 3-second gravity baseline calibration on start
// to handle phones mounted at any angle.
// ============================================

export interface PotholeDetection {
    id: string;
    lat: number;
    lng: number;
    zDrop: number;
    speedKmh: number;
    gyroMaxRotation: number;
    waveformDurationMs: number;
    confidenceScore: number;
    timestamp: number;
}

interface CalibrationState {
    isCalibrating: boolean;
    progress: number; // 0-100
    baselineZ: number;
    samples: number[];
}

interface UsePotholeDetectorReturn {
    isActive: boolean;
    isCalibrating: boolean;
    calibrationProgress: number;
    currentSpeed: number;
    lastDetection: PotholeDetection | null;
    detectionCount: number;
    startDriving: () => void;
    stopDriving: () => void;
    motionError: string | null;
    userLat: number;
    userLng: number;
}

// --- Config ---
const SPEED_MIN_KMH = 10;
const SPEED_MAX_KMH = 120;
const Z_DROP_THRESHOLD = -3.0;          // g-force threshold (after baseline subtraction)
const WAVEFORM_BUFFER_MS = 500;         // rolling buffer window
const POTHOLE_MAX_DURATION_MS = 200;    // pothole waveform completes in <200ms
const GYRO_MAX_ROTATION = 150;          // deg/s — above this = phone tumbling
const DEBOUNCE_MS = 3000;               // 3 second cooldown between detections
const CALIBRATION_DURATION_MS = 3000;   // 3 seconds of baseline sampling
const CALIBRATION_SAMPLE_RATE = 50;     // sample every ~50ms during calibration
const CONFIDENCE_THRESHOLD = 60;        // minimum confidence to report

// Confidence scoring weights
const SCORE_SPEED = 25;
const SCORE_WAVEFORM = 30;
const SCORE_GYRO = 25;
const SCORE_MAGNITUDE = 20;

export function usePotholeDetector(): UsePotholeDetectorReturn {
    const [isActive, setIsActive] = useState(false);
    const [currentSpeed, setCurrentSpeed] = useState(0);
    const [lastDetection, setLastDetection] = useState<PotholeDetection | null>(null);
    const [detectionCount, setDetectionCount] = useState(0);
    const [motionError, setMotionError] = useState<string | null>(null);
    const [userLat, setUserLat] = useState(0);
    const [userLng, setUserLng] = useState(0);
    const [calibration, setCalibration] = useState<CalibrationState>({
        isCalibrating: false,
        progress: 0,
        baselineZ: 9.8, // default gravity
        samples: [],
    });

    // Refs for values that change rapidly (avoid stale closures)
    const speedRef = useRef(0);
    const latRef = useRef(0);
    const lngRef = useRef(0);
    const baselineZRef = useRef(9.8);
    const lastDetectionTimeRef = useRef(0);
    const isActiveRef = useRef(false);
    const isCalibratingRef = useRef(false);
    const calibrationSamplesRef = useRef<number[]>([]);
    const calibrationStartRef = useRef(0);

    // Rolling Z-axis waveform buffer: { timestamp, value }
    const waveformBufferRef = useRef<{ t: number; z: number }[]>([]);

    // Track the latest gyroscope rotation rates
    const gyroRef = useRef({ alpha: 0, beta: 0, gamma: 0 });

    // Detection callback — will be set by the consumer
    const onDetectionRef = useRef<((detection: PotholeDetection) => void) | null>(null);

    // GPS speed calculation from position deltas
    const lastPosRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

    const calculateSpeed = useCallback((lat: number, lng: number) => {
        const now = Date.now();
        const last = lastPosRef.current;
        if (last) {
            const dt = (now - last.time) / 1000; // seconds
            if (dt > 0.5 && dt < 10) { // reasonable time delta
                const dLat = lat - last.lat;
                const dLng = lng - last.lng;
                // Haversine approximation for short distances
                const R = 6371000; // Earth radius in meters
                const dLatRad = dLat * (Math.PI / 180);
                const dLngRad = dLng * (Math.PI / 180);
                const a = Math.sin(dLatRad / 2) ** 2 +
                    Math.cos(last.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
                    Math.sin(dLngRad / 2) ** 2;
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distMeters = R * c;
                const speedMs = distMeters / dt;
                const speedKmh = speedMs * 3.6;
                // Smooth the speed reading (exponential moving average)
                const smoothed = speedRef.current * 0.6 + speedKmh * 0.4;
                speedRef.current = smoothed;
                setCurrentSpeed(Math.round(smoothed));
            }
        }
        lastPosRef.current = { lat, lng, time: now };
    }, []);

    // Calculate confidence score for a detection
    const calculateConfidence = useCallback((
        speedKmh: number,
        waveformDurationMs: number,
        gyroMaxRotation: number,
        zDrop: number,
    ): number => {
        let score = 0;

        // Speed within valid range: +25
        if (speedKmh >= SPEED_MIN_KMH && speedKmh <= SPEED_MAX_KMH) {
            score += SCORE_SPEED;
        } else if (speedKmh >= 5) {
            score += SCORE_SPEED * 0.5; // partial credit for slow but moving
        }

        // Waveform signature matches pothole: +30
        if (waveformDurationMs > 0 && waveformDurationMs <= POTHOLE_MAX_DURATION_MS) {
            // Shorter, sharper = higher confidence
            const waveformRatio = 1 - (waveformDurationMs / POTHOLE_MAX_DURATION_MS);
            score += SCORE_WAVEFORM * (0.5 + waveformRatio * 0.5);
        } else if (waveformDurationMs > POTHOLE_MAX_DURATION_MS && waveformDurationMs < 400) {
            score += SCORE_WAVEFORM * 0.3; // partial — could be a rough patch
        }

        // Gyroscope stable (phone not tumbling): +25
        if (gyroMaxRotation < GYRO_MAX_ROTATION * 0.5) {
            score += SCORE_GYRO; // very stable
        } else if (gyroMaxRotation < GYRO_MAX_ROTATION) {
            score += SCORE_GYRO * 0.6; // somewhat stable
        }
        // if > threshold, no points (likely phone drop)

        // Z-drop magnitude: +20 (scaled)
        const absZ = Math.abs(zDrop);
        if (absZ >= 6) {
            score += SCORE_MAGNITUDE; // very severe
        } else if (absZ >= 4) {
            score += SCORE_MAGNITUDE * 0.8;
        } else if (absZ >= 3) {
            score += SCORE_MAGNITUDE * 0.5;
        }

        return Math.round(Math.min(100, score));
    }, []);

    // Analyze waveform buffer to determine pothole vs speedbump
    const analyzeWaveform = useCallback((): { isPothole: boolean; durationMs: number } => {
        const buffer = waveformBufferRef.current;
        if (buffer.length < 3) return { isPothole: false, durationMs: 0 };

        // Find the negative peak (minimum Z)
        let minZ = Infinity;
        let minIdx = 0;
        for (let i = 0; i < buffer.length; i++) {
            if (buffer[i].z < minZ) {
                minZ = buffer[i].z;
                minIdx = i;
            }
        }

        // Find the positive recovery peak after the negative dip
        let maxZ = -Infinity;
        let maxIdx = minIdx;
        for (let i = minIdx; i < buffer.length; i++) {
            if (buffer[i].z > maxZ) {
                maxZ = buffer[i].z;
                maxIdx = i;
            }
        }

        // Duration = time between negative dip and positive recovery
        const durationMs = maxIdx > minIdx ? buffer[maxIdx].t - buffer[minIdx].t : 0;

        // Pothole: sharp dip → recovery in <200ms
        // Speedbump: gradual rise → fall over >300ms
        const isPothole = durationMs > 0 && durationMs <= POTHOLE_MAX_DURATION_MS;

        return { isPothole, durationMs };
    }, []);

    // --- Start / Stop driving ---
    const startDriving = useCallback(() => {
        isActiveRef.current = true;
        isCalibratingRef.current = true;
        calibrationSamplesRef.current = [];
        calibrationStartRef.current = Date.now();
        setIsActive(true);
        setCalibration({
            isCalibrating: true,
            progress: 0,
            baselineZ: 9.8,
            samples: [],
        });
        setMotionError(null);
        lastPosRef.current = null;
        speedRef.current = 0;
        setCurrentSpeed(0);
    }, []);

    const stopDriving = useCallback(() => {
        isActiveRef.current = false;
        isCalibratingRef.current = false;
        setIsActive(false);
        setCalibration(prev => ({ ...prev, isCalibrating: false, progress: 0 }));
        speedRef.current = 0;
        setCurrentSpeed(0);
        lastPosRef.current = null;
        waveformBufferRef.current = [];
    }, []);

    // --- Main sensor effect ---
    useEffect(() => {
        if (!isActive) return;

        let watchId: number | null = null;

        // GPS position tracking
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const lat = parseFloat(pos.coords.latitude.toFixed(6));
                    const lng = parseFloat(pos.coords.longitude.toFixed(6));
                    latRef.current = lat;
                    lngRef.current = lng;
                    setUserLat(lat);
                    setUserLng(lng);
                    calculateSpeed(lat, lng);
                },
                () => { /* GPS error — continue with last known position */ },
                { enableHighAccuracy: true, maximumAge: 1000 }
            );
        }

        // DeviceMotion handler
        const handleMotion = (event: DeviceMotionEvent) => {
            const accel = event.accelerationIncludingGravity;
            const rotation = event.rotationRate;
            if (!accel || accel.z === null) return;

            const rawZ = accel.z ?? 0;
            const now = Date.now();

            // --- Calibration Phase ---
            if (isCalibratingRef.current) {
                calibrationSamplesRef.current.push(rawZ);
                const elapsed = now - calibrationStartRef.current;
                const progress = Math.min(100, (elapsed / CALIBRATION_DURATION_MS) * 100);

                setCalibration(prev => ({ ...prev, progress }));

                if (elapsed >= CALIBRATION_DURATION_MS) {
                    // Calculate baseline: average Z during calibration
                    const samples = calibrationSamplesRef.current;
                    const avgZ = samples.reduce((a, b) => a + b, 0) / samples.length;
                    baselineZRef.current = avgZ;
                    isCalibratingRef.current = false;
                    setCalibration({
                        isCalibrating: false,
                        progress: 100,
                        baselineZ: avgZ,
                        samples: [],
                    });
                }
                return; // Don't process detections during calibration
            }

            // --- Detection Phase ---
            // Track gyroscope
            if (rotation) {
                gyroRef.current = {
                    alpha: Math.abs(rotation.alpha ?? 0),
                    beta: Math.abs(rotation.beta ?? 0),
                    gamma: Math.abs(rotation.gamma ?? 0),
                };
            }

            // Subtract baseline gravity to normalize for phone angle
            const normalizedZ = rawZ - baselineZRef.current;

            // Add to rolling waveform buffer
            waveformBufferRef.current.push({ t: now, z: normalizedZ });
            // Prune old entries outside the buffer window
            waveformBufferRef.current = waveformBufferRef.current.filter(
                entry => now - entry.t < WAVEFORM_BUFFER_MS
            );

            // --- Filter 1: Z-axis threshold ---
            if (normalizedZ > Z_DROP_THRESHOLD) return; // No spike detected

            // --- Filter 2: Debounce ---
            if (now - lastDetectionTimeRef.current < DEBOUNCE_MS) return;

            // --- Filter 3: Speed Gate ---
            const speed = speedRef.current;
            if (speed < SPEED_MIN_KMH || speed > SPEED_MAX_KMH) {
                // Still allow if speed data is unavailable (GPS might be slow)
                // but only if we have GPS lock (lat/lng != 0)
                if (latRef.current !== 0 && lngRef.current !== 0 && speed > 0) {
                    return; // Definitely outside range
                }
                // If no speed data yet, allow with reduced confidence
            }

            // --- Filter 4: Waveform Analysis ---
            const { isPothole, durationMs } = analyzeWaveform();

            // --- Filter 5: Gyroscope Stability ---
            const maxGyro = Math.max(
                gyroRef.current.alpha,
                gyroRef.current.beta,
                gyroRef.current.gamma
            );

            // Phone is clearly tumbling — reject
            if (maxGyro > GYRO_MAX_ROTATION * 1.5) return;

            // --- Calculate Confidence Score ---
            const confidence = calculateConfidence(
                speed,
                durationMs,
                maxGyro,
                normalizedZ
            );

            // --- Minimum confidence gate ---
            if (confidence < CONFIDENCE_THRESHOLD) return;

            // === DETECTION CONFIRMED ===
            lastDetectionTimeRef.current = now;

            const detection: PotholeDetection = {
                id: `det_${now}_${Math.random().toString(36).slice(2, 6)}`,
                lat: latRef.current,
                lng: lngRef.current,
                zDrop: parseFloat(normalizedZ.toFixed(2)),
                speedKmh: Math.round(speed),
                gyroMaxRotation: parseFloat(maxGyro.toFixed(1)),
                waveformDurationMs: durationMs,
                confidenceScore: confidence,
                timestamp: now,
            };

            setLastDetection(detection);
            setDetectionCount(prev => prev + 1);

            // Notify consumer
            if (onDetectionRef.current) {
                onDetectionRef.current(detection);
            }
        };

        // --- Request motion permission (iOS 13+) ---
        const startListening = () => {
            window.addEventListener('devicemotion', handleMotion);
            setMotionError(null);
        };

        if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
            (DeviceMotionEvent as any).requestPermission()
                .then((state: string) => {
                    if (state === 'granted') startListening();
                    else setMotionError('Motion permission denied. Grant access in iOS Settings.');
                })
                .catch(() => setMotionError('Motion permission request failed.'));
        } else if (window.DeviceMotionEvent) {
            startListening();
        } else {
            setMotionError('DeviceMotion not supported on this device/browser.');
        }

        return () => {
            window.removeEventListener('devicemotion', handleMotion);
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        };
    }, [isActive, calculateSpeed, analyzeWaveform, calculateConfidence]);

    return {
        isActive,
        isCalibrating: calibration.isCalibrating,
        calibrationProgress: calibration.progress,
        currentSpeed,
        lastDetection,
        detectionCount,
        startDriving,
        stopDriving,
        motionError,
        userLat,
        userLng,
    };
}

// Export the onDetection setter for InfraView to subscribe
export function setOnDetection(
    hook: UsePotholeDetectorReturn,
    callback: (detection: PotholeDetection) => void
) {
    // This is a workaround — in InfraView we'll use useEffect to watch lastDetection instead
    // This export exists for documentation purposes
}
