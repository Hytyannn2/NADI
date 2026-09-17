/**
 * Global Voice Microphone Component
 * 
 * Provides high-fidelity dialect speech-to-text powered by Groq Whisper Large-v3
 * with authentic Kelantanese phonetic priming, coupled with real-time interim preview,
 * acoustic silence detection (VAD), and anti-hallucination protection.
 */
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { isWhisperHallucination } from '@/src/lib/speech/whisperHallucinations';

interface GlobalVoiceMicProps {
    /** Callback fired with the transcribed text */
    onTranscript: (text: string) => void;
    /** Optional: control size */
    size?: 'sm' | 'md' | 'lg';
    /** Optional: custom class */
    className?: string;
    /** Optional: inline mode (no floating animation) */
    inline?: boolean;
    /** Current text in the input before recording begins */
    currentText?: string;
}

export default function GlobalVoiceMic({ onTranscript, currentText = '', size = 'md', className = '', inline = false }: GlobalVoiceMicProps) {
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [interimText, setInterimText] = useState('');
    const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
    
    const recognitionRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const volumeIntervalRef = useRef<any>(null);
    const maxVolumeRef = useRef<number>(0);
    const recordStartRef = useRef<number>(0);
    const finalWebSpeechRef = useRef('');
    const baseTextRef = useRef('');

    const showTemporaryNotice = useCallback((msg: string) => {
        setFeedbackNotice(msg);
        setTimeout(() => {
            setFeedbackNotice((current) => (current === msg ? null : current));
        }, 2800);
    }, []);

    const emitTranscript = useCallback((speechText: string) => {
        const trimmed = speechText.trim();
        if (!trimmed || isWhisperHallucination(trimmed)) return;
        const result = baseTextRef.current ? `${baseTextRef.current} ${trimmed}` : trimmed;
        onTranscript(result);
    }, [onTranscript]);

    const sizeMap = {
        sm: { button: 'w-8 h-8', icon: 'w-3.5 h-3.5', ring: 'w-10 h-10' },
        md: { button: 'w-10 h-10', icon: 'w-4.5 h-4.5', ring: 'w-12 h-12' },
        lg: { button: 'w-14 h-14', icon: 'w-6 h-6', ring: 'w-16 h-16' },
    };

    const s = sizeMap[size];

    // Cleanly stops all active microphone streams, tracks, and audio analysis contexts
    const releaseMediaStream = useCallback(() => {
        if (volumeIntervalRef.current) {
            clearInterval(volumeIntervalRef.current);
            volumeIntervalRef.current = null;
        }
        if (audioContextRef.current) {
            try { audioContextRef.current.close(); } catch {}
            audioContextRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => {
                try { track.stop(); } catch {}
            });
            mediaStreamRef.current = null;
        }
    }, []);

    const stopListening = useCallback(() => {
        setIsListening(false);
        setInterimText('');

        // 1. Stop Web Speech API preview
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch {}
        }

        // 2. Stop MediaRecorder (triggers data sending to Whisper)
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try {
                mediaRecorderRef.current.stop();
            } catch (err) {
                console.warn('MediaRecorder stop error:', err);
                releaseMediaStream();
            }
        } else {
            releaseMediaStream();
        }
    }, [releaseMediaStream]);

    const startListening = useCallback(async () => {
        if (typeof window === 'undefined') return;

        baseTextRef.current = currentText ? currentText.trim() : '';
        finalWebSpeechRef.current = '';
        audioChunksRef.current = [];
        setInterimText('');
        setFeedbackNotice(null);
        maxVolumeRef.current = 0;
        recordStartRef.current = Date.now();

        // 1. Initialize High-Fidelity Audio Recording (MediaRecorder) with VAD energy metering
        let stream: MediaStream | null = null;
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    }
                });
                mediaStreamRef.current = stream;

                // Setup Web Audio VAD energy tracker to detect human speech vs pure silence
                try {
                    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                    if (AudioContextClass) {
                        const actx = new AudioContextClass();
                        if (actx.state === 'suspended') {
                            actx.resume().catch(() => {});
                        }
                        const analyser = actx.createAnalyser();
                        analyser.fftSize = 256;
                        const src = actx.createMediaStreamSource(stream);
                        src.connect(analyser);

                        audioContextRef.current = actx;
                        const dataArray = new Uint8Array(analyser.frequencyBinCount);

                        volumeIntervalRef.current = setInterval(() => {
                            analyser.getByteFrequencyData(dataArray);
                            let sum = 0;
                            for (let i = 0; i < dataArray.length; i++) {
                                sum += dataArray[i];
                            }
                            const avg = sum / dataArray.length;
                            if (avg > maxVolumeRef.current) {
                                maxVolumeRef.current = avg;
                            }
                        }, 100);
                    }
                } catch (audioErr) {
                    console.warn('[GlobalVoiceMic] Audio energy analyzer warning:', audioErr);
                }

                // Pick optimal supported MIME type
                let mimeType = 'audio/webm;codecs=opus';
                if (typeof MediaRecorder !== 'undefined') {
                    if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                        if (MediaRecorder.isTypeSupported('audio/mp4')) {
                            mimeType = 'audio/mp4';
                        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                            mimeType = 'audio/webm';
                        } else {
                            mimeType = '';
                        }
                    }

                    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
                    mediaRecorderRef.current = recorder;

                    recorder.ondataavailable = (e) => {
                        if (e.data && e.data.size > 0) {
                            audioChunksRef.current.push(e.data);
                        }
                    };

                    recorder.onstop = async () => {
                        const durationMs = Date.now() - recordStartRef.current;
                        const maxVol = maxVolumeRef.current;
                        releaseMediaStream();

                        const chunks = audioChunksRef.current;
                        const hasWebSpeech = Boolean(finalWebSpeechRef.current.trim() && !isWhisperHallucination(finalWebSpeechRef.current));
                        
                        // Guard against accidental taps (<500ms) or flatline silent audio (no voice detected)
                        const isSilence = maxVol < 7 && !hasWebSpeech;

                        if (chunks.length === 0 || durationMs < 450 || isSilence) {
                            setIsProcessing(false);
                            if (hasWebSpeech) {
                                emitTranscript(finalWebSpeechRef.current.trim());
                            } else {
                                showTemporaryNotice('Tiada suara dikesan');
                            }
                            return;
                        }

                        setIsProcessing(true);
                        const effectiveMime = recorder.mimeType || 'audio/webm';
                        const audioBlob = new Blob(chunks, { type: effectiveMime });
                        const extension = effectiveMime.includes('mp4') ? 'mp4' : 'webm';

                        try {
                            const formData = new FormData();
                            formData.append('file', audioBlob, `suara_${Date.now()}.${extension}`);

                            const res = await fetch('/api/suara/transcribe', {
                                method: 'POST',
                                body: formData,
                            });

                            const data = await res.json();
                            const transcriptText = data.text ? data.text.trim() : '';

                            if (data.success && transcriptText && !isWhisperHallucination(transcriptText)) {
                                emitTranscript(transcriptText);
                            } else if (data.isSilence || !transcriptText || isWhisperHallucination(transcriptText)) {
                                // Silent input or filtered hallucination -> do not emit, explain kindly to user
                                if (hasWebSpeech) {
                                    emitTranscript(finalWebSpeechRef.current.trim());
                                } else {
                                    showTemporaryNotice('Tiada suara dikesan');
                                }
                            } else if (hasWebSpeech) {
                                emitTranscript(finalWebSpeechRef.current.trim());
                            }
                        } catch (err) {
                            console.warn('[GlobalVoiceMic] Whisper transcribe failed, using fallback:', err);
                            if (hasWebSpeech) {
                                emitTranscript(finalWebSpeechRef.current.trim());
                            } else {
                                showTemporaryNotice('Gagal memproses audio');
                            }
                        } finally {
                            setIsProcessing(false);
                        }
                    };

                    recorder.start(250); // Collect slices every 250ms
                }
            }
        } catch (err: any) {
            console.warn('[GlobalVoiceMic] Microphone access error:', err?.message || err);
            // If user explicitly denied mic permission or hardware unavailable
            if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
                alert('Sila benarkan akses mikrofon pada pelayar untuk menggunakan fungsi suara NADI.');
                return;
            }
        }

        // 2. Parallel Web Speech API for real-time live interim preview
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            try {
                const recognition = new SpeechRecognition();
                recognition.lang = 'ms-MY';
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.maxAlternatives = 1;

                recognition.onstart = () => {
                    setIsListening(true);
                    setIsProcessing(false);
                };

                recognition.onresult = (event: any) => {
                    let interim = '';
                    let final = '';
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcript = event.results[i][0].transcript;
                        if (event.results[i].isFinal) {
                            final += transcript;
                        } else {
                            interim += transcript;
                        }
                    }
                    if (final && !isWhisperHallucination(final)) {
                        finalWebSpeechRef.current += (finalWebSpeechRef.current ? ' ' : '') + final;
                        // Provide real-time live typing feedback
                        emitTranscript(finalWebSpeechRef.current);
                    }
                    setInterimText(interim);
                };

                recognition.onerror = (event: any) => {
                    if (event.error !== 'aborted') {
                        console.info('Speech recognition interim warning:', event.error);
                    }
                };

                recognition.onend = () => {
                    // Handled when user toggles off
                };

                recognitionRef.current = recognition;
                recognition.start();
            } catch (recErr) {
                console.warn('SpeechRecognition interim error:', recErr);
            }
        }

        setIsListening(true);
    }, [currentText, emitTranscript, releaseMediaStream, showTemporaryNotice]);

    const toggleListening = useCallback(() => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }, [isListening, startListening, stopListening]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch {}
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                try { mediaRecorderRef.current.stop(); } catch {}
            }
            releaseMediaStream();
        };
    }, [releaseMediaStream]);

    return (
        <div className={`relative inline-flex items-center justify-center ${className}`}>
            {/* Pulse ring when listening */}
            <AnimatePresence>
                {isListening && !inline && (
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                        className={`absolute ${s.ring} rounded-full`}
                        style={{ background: 'var(--danger, #EF4444)', opacity: 0.2 }}
                    />
                )}
            </AnimatePresence>

            <button
                type="button"
                aria-label={isListening ? 'Henti rakaman suara' : 'Mula rakaman suara'}
                onClick={toggleListening}
                disabled={isProcessing}
                className={`${s.button} rounded-full flex items-center justify-center transition-all relative z-10 ${
                    isListening
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30 ring-2 ring-red-500/30'
                        : isProcessing
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-wait'
                        : 'hover:bg-[var(--bg-subtle)] border border-transparent hover:border-zinc-700/80 text-zinc-400 hover:text-zinc-200'
                }`}
                style={!isListening && !isProcessing ? { color: 'var(--text-muted)' } : {}}
                title={isListening ? 'Ketik untuk berhenti merakam' : 'Rakam suara (Dialek Kelantan didorong AI)'}
            >
                {isProcessing ? (
                    <Loader2 className={`${s.icon} animate-spin text-amber-400`} />
                ) : isListening ? (
                    <MicOff className={`${s.icon} animate-pulse text-red-400`} />
                ) : (
                    <Mic className={s.icon} />
                )}
            </button>

            {/* Elevated Status & Transcription Tooltip (Positioned safely above button so never clipped by overflow-hidden) */}
            <AnimatePresence>
                {/* 1. Live interim speech / recording status */}
                {isListening && !inline && (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="absolute bottom-full mb-3 right-0 sm:left-1/2 sm:-translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-xl text-[11px] font-bold z-40 shadow-2xl bg-red-950/95 text-red-300 border border-red-500/40 flex items-center gap-2 backdrop-blur-md pointer-events-none"
                    >
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                        <span className="max-w-[210px] sm:max-w-[280px] truncate">
                            {interimText ? interimText : 'Mendengar... bercakap sekarang'}
                        </span>
                    </motion.div>
                )}

                {/* 2. Processing / Whisper AI transcription status */}
                {isProcessing && !inline && (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="absolute bottom-full mb-3 right-0 sm:left-1/2 sm:-translate-x-1/2 whitespace-nowrap px-3.5 py-1.5 rounded-xl text-[11px] font-bold z-40 shadow-2xl bg-amber-950/95 text-amber-300 border border-amber-500/40 flex items-center gap-2 backdrop-blur-md pointer-events-none"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                        <span>Mengecam suara (Dialek Kelantan)...</span>
                    </motion.div>
                )}

                {/* 3. Feedback notification notice (e.g. Tiada suara dikesan) */}
                {!isListening && !isProcessing && feedbackNotice && !inline && (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="absolute bottom-full mb-3 right-0 sm:left-1/2 sm:-translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-xl text-[11px] font-bold z-40 shadow-2xl bg-zinc-900/95 text-zinc-300 border border-zinc-700/80 flex items-center gap-1.5 backdrop-blur-md pointer-events-none"
                    >
                        <span className="text-amber-400 text-xs">ℹ️</span>
                        <span>{feedbackNotice}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
