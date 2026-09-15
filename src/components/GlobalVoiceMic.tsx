/**
 * Global Voice Microphone Component
 * 
 * Provides high-fidelity dialect speech-to-text powered by Groq Whisper Large-v3
 * with authentic Kelantanese phonetic priming, coupled with real-time interim preview.
 */
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
    
    const recognitionRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const finalWebSpeechRef = useRef('');
    const baseTextRef = useRef('');

    const emitTranscript = useCallback((speechText: string) => {
        const trimmed = speechText.trim();
        if (!trimmed) return;
        const result = baseTextRef.current ? `${baseTextRef.current} ${trimmed}` : trimmed;
        onTranscript(result);
    }, [onTranscript]);

    const sizeMap = {
        sm: { button: 'w-8 h-8', icon: 'w-3.5 h-3.5', ring: 'w-10 h-10' },
        md: { button: 'w-10 h-10', icon: 'w-4.5 h-4.5', ring: 'w-12 h-12' },
        lg: { button: 'w-14 h-14', icon: 'w-6 h-6', ring: 'w-16 h-16' },
    };

    const s = sizeMap[size];

    // Cleanly stops all active microphone streams and tracks
    const releaseMediaStream = useCallback(() => {
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

        // 1. Initialize High-Fidelity Audio Recording (MediaRecorder)
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
                        releaseMediaStream();

                        const chunks = audioChunksRef.current;
                        if (chunks.length === 0) {
                            if (finalWebSpeechRef.current.trim()) {
                                emitTranscript(finalWebSpeechRef.current.trim());
                            }
                            setIsProcessing(false);
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
                            if (data.success && data.text && data.text.trim()) {
                                emitTranscript(data.text.trim());
                            } else if (finalWebSpeechRef.current.trim()) {
                                // Fallback to Web Speech if Whisper returns empty
                                emitTranscript(finalWebSpeechRef.current.trim());
                            }
                        } catch (err) {
                            console.warn('[GlobalVoiceMic] Whisper transcribe failed, using fallback:', err);
                            if (finalWebSpeechRef.current.trim()) {
                                emitTranscript(finalWebSpeechRef.current.trim());
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

        // 2. Parallel Web Speech API for real-time live preview
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
                    if (final) {
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
    }, [currentText, emitTranscript, releaseMediaStream]);

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
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : isProcessing
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-wait'
                        : 'hover:bg-[var(--bg-subtle)] border border-transparent'
                }`}
                style={!isListening && !isProcessing ? { color: 'var(--text-muted)' } : {}}
                title={isListening ? 'Ketik untuk berhenti merakam' : 'Rakam suara (Dialek Kelantan didorong AI)'}
            >
                {isProcessing ? (
                    <Loader2 className={`${s.icon} animate-spin text-amber-400`} />
                ) : isListening ? (
                    <MicOff className={`${s.icon} animate-pulse`} />
                ) : (
                    <Mic className={s.icon} />
                )}
            </button>

            {/* Interim text tooltip / Processing status */}
            <AnimatePresence>
                {isListening && interimText && !inline && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-lg text-[10px] font-bold z-20 shadow-lg"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}
                    >
                        {interimText.slice(0, 40)}...
                    </motion.div>
                )}

                {isProcessing && !inline && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-xl text-[10px] font-bold z-30 shadow-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 backdrop-blur-md"
                    >
                        <Sparkles className="w-3 h-3 text-amber-400 animate-spin" /> Mengecam dialek Kelantan...
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

