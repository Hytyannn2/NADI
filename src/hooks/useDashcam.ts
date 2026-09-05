'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Dashcam Video Stream & Snapshot Capture Hook
 *
 * Streams rear camera video and captures snapshots when potholes are detected.
 * Applies a client-side privacy blur on the top 40% of each frame (to mask sky,
 * oncoming vehicles, and license plates) before uploading.
 */

interface UseDashcamReturn {
  isStreaming: boolean;
  isDashcamEnabled: boolean;
  enableDashcam: () => Promise<void>;
  disableDashcam: () => void;
  captureFrame: () => string | null; // Returns base64 JPEG or null
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function useDashcam(): UseDashcamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDashcamEnabled, setIsDashcamEnabled] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Hidden canvas for frame snapshots and background tab power saving
  useEffect(() => {
    if (!canvasRef.current && typeof document !== 'undefined') {
      canvasRef.current = document.createElement('canvas');
    }

    // Disables video track when the tab is hidden to conserve device battery
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
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return;
    }

    try {
      // Request rear camera stream at 720p 30fps
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

      // Detect hardware features like continuous autofocus
      if (track && typeof (track as any).getCapabilities === 'function') {
        const capabilities = (track as any).getCapabilities();
        const advancedConstraints: any[] = [];
        if (capabilities && 'focusMode' in capabilities && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
          advancedConstraints.push({ focusMode: 'continuous' });
        }
        if (advancedConstraints.length > 0) {
          try {
            await track.applyConstraints({ advanced: advancedConstraints } as any);
          } catch {
            // Ignore constraint errors if browser restricts focus controls
          }
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      setIsStreaming(true);
      setIsDashcamEnabled(true);
    } catch {
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
  }, []);

  // Captures the current video frame and blurs the upper 40% for privacy
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

    // Draw raw video frame
    ctx.drawImage(video, 0, 0, vWidth, vHeight);

    // Apply 24px blur to the upper 40% region to mask faces and plates
    const topMaskHeight = vHeight * 0.4;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, vWidth, topMaskHeight);
    ctx.clip();
    ctx.filter = 'blur(24px)';
    ctx.drawImage(video, 0, 0, vWidth, vHeight);
    ctx.restore();
    ctx.filter = 'none';

    try {
      const base64Full = canvas.toDataURL('image/jpeg', 0.75);
      return base64Full.replace(/^data:image\/jpeg;base64,/, '');
    } catch {
      return null;
    }
  }, []);

  return {
    isStreaming,
    isDashcamEnabled,
    enableDashcam,
    disableDashcam,
    captureFrame,
    videoRef,
  };
}
