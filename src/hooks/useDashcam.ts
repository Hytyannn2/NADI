'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

// ============================================
// NADI Dashcam — Edge Computing Frame Capture
// ============================================
// Opens the rear camera at 720p and maintains a live stream.
// When triggered (pothole detected), captures a SINGLE frame
// from the video feed and returns it as base64.
//
// PRIVACY BY DESIGN:
// - No video is ever recorded or stored
// - Only the single frame at the moment of impact is captured
// - Frame + GPS coordinates are the only data that leaves the device
// - Stream is released when driving mode is stopped
// ============================================

interface UseDashcamReturn {
    isStreaming: boolean;
    isDashcamEnabled: boolean;
    enableDashcam: () => Promise<void>;
    disableDashcam: () => void;
    captureFrame: () => string | null; // Returns base64 JPEG or null
    videoRef: React.RefObject<HTMLVideoElement | null>;
    error: string | null;
}

export function useDashcam(): UseDashcamReturn {
    const [isStreaming, setIsStreaming] = useState(false);
    const [isDashcamEnabled, setIsDashcamEnabled] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Create a reusable canvas for frame capture (not added to DOM)
    useEffect(() => {
        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
        }
        return () => {
            // Cleanup stream on unmount
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };
    }, []);

    const enableDashcam = useCallback(async () => {
        setError(null);

        // Check if getUserMedia is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setError('Camera not supported in this browser.');
            return;
        }

        try {
            // Request rear camera at 720p (battery-friendly resolution)
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // rear camera
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });

            streamRef.current = stream;

            // Attach to video element if available
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(() => {
                    // Autoplay might be blocked, but that's OK — we just need the stream
                });
            }

            setIsStreaming(true);
            setIsDashcamEnabled(true);
        } catch (err: any) {
            if (err.name === 'NotAllowedError') {
                setError('Camera permission denied. Enable in browser settings.');
            } else if (err.name === 'NotFoundError') {
                setError('No rear camera found on this device.');
            } else {
                setError(`Camera error: ${err.message}`);
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
        setError(null);
    }, []);

    const captureFrame = useCallback((): string | null => {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video || !canvas || !streamRef.current) {
            return null;
        }

        // Check if video has valid dimensions
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            return null;
        }

        // Set canvas to video dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw the current video frame to canvas
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to base64 JPEG (quality 0.7 for reasonable size)
        // This is the ONLY data that leaves the device — a single frame
        try {
            const base64 = canvas.toDataURL('image/jpeg', 0.7);
            return base64;
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
        error,
    };
}
