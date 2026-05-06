'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, ShieldCheck, Fingerprint, X } from 'lucide-react';

interface PinLockProps {
    onUnlock: () => void;
    onSetup?: (pin: string) => void;
    isSetup: boolean;
}

export default function PinLock({ onUnlock, onSetup, isSetup }: PinLockProps) {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [phase, setPhase] = useState<'enter' | 'confirm' | 'verify'>(isSetup ? 'enter' : 'verify');
    const [error, setError] = useState('');
    const [shake, setShake] = useState(false);

    const handleDigit = (d: string) => {
        const current = phase === 'confirm' ? confirmPin : pin;
        if (current.length >= 6) return;
        const next = current + d;
        if (phase === 'confirm') {
            setConfirmPin(next);
            if (next.length === 6) {
                if (next === pin) {
                    onSetup?.(next);
                } else {
                    setError('PINs do not match. Try again.');
                    setShake(true); setTimeout(() => setShake(false), 500);
                    setConfirmPin('');
                    setPhase('enter');
                    setPin('');
                }
            }
        } else if (phase === 'enter' && isSetup) {
            setPin(next);
            if (next.length === 6) { setPhase('confirm'); setError(''); }
        } else {
            setPin(next);
            if (next.length === 6) {
                const savedPin = localStorage.getItem('nadi_pin') || '';
                if (next === savedPin) {
                    onUnlock();
                } else {
                    setError('Incorrect PIN');
                    setShake(true); setTimeout(() => setShake(false), 500);
                    setPin('');
                }
            }
        }
    };

    const handleDelete = () => {
        if (phase === 'confirm') setConfirmPin(p => p.slice(0, -1));
        else setPin(p => p.slice(0, -1));
    };

    const currentPin = phase === 'confirm' ? confirmPin : pin;
    const title = phase === 'confirm' ? 'Confirm PIN' : isSetup ? 'Create PIN' : 'Enter PIN';
    const subtitle = phase === 'confirm' ? 'Re-enter your 6-digit PIN' : isSetup ? 'Set a 6-digit PIN for Nadi-Pass' : 'Enter your PIN to access wallet';

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-[#050505] flex flex-col items-center justify-center p-6"
        >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C5A367]/20 to-[#C5A367]/5 border border-[#C5A367]/20 flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(197,163,103,0.15)]">
                <Lock className="w-7 h-7 text-[#C5A367]" />
            </div>

            <h2 className="text-xl font-serif text-white mb-1">{title}</h2>
            <p className="text-xs text-zinc-500 mb-8">{subtitle}</p>

            {/* PIN dots */}
            <motion.div animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}} className="flex gap-3 mb-4">
                {[0, 1, 2, 3, 4, 5].map(i => (
                    <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                        i < currentPin.length ? 'bg-[#C5A367] border-[#C5A367] shadow-[0_0_8px_rgba(197,163,103,0.5)]' : 'border-zinc-700'
                    }`} />
                ))}
            </motion.div>

            {error && <p className="text-red-400 text-xs font-bold mb-4">{error}</p>}

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3 max-w-[260px] w-full mt-4">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(d => (
                    <button
                        key={d || 'empty'}
                        onClick={() => d === '⌫' ? handleDelete() : d ? handleDigit(d) : null}
                        disabled={!d}
                        className={`h-16 rounded-2xl text-xl font-light transition-all active:scale-90 ${
                            d ? 'bg-[#121214] border border-zinc-800 text-white hover:bg-zinc-800' : ''
                        } ${d === '⌫' ? 'text-zinc-500 text-base' : ''}`}
                    >
                        {d}
                    </button>
                ))}
            </div>

            {!isSetup && (
                <button onClick={onUnlock} className="mt-6 text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400">
                    Skip for now
                </button>
            )}
        </motion.div>
    );
}
