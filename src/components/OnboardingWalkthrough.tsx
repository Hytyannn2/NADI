'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Activity, AlertTriangle, Wallet, Store, ChevronRight, X, Sparkles, Heart } from 'lucide-react';

const STEPS = [
    {
        title: 'Welcome to NADI 🇲🇾',
        description: 'Your all-in-one civic operations system. Report issues, find aid, volunteer, trade local goods, and earn rewards — all from one app.',
        icon: Sparkles,
        highlight: 'Let\'s take a quick tour!',
    },
    {
        title: 'Nadi-Pass & Sivik',
        description: 'Your digital wallet for transit and civic rewards. Scan QR codes to ride, track CO₂ savings, view your leaderboard rank, and build your civic reputation.',
        icon: Wallet,
        highlight: 'Tap the Nadi-Pass tab to access your wallet.',
    },
    {
        title: 'Suara — Your Voice',
        description: 'Report civic issues in your local dialect. Our AI understands Kelantanese, Sarawakian, and more — then routes your report to the right authority.',
        icon: Mic,
        highlight: 'Speak naturally. NADI understands.',
    },
    {
        title: 'Infra & Bencana',
        description: 'Detect potholes while driving (real accelerometer data) and monitor flood sensors in real-time. Bencana shows a live GPS map of your area with disaster readiness status.',
        icon: Activity,
        highlight: 'Your phone becomes a civic sensor.',
    },
    {
        title: 'Niaga — Local Trade',
        description: 'Connect directly with local producers. Post and discover fresh supplies — seafood, produce, poultry — all AI-verified for trust.',
        icon: Store,
        highlight: 'Support your local economy.',
    },
    {
        title: 'Bantuan — Aid & Volunteer',
        description: 'Find active government aid programs near you with direct links to apply. Browse real volunteer opportunities across Malaysia from NGOs like Mercy Malaysia, WWF, and Red Crescent.',
        icon: Heart,
        highlight: 'Click any card to visit the source directly.',
    },
];

export default function OnboardingWalkthrough({ onComplete }: { onComplete: () => void }) {
    const [step, setStep] = useState(0);
    const [visible, setVisible] = useState(true);

    const current = STEPS[step];
    const Icon = current.icon;
    const isLast = step === STEPS.length - 1;

    const handleNext = () => {
        if (isLast) {
            setVisible(false);
            try { localStorage.setItem('nadi_onboarded', 'true'); } catch {}
            setTimeout(onComplete, 300);
        } else {
            setStep(s => s + 1);
        }
    };

    const handleSkip = () => {
        setVisible(false);
        try { localStorage.setItem('nadi_onboarded', 'true'); } catch {}
        setTimeout(onComplete, 300);
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6"
                >
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                        className="w-full max-w-sm"
                    >
                        {/* Skip button */}
                        <div className="flex justify-end mb-6">
                            <button onClick={handleSkip} className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1">
                                Skip Tour <X className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Card */}
                        <div className="bg-[#0A0A0C] border border-zinc-800 rounded-3xl p-8 text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-[#C5A367]/5 rounded-full blur-3xl" />

                            {/* Icon */}
                            <motion.div
                                key={`icon-${step}`}
                                initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', delay: 0.1 }}
                                className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-[#C5A367]/20 to-[#C5A367]/5 border border-[#C5A367]/20 mb-6 shadow-[0_0_40px_rgba(197,163,103,0.15)]"
                            >
                                <Icon className="w-9 h-9 text-[#C5A367]" />
                            </motion.div>

                            <h2 className="text-2xl font-serif text-white mb-3 tracking-tight">{current.title}</h2>
                            <p className="text-sm text-zinc-400 font-medium leading-relaxed mb-4">{current.description}</p>
                            <p className="text-xs text-[#C5A367] font-bold mb-8">{current.highlight}</p>

                            {/* Progress dots */}
                            <div className="flex items-center justify-center gap-2 mb-6">
                                {STEPS.map((_, i) => (
                                    <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-[#C5A367]' : 'w-1.5 bg-zinc-800'}`} />
                                ))}
                            </div>

                            <button
                                onClick={handleNext}
                                className="w-full bg-gradient-to-r from-[#C5A367] to-[#B8860B] text-[#0A0A0C] py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(197,163,103,0.2)] active:scale-[0.97] transition-transform"
                            >
                                {isLast ? 'Get Started 🚀' : 'Next'}
                                {!isLast && <ChevronRight className="w-4 h-4" />}
                            </button>
                        </div>

                        {/* Step counter */}
                        <p className="text-center text-[9px] font-bold uppercase tracking-widest text-zinc-700 mt-4">
                            Step {step + 1} of {STEPS.length}
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
