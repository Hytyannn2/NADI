import { useState, useEffect, useRef } from 'react';
import { Activity, Car, Check, Radar, AlertCircle, Camera, Cloud, Droplets, X, Loader2, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AiAnalysis {
    severityScore: number;
    severityLabel: string;
    damageType: string;
    estimatedWidth: string;
    estimatedDepth: string;
    repairMethod: string;
    repairCostMYR: string;
    priorityScore: number;
    riskAssessment: string;
    nearestRoadType: string;
    recommendedAction: string;
}

interface Anomaly {
    id: string;
    lat: string;
    lng: string;
    zDropped: number;
    verifications: number;
    status: 'pending' | 'verified';
    time: string;
    aiAnalysis?: AiAnalysis | null;
    isAnalyzing?: boolean;
    photoBase64?: string;
    expanded?: boolean;
}

interface WeatherData {
    condition: string;
    description: string;
    temp: number;
    humidity: number;
    rainMm: number;
    floodRisk: string;
}

export default function InfraView() {
    const [isDriving, setIsDriving] = useState(false);
    const [filter, setFilter] = useState<'all' | 'pending' | 'verified'>('all');
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [anomalies, setAnomalies] = useState<Anomaly[]>([
        { id: '1', lat: '3.1390', lng: '101.6869', zDropped: -4.2, verifications: 15, status: 'verified', time: '10 mins ago' },
        { id: '2', lat: '3.1402', lng: '101.6881', zDropped: -3.8, verifications: 3, status: 'pending', time: '1 hr ago' },
    ]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photoTargetId, setPhotoTargetId] = useState<string | null>(null);

    const filteredAnomalies = anomalies.filter(a => filter === 'all' || a.status === filter);
    const totalDetected = anomalies.length;
    const totalVerified = anomalies.filter(a => a.status === 'verified').length;

    // Fetch weather on mount
    useEffect(() => {
        fetch('/api/infra/weather?lat=3.139&lng=101.6869')
            .then(r => r.json())
            .then(d => { if (d.success) setWeather(d.weather); })
            .catch(() => {});
    }, []);

    // Simulate passive detection while driving
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isDriving) {
            interval = setInterval(() => {
                if (Math.random() < 0.1) {
                    const newAnomaly: Anomaly = {
                        id: Date.now().toString(),
                        lat: (3.13 + Math.random() * 0.02).toFixed(4),
                        lng: (101.68 + Math.random() * 0.02).toFixed(4),
                        zDropped: -(3 + Math.random() * 2),
                        verifications: 1,
                        status: 'pending',
                        time: 'Just now'
                    };
                    setAnomalies(prev => [newAnomaly, ...prev]);
                }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isDriving]);

    const analyzeAnomaly = async (id: string) => {
        const anomaly = anomalies.find(a => a.id === id);
        if (!anomaly || anomaly.isAnalyzing) return;

        setAnomalies(prev => prev.map(a => a.id === id ? { ...a, isAnalyzing: true } : a));

        try {
            const res = await fetch('/api/infra/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat: anomaly.lat, lng: anomaly.lng, zDropped: anomaly.zDropped, verifications: anomaly.verifications }),
            });
            const data = await res.json();
            if (data.success) {
                setAnomalies(prev => prev.map(a => a.id === id ? { ...a, aiAnalysis: data.analysis, isAnalyzing: false, expanded: true } : a));
            } else {
                setAnomalies(prev => prev.map(a => a.id === id ? { ...a, isAnalyzing: false } : a));
            }
        } catch {
            setAnomalies(prev => prev.map(a => a.id === id ? { ...a, isAnalyzing: false } : a));
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !photoTargetId) return;
        const id = photoTargetId;
        const anomaly = anomalies.find(a => a.id === id);
        if (!anomaly) return;

        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            setAnomalies(prev => prev.map(a => a.id === id ? { ...a, isAnalyzing: true, photoBase64: reader.result as string } : a));
            try {
                const res = await fetch('/api/infra/vision', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageBase64: base64, lat: anomaly.lat, lng: anomaly.lng, zDropped: anomaly.zDropped }),
                });
                const data = await res.json();
                if (data.success) {
                    setAnomalies(prev => prev.map(a => a.id === id ? { ...a, aiAnalysis: { ...a.aiAnalysis, ...data.analysis } as AiAnalysis, isAnalyzing: false, expanded: true } : a));
                } else {
                    setAnomalies(prev => prev.map(a => a.id === id ? { ...a, isAnalyzing: false } : a));
                }
            } catch {
                setAnomalies(prev => prev.map(a => a.id === id ? { ...a, isAnalyzing: false } : a));
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const severityColor = (score: number) => {
        if (score >= 4) return 'text-red-400 bg-red-500/10 border-red-500/20';
        if (score >= 3) return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
        return 'text-[#C5A367] bg-[#C5A367]/10 border-[#C5A367]/20';
    };

    const floodColor = (risk: string) => {
        if (risk === 'High') return 'text-red-400 bg-red-500/15 border-red-500/30';
        if (risk === 'Moderate') return 'text-orange-400 bg-orange-500/15 border-orange-500/30';
        return 'text-[#10B981] bg-[#10B981]/15 border-[#10B981]/30';
    };

    return (
        <div className="p-6 h-full flex flex-col relative z-0">
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handlePhotoUpload} />

            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="mb-6 flex justify-between items-end"
            >
                <div>
                    <h2 className="text-3xl font-serif text-white tracking-tight">NADI Infra</h2>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[#C5A367] mt-1 relative inline-block">
                        AI TELEMETRY [Z-AXIS + VISION]
                        {isDriving && <span className="absolute -right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>}
                    </p>
                </div>
                <button
                    onClick={() => setIsDriving(!isDriving)}
                    className={`shrink-0 px-4 py-3 flex items-center justify-center gap-2 rounded-xl transition-all shadow-lg text-[10px] uppercase font-bold tracking-widest border focus:outline-none active:scale-95 ${isDriving ? 'bg-[#1a0505] text-red-400 shadow-[0_0_20px_rgba(220,38,38,0.2)] border-red-900/50' : 'bg-[#121214] border-zinc-800 text-zinc-300 hover:bg-zinc-800/80'}`}
                >
                    <Car className={`w-4 h-4 ${isDriving ? 'animate-bounce text-red-500' : 'text-zinc-500'}`} />
                    {isDriving ? 'ACTIVE' : 'START DRIVE'}
                </button>
            </motion.div>

            {/* Weather + Flood Risk Banner */}
            {weather && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}
                    className="bg-[#0A0A0C] border border-zinc-800/80 rounded-2xl p-4 mb-6 shadow-lg"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-500/10 p-2 rounded-xl border border-blue-500/20">
                                <Cloud className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                                <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500">Live Weather</span>
                                <p className="text-sm font-medium text-zinc-200">{weather.condition} · {weather.temp}°C</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <span className="text-[8px] uppercase font-bold tracking-widest text-zinc-600">Rain</span>
                                <p className="text-sm font-medium text-zinc-300 flex items-center gap-1"><Droplets className="w-3 h-3 text-blue-400" />{weather.rainMm}mm</p>
                            </div>
                            <span className={`text-[8px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg border ${floodColor(weather.floodRisk)}`}>
                                Flood: {weather.floodRisk}
                            </span>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Stats */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                className="grid grid-cols-2 gap-4 mb-6"
            >
                <div className="bg-[#0f1a14] text-white p-5 rounded-3xl relative overflow-hidden shadow-xl border border-[#10B981]/20">
                    <div className="absolute -inset-4 bg-gradient-to-br from-[#10B981]/10 to-transparent blur-2xl"></div>
                    <Activity className="w-5 h-5 text-[#C5A367] mb-3 opacity-90 relative z-10" />
                    <div className="text-4xl font-light mb-1 text-[#FAFAFA] relative z-10 tracking-tight">{totalDetected}</div>
                    <div className="text-[9px] text-[#10B981]/70 font-bold uppercase tracking-widest relative z-10">Detected</div>
                </div>
                <div className="bg-gradient-to-br from-[#1A1C16] to-[#0A0A0C] border border-[#C5A367]/20 text-white p-5 rounded-3xl relative overflow-hidden shadow-xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#C5A367]/10 rounded-full blur-2xl -translate-y-10 translate-x-10"></div>
                    <Check className="w-5 h-5 text-[#C5A367] mb-3 relative z-10" />
                    <div className="text-4xl font-light mb-1 text-white relative z-10 tracking-tight">{totalVerified}</div>
                    <div className="text-[9px] text-[#C5A367]/80 font-bold uppercase tracking-widest relative z-10">Verified</div>
                </div>
            </motion.div>

            {/* Info Banner */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="bg-[#0A0A0C] border border-zinc-800/80 rounded-2xl p-4 mb-6 flex items-start gap-4 shadow-lg"
            >
                <div className="bg-[#10B981]/10 p-2 rounded-xl border border-[#10B981]/20 shrink-0">
                    <Radar className="w-5 h-5 text-[#10B981]" />
                </div>
                <p className="text-[11px] font-medium leading-relaxed mt-0.5 text-zinc-400">
                    <span className="text-zinc-200 font-bold">AI-Powered:</span> Tap <Zap className="w-3 h-3 inline text-[#C5A367]" /> to classify any anomaly with Gemini. Tap <Camera className="w-3 h-3 inline text-blue-400" /> to add photo evidence for vision analysis.
                </p>
            </motion.div>

            {/* Anomaly List */}
            <div className="flex-1 pb-10">
                <motion.h3
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                    className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-6 flex items-center justify-between px-1"
                >
                    <span>Live Deviations</span>
                    <div className="flex gap-2">
                        {(['all', 'pending', 'verified'] as const).map((f) => (
                            <button key={f} onClick={() => setFilter(f)}
                                className={`px-2 py-1 rounded text-[8px] border transition-all ${filter === f ? 'bg-zinc-800 border-zinc-600 text-zinc-200' : 'bg-transparent border-zinc-800 text-zinc-600 hover:text-zinc-400'}`}
                            >{f.toUpperCase()}</button>
                        ))}
                    </div>
                    <span className="flex items-center gap-1.5 opacity-60">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span> Live
                    </span>
                </motion.h3>

                <div className="space-y-4">
                    <AnimatePresence>
                        {filteredAnomalies.map((a, i) => (
                            <motion.div
                                key={a.id}
                                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ delay: 0.05 * i, type: "spring", stiffness: 300, damping: 24 }}
                                className="bg-[#121214] rounded-3xl border border-zinc-800 shadow-xl relative overflow-hidden transition-all hover:bg-[#1A1A1E]"
                            >
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${a.status === 'verified' ? 'bg-[#C5A367] shadow-[0_0_10px_rgba(197,163,103,0.8)]' : 'bg-red-900/50'}`}></div>

                                <div className="p-5 flex gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${a.status === 'verified' ? 'bg-[#C5A367]/10 text-[#C5A367] border-[#C5A367]/20' : 'bg-[#1a0505] text-red-500 border-red-900/40'}`}>
                                        {a.status === 'verified' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-mono text-[9px] bg-[#0A0A0C] text-zinc-400 px-2.5 py-1 rounded-md border border-zinc-800/80 uppercase font-bold tracking-widest">
                                                ID: {a.id.slice(-4)}
                                            </span>
                                            <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">{a.time}</span>
                                        </div>
                                        <h4 className="font-serif text-lg text-white mb-3 mt-2">{a.lat}°, {a.lng}°</h4>
                                        <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest border-t border-zinc-800/50 pt-3">
                                            <span className="text-red-400 bg-[#1a0505] border border-red-900/30 px-2 py-1 rounded-md">Z: {a.zDropped.toFixed(1)}g</span>
                                            <span className={a.verifications >= 15 ? 'text-[#C5A367]' : 'text-zinc-500'}>
                                                {a.verifications}/15 VERIFICATIONS
                                            </span>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-2 mt-4">
                                            <button
                                                onClick={() => analyzeAnomaly(a.id)}
                                                disabled={a.isAnalyzing}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-[#C5A367]/10 text-[#C5A367] border border-[#C5A367]/20 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-[#C5A367]/20 transition-all active:scale-95 disabled:opacity-40"
                                            >
                                                {a.isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                                AI Analyze
                                            </button>
                                            <button
                                                onClick={() => { setPhotoTargetId(a.id); fileInputRef.current?.click(); }}
                                                disabled={a.isAnalyzing}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-blue-500/20 transition-all active:scale-95 disabled:opacity-40"
                                            >
                                                <Camera className="w-3.5 h-3.5" /> Photo
                                            </button>
                                            {a.aiAnalysis && (
                                                <button onClick={() => setAnomalies(prev => prev.map(x => x.id === a.id ? { ...x, expanded: !x.expanded } : x))}
                                                    className="ml-auto p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                                                >
                                                    {a.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* AI Analysis Result */}
                                <AnimatePresence>
                                    {a.aiAnalysis && a.expanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-5 pb-5 pt-2 border-t border-zinc-800/50 space-y-3">
                                                {a.photoBase64 && (
                                                    <div className="rounded-2xl overflow-hidden border border-zinc-800 h-32">
                                                        <img src={a.photoBase64} alt="Evidence" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap gap-2">
                                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg border ${severityColor(a.aiAnalysis.severityScore)}`}>
                                                        {a.aiAnalysis.severityLabel || a.aiAnalysis.damageType} (Sev {a.aiAnalysis.severityScore}/5)
                                                    </span>
                                                    {a.aiAnalysis.nearestRoadType && (
                                                        <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg border bg-zinc-800/50 border-zinc-700 text-zinc-300">
                                                            {a.aiAnalysis.nearestRoadType}
                                                        </span>
                                                    )}
                                                    {a.aiAnalysis.recommendedAction && (
                                                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg border ${a.aiAnalysis.recommendedAction === 'Immediate' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400'}`}>
                                                            {a.aiAnalysis.recommendedAction}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {a.aiAnalysis.estimatedWidth && <div className="bg-[#0A0A0C] rounded-xl p-3 border border-zinc-800/50"><span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest block mb-1">Size</span><span className="text-xs text-zinc-300 font-medium">{a.aiAnalysis.estimatedWidth} × {a.aiAnalysis.estimatedDepth}</span></div>}
                                                    {a.aiAnalysis.repairCostMYR && <div className="bg-[#0A0A0C] rounded-xl p-3 border border-zinc-800/50"><span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest block mb-1">Est. Cost</span><span className="text-xs text-[#C5A367] font-medium">{a.aiAnalysis.repairCostMYR}</span></div>}
                                                </div>
                                                {a.aiAnalysis.riskAssessment && (
                                                    <p className="text-[11px] text-zinc-400 font-medium leading-relaxed bg-[#0A0A0C] rounded-xl p-3 border border-zinc-800/50">
                                                        <span className="text-zinc-200 font-bold">Risk: </span>{a.aiAnalysis.riskAssessment}
                                                    </p>
                                                )}
                                                {a.aiAnalysis.repairMethod && (
                                                    <p className="text-[11px] text-zinc-500 font-medium leading-relaxed">
                                                        <span className="text-zinc-400 font-bold">Fix: </span>{a.aiAnalysis.repairMethod}
                                                    </p>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {anomalies.length === 0 && (
                        <div className="text-center py-12 text-zinc-600 border border-dashed border-zinc-800 rounded-3xl text-[10px] font-bold uppercase tracking-widest">
                            AWAITING TELEMETRY...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
