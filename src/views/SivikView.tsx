'use client';
import { Gift, Coins, QrCode, Ticket, ShieldAlert, TrainFront, Activity, Sparkles, Leaf, Share2, CheckCircle2, X, Camera, Loader2, Crown, Download, CreditCard, ShoppingBag, ChevronDown, Lock, Check, MapPin } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGame } from '@/src/context/GameContext';
import { ECO_RANKS, getEcoRank, getEcoRankIndex } from '@/src/constants/ranks';

interface WalletData {
    balance: number;
    trustScore: number;
    co2Saved: number;
    rideStreak: number;
    streakDay: number;
    transactions: Array<{
        id: number;
        title: string;
        type: 'earn' | 'spend';
        amount: number;
        category: string;
        time: string;
        notes: string;
    }>;
}

const TX_ICON_MAP: Record<string, any> = {
    Civic: Gift,
    Transit: Ticket,
    Recycle: QrCode,
    General: Sparkles,
};

function getTrustLabel(score: number) {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 50) return 'Average';
    return 'At Risk';
}

// getEcoRank imported from @/src/constants/ranks

const REWARDS = [
    { id: 'r1', name: 'Free Bus Ride', cost: 50, icon: '🚌', desc: '1 free transit ride' },
    { id: 'r3', name: 'Grocery Voucher', cost: 100, icon: '🛒', desc: 'RM10 grocery discount' },
    { id: 'r4', name: 'Utility Discount', cost: 200, icon: '💡', desc: '5% utility bill off' },
    { id: 'r5', name: 'Food Bank Token', cost: 30, icon: '🍚', desc: 'Claim 1 food pack' },
];

