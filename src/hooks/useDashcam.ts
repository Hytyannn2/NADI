'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ============================================
// NADI Dashcam — Edge Computing Frame Capture & AI Vision
// ============================================
// Opens the rear camera at 720p/1080p and maintains a continuous live stream.
// When triggered (pothole detected), captures a SINGLE frame in the background
// without interrupting the camera recording session.
//
// PRIVACY BY DESIGN (PDPA 2010 COMPLIANT):
// - Client-side Canvas Privacy Blur applied BEFORE transmission
// - Top 40% (sky, oncoming cars, license plates) heavily blurred
// - Automatic background AI parsing + Supabase DB persistence
// ============================================

export interface VisionAnalysisResult {
  damageType: string;
  visualSeverity: number;
  estimatedDimensions: string;
  estimatedDiameterCm?: number;
  estimatedAreaM2?: number;
  estimatedDepthCm?: number;
  surfaceMaterial: string;
  waterPresent: boolean;
  vegetationEncroachment: boolean;
  description: string;
  repairRecommendation: string;
  estimatedCostMYR: string;
  urgency: string;
}

export interface BackgroundAnomalyPayload {
  anomalyId: string;
  lat: number;
  lng: number;
  magnitudeG: number;
  zDrop: number;
  speedKmh: number;
}

interface UseDashcamReturn {
  isStreaming: boolean;
  isDashcamEnabled: boolean;
  isTorchOn: boolean;
  torchSupported: boolean;
  isProcessingBgFrame: boolean;
  lastVisionResult: VisionAnalysisResult | null;
  enableDashcam: () => Promise<void>;
  disableDashcam: () => void;
  toggleTorch: () => Promise<boolean>;
  captureFrame: () => string | null; // Returns base64 JPEG or null
  captureAndAnalyzeBackground: (payload: BackgroundAnomalyPayload) => Promise<VisionAnalysisResult | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  error: string | null;
}

export function useDashcam(): UseDashcamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDashcamEnabled, setIsDashcamEnabled] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [isProcessingBgFrame, setIsProcessingBgFrame] = useState(false);
  const [lastVisionResult, setLastVisionResult] = useState<VisionAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Reusable canvas for frame capture
  useEffect(() => {
    if (!canvasRef.current && typeof document !== 'undefined') {
      canvasRef.current = document.createElement('canvas');
    }

    // Page Visibility API: Auto-pause tracks when app goes to background to save battery
    const handleVisibilityChange = () => {
      if (document.hidden && streamRef.current) {
        streamRef.current.getVideoTracks().forEach(track => { track.enabled = false; });
      } else if (!document.hidden && streamRef.current) {
        streamRef.current.getVideoTracks().forEach(track => { track.enabled = true; });
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const enableDashcam = useCallback(async () => {
    setError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Kamera tidak disokong oleh pelayar ini.');
      return;
    }

    try {
      // Request rear camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];

      // Safe Capability Detection for Torch/Focus Controls (Prevents iOS Safari crashes)
      if (track && typeof (track as any).getCapabilities === 'function') {
        const capabilities = (track as any).getCapabilities();
        if (capabilities && 'torch' in capabilities) {
          setTorchSupported(true);
        }

        const advancedConstraints: any[] = [];
        if (capabilities && 'focusMode' in capabilities && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
          advancedConstraints.push({ focusMode: 'continuous' });
        }
        if (advancedConstraints.length > 0) {
          try {
            await track.applyConstraints({ advanced: advancedConstraints } as any);
          } catch {
            // Ignore constraint errors on restrictive WebKit implementations
          }
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      setIsStreaming(true);
      setIsDashcamEnabled(true);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Kebenaran kamera ditolak. Sila benarkan di tetapan pelayar.');
      } else if (err.name === 'NotFoundError') {
        setError('Tiada kamera belakang ditemui pada peranti ini.');
      } else {
        setError(`Ralat kamera: ${err.message}`);
      }
      setIsDashcamEnabled(false);
    }
  }, []);

  const disableDashcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setIsDashcamEnabled(false);
    setIsTorchOn(false);
    setError(null);
  }, []);

  // Rear LED Flashlight / Torch Toggle Handler (For night driving on rural roads)
  const toggleTorch = useCallback(async (): Promise<boolean> => {
    if (!streamRef.current) return false;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return false;

    try {
      const capabilities = typeof (track as any).getCapabilities === 'function' ? (track as any).getCapabilities() : {};
      if (!capabilities || !('torch' in capabilities)) {
        setError('Lampu imbas (Torch) tidak disokong peranti ini.');
        return false;
      }

      const nextState = !isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextState }] as any,
      });
      setIsTorchOn(nextState);
      return nextState;
    } catch (e: any) {
      console.warn('Failed to toggle torch:', e.message);
      return false;
    }
  }, [isTorchOn]);

  // PDPA 2010 COMPLIANT: Client-Side Privacy Masking Frame Capture
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !streamRef.current) {
      return null;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;

    canvas.width = vWidth;
    canvas.height = vHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw full raw video frame (unblurred base)
    ctx.drawImage(video, 0, 0, vWidth, vHeight);

    // PDPA PRIVACY BLUR MASK: Safe Clipping Path (Prevents iOS Safari black-screen feedback artifacts)
    const topMaskHeight = vHeight * 0.4;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, vWidth, topMaskHeight);
    ctx.clip(); // Isolate the top 40% region
    ctx.filter = 'blur(24px)';
    ctx.drawImage(video, 0, 0, vWidth, vHeight); // Redraw video element into clipped region
    ctx.restore();
    ctx.filter = 'none'; // Reset filter for road surface

    try {
      const base64Full = canvas.toDataURL('image/jpeg', 0.75);
      return base64Full.replace(/^data:image\/jpeg;base64,/, '');
    } catch {
      return null;
    }
  }, []);

  // Asynchronous Background Frame Capture & Vision AI Processing Pipeline
  const captureAndAnalyzeBackground = useCallback(
    async (payload: BackgroundAnomalyPayload): Promise<VisionAnalysisResult | null> => {
      const imageBase64 = captureFrame();
      if (!imageBase64) return null;

      setIsProcessingBgFrame(true);
      try {
        const res = await fetch('/api/infra/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64,
            lat: payload.lat,
            lng: payload.lng,
            zDropped: payload.zDrop,
            anomalyId: payload.anomalyId,
            speedKmh: payload.speedKmh,
            magnitudeG: payload.magnitudeG,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.analysis) {
            setLastVisionResult(json.analysis);
            return json.analysis as VisionAnalysisResult;
          }
        }
      } catch (err) {
        console.warn('Background vision processing error:', err);
      } finally {
        setIsProcessingBgFrame(false);
      }
      return null;
    },
    [captureFrame]
  );

  return {
    isStreaming,
    isDashcamEnabled,
    isTorchOn,
    torchSupported,
    isProcessingBgFrame,
    lastVisionResult,
    enableDashcam,
    disableDashcam,
    toggleTorch,
    captureFrame,
    captureAndAnalyzeBackground,
    videoRef,
    error,
  };
}
