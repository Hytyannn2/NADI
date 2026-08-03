'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
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
}

export default function GlobalVoiceMic({ onTranscript, size = 'md', className = '', inline = false }: GlobalVoiceMicProps) {
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [interimText, setInterimText] = useState('');
    const recognitionRef = useRef<any>(null);
    const finalTranscriptRef = useRef('');

    const sizeMap = {
        sm: { button: 'w-8 h-8', icon: 'w-3.5 h-3.5', ring: 'w-10 h-10' },
        md: { button: 'w-10 h-10', icon: 'w-4.5 h-4.5', ring: 'w-12 h-12' },
        lg: { button: 'w-14 h-14', icon: 'w-6 h-6', ring: 'w-16 h-16' },
    };

    const s = sizeMap[size];

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch {}
        }
        setIsListening(false);
        setInterimText('');
    }, []);

    const startListening = useCallback(() => {
        if (typeof window === 'undefined') return;

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Pelayar anda tidak menyokong Speech Recognition. Sila gunakan Chrome.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'ms-MY'; // Malaysian Malay (closest to Kelantan dialect)
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        finalTranscriptRef.current = '';

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
                finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + final;
                onTranscript(finalTranscriptRef.current);
            }
            setInterimText(interim);
        };

        recognition.onerror = (event: any) => {
            console.info('Speech recognition error:', event.error);
            if (event.error !== 'aborted') {
                stopListening();
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            setIsProcessing(false);
            setInterimText('');
            // Deliver any final text accumulated
            if (finalTranscriptRef.current.trim()) {
                onTranscript(finalTranscriptRef.current.trim());
            }
        };

        recognitionRef.current = recognition;

        try {
            recognition.start();
        } catch (e) {
            console.error('Failed to start recognition:', e);
        }
    }, [onTranscript, stopListening]);

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
        };
    }, []);

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
                className={`${s.button} rounded-full flex items-center justify-center transition-all relative z-10 ${
                    isListening
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'hover:bg-[var(--bg-subtle)] border border-transparent'
                }`}
                style={!isListening ? { color: 'var(--text-muted)' } : {}}
            >
                {isProcessing ? (
                    <Loader2 className={`${s.icon} animate-spin`} />
                ) : isListening ? (
                    <MicOff className={`${s.icon} animate-pulse`} />
                ) : (
                    <Mic className={s.icon} />
                )}
            </button>

            {/* Interim text tooltip */}
            <AnimatePresence>
                {isListening && interimText && !inline && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-lg text-[10px] font-bold z-20"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}
                    >
                        {interimText.slice(0, 40)}...
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