export default function SivikView() {
    const [isScanning, setIsScanning] = useState(false);
    const [wallet, setWallet] = useState<WalletData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showFPX, setShowFPX] = useState(false);
    const [fpxAmount, setFpxAmount] = useState(10);
    const [activeSection, setActiveSection] = useState<'ledger' | 'leaderboard' | 'rewards'>('ledger');
    const [showEcoRanks, setShowEcoRanks] = useState(false);
    const { crs, crsLabel, leaderboard, badges } = useGame();

    // Real transit data
    interface TransitStop { id: string; name: string; type: string; distance: number; operator?: string; route?: string; }
    const [transitStops, setTransitStops] = useState<TransitStop[]>([]);
    const [transitLoading, setTransitLoading] = useState(true);
    const [transitError, setTransitError] = useState<string | null>(null);

    const fetchTransit = (lat: number, lng: number) => {
        setTransitLoading(true);
        setTransitError(null);
        fetch(`/api/transit/nearby?lat=${lat}&lng=${lng}&radius=2000`)
            .then(r => r.json())
            .then(d => {
                if (d.success && d.stops?.length > 0) {
                    setTransitStops(d.stops);
                } else {
                    setTransitStops([]);
                    setTransitError('No public transport found nearby');
                }
            })
            .catch(() => setTransitError('Failed to fetch transit data'))
            .finally(() => setTransitLoading(false));
    };

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => fetchTransit(pos.coords.latitude, pos.coords.longitude),
                () => { setTransitLoading(false); setTransitError('Location access denied'); },
                { enableHighAccuracy: true }
            );
        } else {
            setTransitLoading(false);
            setTransitError('Geolocation not supported');
        }
    }, []);

    const fetchWallet = async () => {
        try {
            const res = await fetch('/api/sivik/wallet');
            const data = await res.json();
            if (data.success) setWallet(data);
        } catch {
            // silently fail
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWallet();
    }, []);

    const handleRide = async () => {
        setIsScanning(false);
        try {
            const res = await fetch('/api/sivik/wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'spend',
                    title: 'Smart Bus Ticket',
                    amount: 2,
                    category: 'Transit',
                    notes: 'Transport Sink',
                }),
            });
            const data = await res.json();
            if (data.success) await fetchWallet();
        } catch {
            // silently fail
        }
    };

    // Parking feature removed — not relevant for Kelantan transit use case

    const trustLabel = wallet ? getTrustLabel(wallet.trustScore) : '—';
    const co2 = wallet?.co2Saved ?? 0;
    const ecoRankData = getEcoRank(co2);
    const ecoRankIndex = getEcoRankIndex(co2);
    const streakDays = wallet?.rideStreak ?? 0;

    return (
        <div className="p-5 h-full flex flex-col relative z-0" style={{ background: 'var(--bg-base)' }}>
            {/* QR Scanner Overlay */}
            <AnimatePresence>
                {isScanning && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6"
                    >
                        <button
                            onClick={() => setIsScanning(false)}
                            className="absolute top-10 right-6 p-3 bg-zinc-900 rounded-full border border-zinc-800 text-white"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className="w-full max-w-[280px] aspect-square relative border-2 border-dashed border-[#C5A367] rounded-3xl mb-12 flex items-center justify-center overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-b from-[#C5A367]/10 to-transparent animate-[pulse_2s_infinite]"></div>
                            <div className="absolute top-0 inset-x-0 h-1 bg-[#C5A367] shadow-[0_0_15px_#C5A367] animate-[scan_3s_ease-in-out_infinite]"></div>
                            <Camera className="w-12 h-12 text-zinc-800" />
                        </div>

                        <div className="text-center space-y-4 mb-8">
                            <h3 className="text-xl font-serif text-white tracking-tight">Scanning Code...</h3>
                            <p className="text-xs text-zinc-500 font-medium tracking-wide uppercase">Align QR within the frame for validation</p>
                        </div>

                        {/* Simulate scan success */}
                        <button
                            onClick={handleRide}
                            className="bg-gradient-to-r from-red-600 to-red-700 text-white py-3.5 px-8 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg"
                        >
                            Confirm Tap-In (RM 2.00)
                        </button>

                        <motion.style>{`
              @keyframes scan {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(280px); }
              }
            `}</motion.style>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="mb-8"
            >
                <h2 className="text-2xl font-bold mb-1 tracking-tight" style={{ color: 'var(--text-primary)' }}>Nadi-Pass</h2>
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Your transit wallet & ledger
                </p>
            </motion.div>

            {/* Wallet Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                className="rounded-2xl p-6 mb-5 relative overflow-hidden shadow-md" style={{ background: 'var(--accent)', color: 'white' }}
            >

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="flex items-center gap-2 mb-2">
                        <Coins className="w-5 h-5 text-white/70" />
                        <span className="text-xs text-white/70 font-medium">Balance</span>
                    </div>
                    {isLoading ? (
                        <div className="flex items-center justify-center h-16 mb-6">
                            <Loader2 className="w-8 h-8 text-zinc-700 animate-spin" />
                        </div>
                    ) : (
                        <div className="text-5xl font-bold tracking-tight text-white mb-5 flex items-baseline justify-center gap-2">
                            {wallet?.balance ?? 0} <span className="text-base font-medium opacity-60">pts</span>
                        </div>
                    )}

                    <div className="flex gap-3 w-full max-w-[240px]">
                        <button className="flex-1 bg-white text-blue-700 py-3 rounded-xl text-xs font-bold transition-all hover:bg-blue-50 active:scale-95">
                            Top Up
                        </button>
                        <button className="flex-1 bg-white/20 border border-white/30 text-white py-3 rounded-xl text-xs font-bold transition-colors hover:bg-white/30">
                            Send
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Trust Score — real data */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="rounded-2xl p-4 mb-6 flex items-center justify-between shadow-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
                        <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Trust Score</p>
                        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {trustLabel} <span style={{ color: 'var(--success)' }}>({wallet?.trustScore ?? '—'}/100)</span>
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest max-w-[120px] leading-tight opacity-70">
                        Earn through civic activity.
                    </p>
                </div>
            </motion.div>

            {/* MaaS & Transit Hub */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="p-5 rounded-2xl mb-5 relative overflow-hidden shadow-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            >

                <div className="flex justify-between items-start mb-6 z-10 relative">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <TrainFront className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Transit Hub</h3>
                        </div>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Your transit pass</p>
                    </div>

                    {/* Auto-Tariff Badge */}
                    <div className="text-right">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg mb-1.5" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold">Verified</span>
                        </div>
                        <p className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                            Fare: <span style={{ color: 'var(--success)' }}>RM 2.00</span>
                        </p>
                    </div>
                </div>

                {/* Live Alert Banner */}
                <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--accent-light)', border: '1px solid var(--border-default)' }}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--accent)' }}>
                            <Activity className="w-4 h-4" /> Ride Now
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>Live</span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
                        Scan the QR to record your ride and earn CO₂ savings.
                    </p>
                    <button
                        onClick={() => setIsScanning(true)}
                        className="w-full text-white py-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95" style={{ background: 'var(--accent)' }}
                    >
                        <QrCode className="w-4 h-4" /> Scan to Ride — RM 2.00
                    </button>
                </div>

                {/* Smart Transit — Real Nearby Stops */}
                <div className="rounded-2xl p-4 mb-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    <p className="text-xs font-bold mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <TrainFront className="w-3 h-3" /> Nearby Transit Stops
                    </p>
                    {transitLoading ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                        </div>
                    ) : transitError && transitStops.length === 0 ? (
                        <div className="text-center py-6 border border-dashed border-zinc-800 rounded-xl">
                            <MapPin className="w-5 h-5 text-zinc-700 mx-auto mb-2" />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{transitError}</p>
                            <p className="text-[9px] text-zinc-700 mt-1">Try enabling location access</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {transitStops.slice(0, 5).map(stop => (
                                <div key={stop.id} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border shrink-0 ${stop.type === 'train_station' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-[#C5A367]/10 text-[#C5A367] border-[#C5A367]/20'}`}>
                                            {stop.type === 'train_station' ? 'RAIL' : 'BUS'}
                                        </span>
                                        <span className="text-xs text-zinc-300 font-medium truncate">{stop.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs font-bold text-[#10B981]">{stop.distance < 1000 ? `${stop.distance}m` : `${(stop.distance / 1000).toFixed(1)}km`}</span>
                                        <span className="text-[7px] font-bold uppercase text-zinc-600">{stop.type === 'train_station' ? 'Train' : 'Bus'}</span>
                                    </div>
                                </div>
                            ))}
                            {transitStops.length > 5 && (
                                <p className="text-[8px] text-zinc-600 text-center pt-1 font-bold">+{transitStops.length - 5} more stops nearby</p>
                            )}
                        </div>
                    )}
                    <p className="text-[7px] text-zinc-600 mt-2 font-medium">🌿 Transit saves ~2.3kg CO₂ vs driving</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Ride Streak — real data */}
                    <div className="rounded-2xl p-4 shadow-md" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--accent-muted)' }}>
                                    <Gift className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                                </div>
                                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Ride Streak</span>
                            </div>
                            <Sparkles className="w-3.5 h-3.5 opacity-60" style={{ color: 'var(--accent)' }} />
                        </div>
                        <div className="flex items-center gap-1 mb-2">
                            {[1, 2, 3, 4, 5].map(day => (
                                <div key={day} className="h-1.5 flex-1 rounded-full" style={{ background: day <= Math.min(streakDays, 5) ? 'var(--accent)' : 'var(--bg-muted)' }}></div>
                            ))}
                        </div>
                        <p className="text-[10px] font-medium leading-relaxed mt-3" style={{ color: 'var(--text-muted)' }}>
                            {streakDays > 0 ? (
                                <><span className="font-bold" style={{ color: 'var(--accent)' }}>Day {streakDays}:</span> {5 - (streakDays % 5)} more ride{5 - (streakDays % 5) !== 1 ? 's' : ''} for reward.</>
                            ) : (
                                'Take your first ride today!'
                            )}
                        </p>
                    </div>

                    {/* Eco Flex — Transit Rank System */}
                    <div
                        onClick={() => setShowEcoRanks(!showEcoRanks)}
                        className="rounded-2xl p-4 relative overflow-hidden group hover:cursor-pointer shadow-md"
                        style={{ background: 'var(--success-light)', border: '1px solid var(--border-default)' }}
                    >
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Leaf className="w-24 h-24 text-[#10B981]" />
                        </div>
                        <div className="flex items-center justify-between mb-2 relative z-10">
                            <div className="flex items-center gap-1.5">
                                <Leaf className="w-3.5 h-3.5 text-[#10B981]" />
                                <span className="text-[10px] font-semibold" style={{ color: 'var(--success)' }}>Eco-Flex</span>
                            </div>
                            <ChevronDown className={`w-3.5 h-3.5 text-[#10B981]/40 transition-transform ${showEcoRanks ? 'rotate-180' : ''}`} />
                        </div>
                        <div className="text-2xl font-bold mb-0.5 relative z-10" style={{ color: 'var(--text-primary)' }}>
                            {co2}kg <span className="text-sm font-medium opacity-50">CO₂</span>
                        </div>
                        <p className="text-[10px] font-medium mb-3 mt-0.5" style={{ color: 'var(--text-muted)' }}>Saved via transit rides</p>
                        <div className="flex items-center gap-2 relative z-10">
                            <span className="text-lg">{ecoRankData.icon}</span>
                            <div className="inline-block px-2 py-1 bg-[#10B981]/10 border border-[#10B981]/20 rounded-lg text-[8px] font-bold uppercase tracking-widest" style={{ color: ecoRankData.color }}>
                                {ecoRankData.title}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Expanded Eco Rank Panel */}
                <AnimatePresence>
                    {showEcoRanks && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="mt-4 pt-4 border-t border-zinc-800/50 space-y-2">
                                <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 mb-3">All Transit Ranks</p>
                                {ECO_RANKS.map((r, i) => {
                                    const isCurrent = i === ecoRankIndex;
                                    const isUnlocked = co2 >= r.co2Threshold;
                                    const isNext = i === ecoRankIndex + 1;
                                    const co2ToGo = r.co2Threshold - co2;
                                    return (
                                        <div key={r.title} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                            isCurrent
                                                ? 'bg-[#10B981]/10 border-[#10B981]/30 shadow-[0_0_12px_rgba(16,185,129,0.1)]'
                                                : isUnlocked
                                                    ? 'bg-[#10B981]/5 border-[#10B981]/10'
                                                    : 'bg-zinc-900/30 border-zinc-800/50'
                                        }`}>
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 border ${
                                                isCurrent ? 'bg-[#10B981]/20 border-[#10B981]/30' : isUnlocked ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-900 border-zinc-800'
                                            }`}>
                                                {isUnlocked ? r.icon : <Lock className="w-3.5 h-3.5 text-zinc-700" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-bold ${isCurrent ? 'text-[#10B981]' : isUnlocked ? 'text-zinc-300' : 'text-zinc-600'}`}>{r.title}</span>
                                                    <span className={`text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                                                        isCurrent ? 'bg-[#10B981]/20 text-[#10B981]' : isUnlocked ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-800 text-zinc-700'
                                                    }`}>
                                                        {isCurrent ? 'CURRENT' : isUnlocked ? '✓' : `${r.co2Threshold}kg`}
                                                    </span>
                                                </div>
                                                <p className={`text-[9px] font-medium mt-0.5 ${isCurrent ? 'text-zinc-400' : 'text-zinc-600'}`}>{r.perk}</p>
                                            </div>
                                            <div className="shrink-0">
                                                {isCurrent ? (
                                                    <div className="w-6 h-6 rounded-full bg-[#10B981]/20 flex items-center justify-center">
                                                        <Check className="w-3 h-3 text-[#10B981]" />
                                                    </div>
                                                ) : isNext ? (
                                                    <span className="text-[8px] font-bold text-[#C5A367]">{co2ToGo}kg</span>
                                                ) : isUnlocked ? (
                                                    <Check className="w-3 h-3 text-zinc-600" />
                                                ) : (
                                                    <Lock className="w-3 h-3 text-zinc-800" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {ecoRankIndex < ECO_RANKS.length - 1 && (
                                    <div className="mt-3 pt-3 border-t border-zinc-800/30">
                                        <div className="flex justify-between mb-1.5">
                                            <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">Next: {ECO_RANKS[ecoRankIndex + 1].title}</span>
                                            <span className="text-[8px] font-bold text-[#10B981]">{co2}/{ECO_RANKS[ecoRankIndex + 1].co2Threshold}kg</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(100, ((co2 - ECO_RANKS[ecoRankIndex].co2Threshold) / (ECO_RANKS[ecoRankIndex + 1].co2Threshold - ECO_RANKS[ecoRankIndex].co2Threshold)) * 100)}%` }}
                                                transition={{ duration: 0.8 }}
                                                className="h-full rounded-full bg-gradient-to-r from-[#10B981] to-[#34D399]"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* CRS + Quick Actions (Features 7, 14) */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="rounded-2xl p-4 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-md)' }}
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Civic Reputation</span>
                    </div>
                    <span className="text-lg font-light" style={{ color: 'var(--accent)' }}>{crs}<span className="text-xs" style={{ color: 'var(--text-muted)' }}>/1000</span></span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'var(--bg-muted)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${(crs / 1000) * 100}%`, background: 'var(--accent)' }} />
                </div>
                <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{crsLabel}</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
                className="mb-6"
            >
                <button onClick={() => setShowFPX(true)}
                    className="w-full bg-[#121214] p-3.5 rounded-2xl border border-zinc-800 shadow-lg hover:bg-zinc-800/50 transition-all flex items-center justify-center gap-2 group"
                >
                    <CreditCard className="w-4 h-4 text-[#10B981] group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">FPX Top-Up</span>
                </button>
            </motion.div>

            {/* FPX Top-Up Modal (Feature 14) */}
            <AnimatePresence>
                {showFPX && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end justify-center"
                        onClick={(e) => e.target === e.currentTarget && setShowFPX(false)}
                    >
                        <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
                            className="bg-[#121214] border border-zinc-800 rounded-t-3xl p-6 w-full max-w-md"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-serif text-xl text-white">FPX Top-Up</h3>
                                <button onClick={() => setShowFPX(false)} className="p-2 text-zinc-500"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="grid grid-cols-4 gap-2 mb-6">
                                {[5, 10, 20, 50].map(a => (
                                    <button key={a} onClick={() => setFpxAmount(a)}
                                        className={`py-3 rounded-xl text-sm font-bold border transition-all ${fpxAmount === a ? 'bg-[#C5A367]/10 border-[#C5A367]/30 text-[#C5A367]' : 'border-zinc-800 text-zinc-400'}`}
                                    >RM{a}</button>
                                ))}
                            </div>
                            <button onClick={() => { setShowFPX(false); alert(`FPX payment of RM${fpxAmount} — Integration with Billplz/ToyyibPay pending.`); }}
                                className="w-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg"
                            >Pay RM{fpxAmount} via FPX</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Section Tabs: Ledger / Leaderboard / Rewards */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                className="flex p-1 rounded-2xl mb-6" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
            >
                {(['ledger', 'leaderboard', 'rewards'] as const).map(s => (
                    <button key={s} onClick={() => setActiveSection(s)}
                        className="flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all"
                        style={activeSection === s ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--text-muted)' }}
                    >{s === 'ledger' ? 'Ledger' : s === 'leaderboard' ? 'Board' : 'Rewards'}</button>
                ))}
            </motion.div>

            <div className="flex-1 pb-10">

            {/* Leaderboard (Feature 5) */}
            {activeSection === 'leaderboard' && (
                <div className="space-y-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#C5A367] mb-4">Community Leaderboard</h3>
                    {leaderboard.map((u, i) => (
                        <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${u.name === 'You' ? 'bg-[#C5A367]/5 border-[#C5A367]/20' : 'bg-[#121214] border-zinc-800'}`}>
                            <div className="flex items-center gap-3">
                                <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${i < 3 ? 'bg-[#C5A367]/10 text-[#C5A367]' : 'bg-zinc-800 text-zinc-500'}`}>{i < 3 ? ['🥇','🥈','🥉'][i] : u.rank}</span>
                                <div>
                                    <p className={`text-xs font-bold ${u.name === 'You' ? 'text-[#C5A367]' : 'text-zinc-300'}`}>{u.name}</p>
                                    <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">{u.mukim}</p>
                                </div>
                            </div>
                            <span className="text-sm font-mono text-zinc-400">{u.xp} XP</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Rewards Shop (Feature 15) */}
            {activeSection === 'rewards' && (
                <div className="space-y-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#C5A367] mb-4 flex items-center gap-2"><ShoppingBag className="w-3.5 h-3.5" /> Civic Rewards Shop</h3>
                    {REWARDS.map(r => (
                        <div key={r.id} className="flex items-center justify-between p-4 rounded-2xl bg-[#121214] border border-zinc-800">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{r.icon}</span>
                                <div>
                                    <p className="text-xs font-bold text-zinc-300">{r.name}</p>
                                    <p className="text-[9px] text-zinc-600">{r.desc}</p>
                                </div>
                            </div>
                            <button className="px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest border bg-[#C5A367]/10 text-[#C5A367] border-[#C5A367]/20 hover:bg-[#C5A367] hover:text-[#0A0A0C] transition-all">
                                {r.cost} pts
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Proof-of-Work Ledger (Feature 16: export) */}
            {activeSection === 'ledger' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#C5A367] mb-6 flex items-center justify-between">
                    <span>Proof-of-Work Ledger</span>
                    <button onClick={() => {
                        if (!wallet?.transactions?.length) return;
                        const csv = 'Title,Type,Amount,Category,Time\n' + wallet.transactions.map(t => `${t.title},${t.type},${t.amount},${t.category},${t.time}`).join('\n');
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = 'nadi_ledger.csv'; a.click();
                    }} className="flex items-center gap-1 text-zinc-500 hover:text-[#C5A367] transition-colors">
                        <Download className="w-3.5 h-3.5" />
                        <span className="text-[8px] font-bold uppercase tracking-widest">Export CSV</span>
                    </button>
                </h3>
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-zinc-700 animate-spin" />
                    </div>
                ) : wallet?.transactions && wallet.transactions.length > 0 ? (
                    <div className="bg-[#121214] rounded-3xl p-2 border border-zinc-800 shadow-xl">
                        {wallet.transactions.slice(0, 10).map((tx, i) => {
                            const Icon = TX_ICON_MAP[tx.category] || Sparkles;
                            return (
                                <div key={tx.id} className={`flex items-center justify-between p-4 ${i !== Math.min(wallet.transactions.length, 10) - 1 ? 'border-b border-zinc-800/50' : ''}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${tx.type === 'earn' ? 'bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]' : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500'
                                            }`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-serif text-sm text-zinc-200 mb-0.5">{tx.title}</h4>
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-[#C5A367]/60">{tx.notes || tx.category}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-mono text-lg font-light tracking-tight ${tx.type === 'earn' ? 'text-[#10B981] drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]' : 'text-zinc-500'}`}>
                                            {tx.type === 'earn' ? '+' : ''}{tx.amount}
                                        </div>
                                        <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-600 mt-1">{tx.time}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-10 text-zinc-600 border border-dashed border-zinc-800 rounded-3xl text-[10px] font-bold uppercase tracking-widest">
                        No transactions yet. Scan a QR to start!
                    </div>
                )}
            </motion.div>
            )}
            </div>
        </div>
    );
}
