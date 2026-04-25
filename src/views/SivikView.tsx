import { ArrowUpRight, Gift, Coins, QrCode, Ticket, ShieldAlert, TrainFront, Activity, Sparkles, Leaf, Share2, CheckCircle2, X, Camera } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function SivikView() {
    const [isScanning, setIsScanning] = useState(false);
    const transactions = [
        { id: 1, title: 'Beach Gotong-Royong', type: 'earn', amount: 50, icon: Gift, time: '2 hours ago', notes: 'Macro-Bounty: Verified by Warden' },
        { id: 2, title: 'Smart Bus Ticket', type: 'spend', amount: -2, icon: Ticket, time: 'Yesterday', notes: 'Transport Sink' },
        { id: 3, title: 'RVM Plastic Recycle (x5)', type: 'earn', amount: 1, icon: QrCode, time: '2 days ago', notes: 'Micro-Bounty' },
    ];

    return (
        <div className="p-6 h-full flex flex-col relative z-0">
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

                        <div className="text-center space-y-4">
                            <h3 className="text-xl font-serif text-white tracking-tight">Scanning Code...</h3>
                            <p className="text-xs text-zinc-500 font-medium tracking-wide uppercase">Align QR within the frame for validation</p>
                        </div>

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
                <h2 className="text-3xl font-serif mb-1 text-white tracking-tight">Nadi-Pass</h2>
                <p className="text-[10px] uppercase font-bold tracking-widest text-[#C5A367] mt-1">
                    Universal Transit & Ledger
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                className="bg-gradient-to-tl from-[#1A1C16] to-[#0A0A0C] border border-[#2A2D24] rounded-3xl p-8 mb-6 relative overflow-hidden shadow-2xl shadow-[#10B981]/5 text-white"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#C5A367]/10 rounded-full blur-3xl transform translate-x-10 -translate-y-10"></div>
                <div className="absolute inset-0 bg-[#000] opacity-20 mix-blend-overlay"></div>

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="flex items-center gap-2 mb-2">
                        <Coins className="w-5 h-5 text-[#C5A367]" />
                        <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">E-Dinar Balance</span>
                    </div>
                    <div className="text-6xl font-light tracking-tight text-[#FAFAFA] mb-6 flex items-baseline justify-center gap-2 drop-shadow-md">
                        124 <span className="text-lg font-medium opacity-50 uppercase tracking-widest">pts</span>
                    </div>

                    <div className="flex gap-3 w-full max-w-[240px]">
                        <button className="flex-1 bg-gradient-to-b from-[#D4AF37] to-[#B8860B] text-[#0A0A0C] py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(197,163,103,0.3)]">
                            Top-Up <span className="font-medium opacity-70 border-l border-zinc-900/30 pl-1 ml-1">(FPX)</span>
                        </button>
                        <button className="flex-1 bg-[#121214] hover:bg-[#1A1A1E] border border-zinc-800 py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors text-zinc-300">
                            Send Money
                        </button>
                    </div>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="bg-[#0A0A0C] border border-zinc-800/80 rounded-2xl p-4 mb-8 flex items-center justify-between shadow-xl"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#10B981]/10 text-[#10B981] rounded-full flex items-center justify-center border border-[#10B981]/20">
                        <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">Trust Score</p>
                        <p className="text-sm font-bold text-zinc-200">Excellent <span className="text-[#10B981] opacity-80">(98/100)</span></p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest max-w-[120px] leading-tight opacity-70">
                        High trust prevents shadow-bans.
                    </p>
                </div>
            </motion.div>

            {/* MaaS & Transit Hub containing the 4 Exclusive Benefits */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="bg-[#121214] p-5 rounded-3xl border border-zinc-800 shadow-xl mb-6 relative overflow-hidden group"
            >
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#10B981]/5 rounded-full blur-3xl -z-10 opacity-70 transition-opacity duration-500 group-hover:opacity-100"></div>

                <div className="flex justify-between items-start mb-6 z-10 relative">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <TrainFront className="w-5 h-5 text-[#10B981]" />
                            <h3 className="text-lg font-serif text-white">Transit Hub</h3>
                        </div>
                        <p className="text-[9px] uppercase font-bold tracking-widest text-[#C5A367]">Priority Access Pass</p>
                    </div>

                    {/* A. Auto-Tariff Badge */}
                    <div className="text-right">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl mb-1.5 shadow-sm">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                            <span className="text-[8px] font-bold uppercase tracking-widest text-[#10B981]/90">LHDN Verified Student</span>
                        </div>
                        <p className="text-xs font-bold text-zinc-400 tracking-wide">
                            Tariff: <span className="text-[#10B981] drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">RM 0.00</span>
                        </p>
                    </div>
                </div>

                {/* D. MaaS Navigation & Alert */}
                <div className="bg-[#1a0505] rounded-2xl p-4 border border-red-900/50 mb-4 shadow-inner">
                    <div className="flex justify-between items-center mb-2">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-red-500">
                            <Activity className="w-4 h-4" /> Next Tram: 4 Mins
                        </span>
                        <span className="text-[8px] font-bold text-red-500/70 border border-red-500/30 px-1.5 py-0.5 rounded uppercase tracking-widest">Live Routing</span>
                    </div>
                    <p className="text-xs text-red-200/80 font-medium leading-relaxed mb-4">
                        <span className="font-bold text-red-400">Flood Alert:</span> Jalan Sultan Ibrahim is jammed. System rerouted via elevated track.
                    </p>
                    <button
                        onClick={() => setIsScanning(true)}
                        className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_5px_20px_rgba(220,38,38,0.2)] hover:from-white hover:to-zinc-200 hover:text-red-900 transition-all font-sans"
                    >
                        <QrCode className="w-4 h-4" /> Scan to Ride (RM 0.00)
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* B. Gacha Rewards */}
                    <div className="bg-[#0A0A0C] rounded-2xl p-4 border border-zinc-800/80 shadow-md">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 rounded-md bg-[#C5A367]/10 flex items-center justify-center border border-[#C5A367]/20">
                                    <Gift className="w-3.5 h-3.5 text-[#C5A367]" />
                                </div>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Ride Streak</span>
                            </div>
                            <Sparkles className="w-3.5 h-3.5 text-[#C5A367] opacity-60" />
                        </div>
                        <div className="flex items-center gap-1 mb-2">
                            {[1, 2, 3, 4, 5].map(day => (
                                <div key={day} className={`h-1.5 flex-1 rounded-full ${day <= 4 ? 'bg-[#C5A367] shadow-[0_0_5px_rgba(197,163,103,0.5)]' : 'bg-zinc-800'}`}></div>
                            ))}
                        </div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 leading-relaxed mt-3">
                            <span className="text-[#C5A367] font-black drop-shadow-[0_0_2px_#C5A367]">Day 4/5:</span> 1 more ride for Free Coffee pass.
                        </p>
                    </div>

                    {/* C. Eco-Flex */}
                    <div className="bg-[#0f1a14] rounded-2xl p-4 border border-[#10B981]/20 text-white relative overflow-hidden group hover:cursor-pointer shadow-md">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Leaf className="w-24 h-24 text-[#10B981]" />
                        </div>
                        <div className="flex items-center justify-between mb-2 relative z-10">
                            <div className="flex items-center gap-1.5">
                                <Leaf className="w-3.5 h-3.5 text-[#10B981]" />
                                <span className="text-[9px] font-bold uppercase tracking-widest text-[#10B981]/70">The Eco-Flex</span>
                            </div>
                            <Share2 className="w-3.5 h-3.5 text-[#10B981]/40 hover:text-[#10B981]" />
                        </div>
                        <div className="text-2xl font-serif text-white mb-0.5 relative z-10 drop-shadow-md">50kg <span className="text-sm font-medium opacity-50">CO₂</span></div>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-[#10B981]/50 mb-3 mt-0.5">Saved this month</p>
                        <div className="inline-block px-2 py-1 bg-[#10B981]/10 border border-[#10B981]/20 rounded-lg text-[8px] font-bold uppercase tracking-widest text-[#10B981] relative z-10 backdrop-blur-md">
                            Rank: Green Kijang
                        </div>
                    </div>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="flex gap-3 mb-10"
            >
                <button className="flex-1 bg-[#121214] p-4 py-3.5 rounded-2xl border border-zinc-800 shadow-lg hover:bg-zinc-800/50 transition-all flex items-center justify-center gap-2 group">
                    <ArrowUpRight className="w-4 h-4 text-[#C5A367] group-hover:rotate-12 transition-transform" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">Pay Parking</span>
                </button>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                className="flex-1 pb-10"
            >
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#C5A367] mb-6 flex items-center justify-between">
                    <span>Proof-of-Work Ledger</span>
                </h3>
                <div className="bg-[#121214] rounded-3xl p-2 border border-zinc-800 shadow-xl">
                    {transactions.map((tx, i) => (
                        <div key={tx.id} className={`flex items-center justify-between p-4 ${i !== transactions.length - 1 ? 'border-b border-zinc-800/50' : ''}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${tx.type === 'earn' ? 'bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]' : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500'
                                    }`}>
                                    <tx.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-serif text-sm text-zinc-200 mb-0.5">{tx.title}</h4>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#C5A367]/60">{tx.notes}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className={`font-mono text-lg font-light tracking-tight ${tx.type === 'earn' ? 'text-[#10B981] drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]' : 'text-zinc-500'}`}>
                                    {tx.type === 'earn' ? '+' : ''}{tx.amount}
                                </div>
                                <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-600 mt-1">{tx.time}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}
