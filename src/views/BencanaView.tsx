import { MapPin, Navigation, AlertTriangle, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function BencanaView({ isEmergency, setIsEmergency }: { isEmergency: boolean, setIsEmergency: (val: boolean) => void }) {
    const [activeTab, setActiveTab] = useState<'map' | 'volunteer'>('map');

    return (
        <div className={`p-6 h-full flex flex-col relative z-0 transition-colors duration-500 ${isEmergency ? 'text-red-50' : 'text-zinc-100'}`}>

            {/* SOS Button - Floating */}
            <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsEmergency(true)}
                className={`fixed bottom-28 right-6 z-50 w-16 h-16 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.5)] border-4 border-white transition-all ${isEmergency ? 'bg-red-500 animate-pulse grayscale-[0.5]' : 'bg-red-600 hover:bg-red-500'
                    }`}
            >
                <span className="text-white font-black text-xs">SOS</span>
            </motion.button>
            <AnimatePresence>
                {isEmergency && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-red-900/10 pointer-events-none -z-10 blur-3xl animate-pulse"
                    />
                )}
            </AnimatePresence>

            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="mb-8"
            >
                <h2 className="text-3xl font-serif mb-1 tracking-tight">NADI Bencana</h2>
                <p className={`text-[10px] uppercase font-bold tracking-widest mt-1 ${isEmergency ? 'text-red-400' : 'text-[#C5A367]'}`}>
                    Dynamic Crisis & Flood Routing
                </p>
            </motion.div>

            {/* Emergency Toggle (Simulation Button) */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                className={`mb-6 p-5 rounded-3xl border shadow-xl relative overflow-hidden ${isEmergency ? 'bg-[#2A0808] border-red-900/50 shadow-[0_0_40px_rgba(220,38,38,0.15)]' : 'bg-[#121214] border-zinc-800'}`}
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -z-10 translate-x-1/3 -translate-y-1/3"></div>

                <div className="flex items-center justify-between mb-4">
                    <span className="font-bold text-[10px] text-zinc-500 uppercase tracking-widest">LoRaWAN Sonar</span>
                    <span className={`text-[9px] font-bold px-3 py-1.5 rounded-full tracking-widest uppercase shadow-sm ${isEmergency ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20'}`}>
                        {isEmergency ? 'LVL 3: DANGER' : 'LVL 1: SAFE'}
                    </span>
                </div>
                <button
                    onClick={() => setIsEmergency(!isEmergency)}
                    className={`w-full py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg active:scale-95 ${isEmergency ? 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-zinc-800 text-white hover:bg-zinc-700 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-zinc-700'
                        }`}
                >
                    {isEmergency ? 'SIMULATE RECEDING' : 'SIMULATE WARNING'}
                </button>
            </motion.div>

            {/* Internal Tabs */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className={`flex p-1.5 rounded-2xl mb-8 border backdrop-blur-md ${isEmergency ? 'bg-[#1a0505]/60 border-red-900/50' : 'bg-[#0A0A0C]/80 border-zinc-800/80 shadow-inner'}`}
            >
                <button
                    onClick={() => setActiveTab('map')}
                    className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold rounded-xl transition-all ${activeTab === 'map'
                            ? (isEmergency ? 'bg-red-900/60 text-white shadow-md border border-red-800/50' : 'bg-zinc-800 text-[#FAFAFA] shadow-md border border-zinc-700')
                            : (isEmergency ? 'text-red-500/50 hover:text-red-400' : 'text-zinc-600 hover:text-zinc-400')
                        }`}
                >
                    Evacuation
                </button>
                <button
                    onClick={() => setActiveTab('volunteer')}
                    className={`flex-1 py-3 text-[10px] uppercase tracking-widest font-bold rounded-xl transition-all ${activeTab === 'volunteer'
                            ? (isEmergency ? 'bg-red-900/60 text-white shadow-md border border-red-800/50' : 'bg-zinc-800 text-[#FAFAFA] shadow-md border border-zinc-700')
                            : (isEmergency ? 'text-red-500/50 hover:text-red-400' : 'text-zinc-600 hover:text-zinc-400')
                        }`}
                >
                    Volunteer
                </button>
            </motion.div>

            <div className="flex-1 min-h-0 overflow-y-auto pb-6 relative">
                <AnimatePresence mode="wait">
                    {activeTab === 'map' ? (
                        <motion.div
                            key="map"
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            {/* Map Simulator */}
                            <div className={`w-full h-56 rounded-3xl relative overflow-hidden flex flex-col items-center justify-center border shadow-2xl ${isEmergency ? 'bg-[#1a0505] border-red-900/60' : 'bg-[#121214] border-zinc-800/80'
                                }`}>
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>

                                {/* Radar sweep animation simulation */}
                                <div className={`absolute w-48 h-48 rounded-full border border-dashed opacity-20 animate-[spin_10s_linear_infinite] ${isEmergency ? 'border-red-500' : 'border-[#C5A367]'}`}></div>

                                <Navigation className={`w-10 h-10 mb-4 z-10 transition-colors duration-500 ${isEmergency ? 'text-red-500 animate-bounce' : 'text-[#C5A367]'}`} />

                                <div className={`w-[85%] p-4 rounded-2xl backdrop-blur-xl shadow-2xl relative z-10 border ${isEmergency ? 'bg-[#2A0808]/90 border-red-800/50 text-red-50' : 'bg-[#0A0A0C]/90 border-zinc-700/50 text-zinc-200'
                                    }`}>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">Active Route</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${isEmergency ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-[#C5A367]/10 border-[#C5A367]/20 text-[#C5A367]'}`}>1.2 KM</span>
                                    </div>
                                    <div className="text-sm font-serif italic font-medium leading-snug">
                                        {isEmergency ? 'Rerouting to higher elevation...' : 'Standard mapping active.'}
                                    </div>
                                </div>
                            </div>

                            <AnimatePresence>
                                {isEmergency && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                        className="bg-red-950/40 p-5 rounded-3xl border border-red-900/50 flex items-start gap-4 shadow-xl overflow-hidden"
                                    >
                                        <div className="bg-red-500/20 p-2 rounded-xl border border-red-500/30">
                                            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                                        </div>
                                        <div>
                                            <h4 className="font-serif text-xl text-red-100 mb-2">Road A Impassable</h4>
                                            <p className="text-xs text-red-200/70 leading-relaxed font-medium">Using PostGIS elevation metrics to route to nearest dry center: Dewan Sri Putra.</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="volunteer"
                            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}
                            className="space-y-4"
                        >
                            <p className={`text-[10px] uppercase font-bold tracking-widest mb-6 ${isEmergency ? 'text-red-400/80' : 'text-zinc-500'}`}>
                                Post-flood "Uber for Cleanup"
                            </p>

                            {[
                                { name: 'Keluarga Ahmad', dist: '300m', req: 'Mud cleanup', status: 'open', bounty: '50' },
                                { name: 'Rumah Makcik Kiah', dist: '1.2km', req: 'Furniture moving', status: 'accepted', bounty: '30' },
                            ].map((job, i) => (
                                <div key={i} className={`p-5 rounded-3xl border flex items-center justify-between transition-all hover:shadow-xl group cursor-pointer ${isEmergency ? 'bg-[#1a0505] border-red-900/30 hover:border-red-900/60' : 'bg-[#121214] border-zinc-800 hover:border-zinc-700'
                                    }`}>
                                    <div>
                                        <h4 className={`font-serif text-lg mb-2 transition-colors ${isEmergency ? 'text-red-100' : 'text-zinc-100'} group-hover:text-white`}>{job.name}</h4>
                                        <div className="flex items-center gap-2 text-[9px] font-bold tracking-widest uppercase">
                                            <span className={`flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-800/50 ${isEmergency ? 'text-red-400 border border-red-900/30' : 'text-zinc-400 border border-zinc-700/50'}`}>
                                                <MapPin className="w-3.5 h-3.5" /> {job.dist}
                                            </span>
                                            <span className={isEmergency ? 'text-red-400' : 'text-[#C5A367]'}>{job.req}</span>
                                        </div>
                                    </div>
                                    {job.status === 'open' ? (
                                        <button className={`px-4 py-2.5 rounded-xl text-[9px] font-bold tracking-widest uppercase transition-all shadow-lg active:scale-95 ${isEmergency ? 'bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white border border-red-600/30' : 'bg-[#C5A367]/10 text-[#C5A367] border border-[#C5A367]/20 hover:bg-[#C5A367] hover:text-[#0A0A0C]'
                                            }`}>
                                            ACCEPT<br />
                                            <span className="text-[8px] opacity-70 font-normal">+{job.bounty} pts</span>
                                        </button>
                                    ) : (
                                        <div className="flex flex-col items-end gap-1 text-zinc-500 text-[10px] font-bold uppercase tracking-widest bg-zinc-800/30 px-3 py-2 rounded-xl border border-zinc-800">
                                            <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 opacity-70" /> SECURED</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
