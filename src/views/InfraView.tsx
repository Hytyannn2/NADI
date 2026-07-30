'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Check, AlertCircle, Camera, Loader2, Zap, ChevronDown, ChevronUp, Gauge, Video, VideoOff, Shield, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useGame } from '../context/GameContext';
import { useXP } from '../hooks/useXP';
import { useTheme } from '../context/ThemeContext';
import { usePotholeDetector, type PotholeDetection } from '../hooks/usePotholeDetector';
import { useDashcam } from '../hooks/useDashcam';
import { createClient } from '@/src/lib/supabase/client';

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

interface ClusterInfo {
    clusterId: string;
    uniqueDevices: number;
    threshold: number;
    isUrban: boolean;
    isVerified: boolean;
}

interface Anomaly {
    id: string;
    lat: number;
    lng: number;
    zDropped: number;
    verifications: number;
    status: 'pending' | 'verified';
    time: string;
    aiAnalysis?: AiAnalysis | null;
    isAnalyzing?: boolean;
    photoBase64?: string;
    expanded?: boolean;
    confidenceScore?: number;
    speedKmh?: number;
    cluster?: ClusterInfo | null;
    snapshotBase64?: string;
}

// Device fingerprint (persistent per browser)
function getDeviceFingerprint(): string {
    const key = 'nadi_device_fp';
    let fp = localStorage.getItem(key);
    if (!fp) {
        fp = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(key, fp);
    }
    return fp;
}

export default function InfraView() {
    const { formatTime } = useTheme();
    const [filter, setFilter] = useState<'all' | 'pending' | 'verified'>('all');
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photoTargetId, setPhotoTargetId] = useState<string | null>(null);

    const { completeQuest, incrementStat } = useGame();
    const { addXp } = useXP();
    const supabase = createClient();

    // === NEW: Sensor Fusion Hook ===
    const detector = usePotholeDetector();

    // === NEW: Dashcam Hook ===
    const dashcam = useDashcam();

    const filteredAnomalies = anomalies.filter(a => filter === 'all' || a.status === filter);
    const totalDetected = anomalies.length;
    const totalVerified = anomalies.filter(a => a.status === 'verified').length;
    const avgConfidence = anomalies.length > 0
        ? Math.round(anomalies.reduce((sum, a) => sum + (a.confidenceScore || 0), 0) / anomalies.length)
        : 0;

    // === AUTO-START: Detection runs always-on like Life360 ===
    useEffect(() => {
        detector.startDriving();
        return () => { detector.stopDriving(); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Load local & DB anomalies on mount
    useEffect(() => {
        // 1. Load offline / persistent local anomalies first
        const savedLocal = localStorage.getItem('nadi_local_potholes');
        let localAnomalies: Anomaly[] = [];
        if (savedLocal) {
            try {
                localAnomalies = JSON.parse(savedLocal);
                setAnomalies(localAnomalies);
            } catch (e) {
                console.error("Failed to parse local potholes from storage", e);
            }
        }

        // 2. Load DB anomalies from Supabase and merge
        supabase.from('nadi_infra_reports').select('*').order('created_at', { ascending: false }).limit(50)
            .then(({ data }) => {
                if (data && data.length > 0) {
                    const mapped: Anomaly[] = data.map((d: any) => ({
                        id: d.id,
                        lat: typeof d.lat === 'string' ? parseFloat(d.lat) : d.lat,
                        lng: typeof d.lng === 'string' ? parseFloat(d.lng) : d.lng,
                        zDropped: d.z_dropped,
                        verifications: d.verifications,
                        status: d.status,
                        time: formatTime(d.created_at),
                        aiAnalysis: d.ai_analysis,
                        photoBase64: d.photo_url,
                        confidenceScore: d.confidence_score || 0,
                        speedKmh: d.speed_kmh || 0,
                        snapshotBase64: d.snapshot_base64,
                    }));
                    setAnomalies(prev => {
                        const merged = [...prev];
                        mapped.forEach(m => {
                            if (!merged.some(item => item.id === m.id)) {
                                merged.push(m);
                            }
                        });
                        localStorage.setItem('nadi_local_potholes', JSON.stringify(merged.slice(0, 50)));
                        return merged;
                    });
                }
            });

        // Real-time subscription
        const channel = supabase.channel('infra_reports')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'nadi_infra_reports' }, (payload) => {
                if (payload.new) {
                    const d = payload.new as any;
                    setAnomalies(prev => {
                        if (prev.some(a => a.id === d.id)) return prev;
                        const updated = [{
                            id: d.id,
                            lat: typeof d.lat === 'string' ? parseFloat(d.lat) : d.lat,
                            lng: typeof d.lng === 'string' ? parseFloat(d.lng) : d.lng,
                            zDropped: d.z_dropped,
                            verifications: d.verifications,
                            status: d.status,
                            time: formatTime(d.created_at),
                            aiAnalysis: d.ai_analysis,
                            photoBase64: d.photo_url,
                            confidenceScore: d.confidence_score || 0,
                            speedKmh: d.speed_kmh || 0,
                            snapshotBase64: d.snapshot_base64,
                        }, ...prev];
                        localStorage.setItem('nadi_local_potholes', JSON.stringify(updated.slice(0, 50)));
                        return updated;
                    });
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'nadi_infra_reports' }, (payload) => {
                if (payload.new) {
                    const d = payload.new as any;
                    setAnomalies(prev => {
                        const updated = prev.map(a => a.id === d.id ? {
                            ...a,
                            status: d.status,
                            verifications: d.verifications,
                            aiAnalysis: d.ai_analysis || a.aiAnalysis,
                        } : a);
                        localStorage.setItem('nadi_local_potholes', JSON.stringify(updated.slice(0, 50)));
                        return updated;
                    });
                }
            })
            .subscribe();
            
        return () => { supabase.removeChannel(channel); };
    }, [supabase]);

    // === Handle new detections from usePotholeDetector ===
    useEffect(() => {
        if (!detector.lastDetection) return;

        const det = detector.lastDetection;
        const tempId = det.id;

        // Capture dashcam frame if active
        let snapshot: string | null = null;
        if (dashcam.isDashcamEnabled && dashcam.isStreaming) {
            snapshot = dashcam.captureFrame();
        }

        const newAnomaly: Anomaly = {
            id: tempId,
            lat: det.lat,
            lng: det.lng,
            zDropped: det.zDrop,
            verifications: 1,
            status: 'pending',
            time: 'Just now',
            confidenceScore: det.confidenceScore,
            speedKmh: det.speedKmh,
            snapshotBase64: snapshot || undefined,
        };
        
        setAnomalies(prev => {
            const updated = [newAnomaly, ...prev];
            localStorage.setItem('nadi_local_potholes', JSON.stringify(updated.slice(0, 50)));
            return updated;
        });

        // Persist to DB with sensor fusion data
        const deviceFp = getDeviceFingerprint();
        supabase.from('nadi_infra_reports').insert({
            lat: String(det.lat),
            lng: String(det.lng),
            z_dropped: det.zDrop,
            speed_kmh: det.speedKmh,
            gyro_max_rotation: det.gyroMaxRotation,
            waveform_duration_ms: det.waveformDurationMs,
            confidence_score: det.confidenceScore,
            device_fingerprint: deviceFp,
            snapshot_base64: snapshot?.split(',')[1] || null, // Remove data:image/jpeg;base64, prefix
            status: 'pending'
        }).select().single().then(async ({ data }) => {
            if (data) {
                // Update temp ID with real DB ID
                setAnomalies(prev => prev.map(a => a.id === tempId ? { ...a, id: data.id } : a));

                // Trigger clustering
                try {
                    const clusterRes = await fetch('/api/infra/cluster', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            reportId: data.id,
                            lat: det.lat,
                            lng: det.lng,
                            deviceFingerprint: deviceFp,
                        }),
                    });
                    const clusterData = await clusterRes.json();
                    if (clusterData.success) {
                        setAnomalies(prev => prev.map(a => a.id === data.id ? {
                            ...a,
                            cluster: clusterData.cluster,
                            status: clusterData.cluster.isVerified ? 'verified' : a.status,
                        } : a));
                    }
                } catch {
                    // Clustering failed silently — report is still saved
                }
            }
        });
    }, [detector.lastDetection]);

    // Handle dashcam toggle (only manual control remaining)
    const handleToggleDashcam = async () => {
        if (dashcam.isDashcamEnabled) {
            dashcam.disableDashcam();
        } else {
            await dashcam.enableDashcam();
        }
    };

    const analyzeAnomaly = async (id: string) => {
        const anomaly = anomalies.find(a => a.id === id);
        if (!anomaly || anomaly.isAnalyzing) return;

        setAnomalies(prev => prev.map(a => a.id === id ? { ...a, isAnalyzing: true } : a));

        try {
            const res = await fetch('/api/infra/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat: anomaly.lat,
                    lng: anomaly.lng,
                    zDropped: anomaly.zDropped,
                    verifications: anomaly.verifications,
                    confidenceScore: anomaly.confidenceScore,
                    speedKmh: anomaly.speedKmh,
                    clusterSize: anomaly.cluster?.uniqueDevices || 1,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setAnomalies(prev => prev.map(a => a.id === id ? { ...a, aiAnalysis: data.analysis, isAnalyzing: false, expanded: true, status: 'verified' } : a));
                
                await supabase.from('nadi_infra_reports').update({
                    ai_analysis: data.analysis,
                    status: 'verified'
                }).eq('id', id);

                incrementStat('reports');
                const xp = await completeQuest('report');
                if (xp > 0) addXp(xp);
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
                    setAnomalies(prev => prev.map(a => a.id === id ? { ...a, aiAnalysis: { ...a.aiAnalysis, ...data.analysis } as AiAnalysis, isAnalyzing: false, expanded: true, status: 'verified' } : a));
                    
                    await supabase.from('nadi_infra_reports').update({
                        ai_analysis: { ...anomaly.aiAnalysis, ...data.analysis },
                        status: 'verified'
                    }).eq('id', id);

                    incrementStat('reports');
                    const xp = await completeQuest('report');
                    if (xp > 0) addXp(xp);
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

    const confidenceColor = (score: number) => {
        if (score >= 80) return { text: 'text-[#10B981]', bg: 'bg-[#10B981]/10', border: 'border-[#10B981]/20', label: 'HIGH' };
        if (score >= 60) return { text: 'text-[#C5A367]', bg: 'bg-[#C5A367]/10', border: 'border-[#C5A367]/20', label: 'MED' };
        return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'LOW' };
    };

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="p-5 h-full flex flex-col relative z-0">
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handlePhotoUpload} />
            
            {/* Single video element & Overlay — Portal to document.body for true edge-to-edge fullscreen */}
            {mounted && createPortal(
                <>
                    <video
                        ref={dashcam.videoRef}
                        className={dashcam.isDashcamEnabled ? 'fixed inset-0 w-screen h-screen object-cover z-[999999]' : 'hidden'}
                        playsInline
                        muted
                        autoPlay
                    />
                    <AnimatePresence>
                        {dashcam.isDashcamEnabled && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[9999999] pointer-events-none"
                            >
                                {/* Top bar */}
                                <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between pointer-events-auto bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                                    <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
                                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                                        <span className="text-xs font-bold text-white uppercase tracking-widest">Dashcam Live</span>
                                    </div>
                                    <button
                                        onClick={handleToggleDashcam}
                                        className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/20 active:scale-90 transition-transform shadow-2xl"
                                    >
                                        <span className="text-white text-xl font-bold"></span>
                                    </button>
                                </div>
                                {/* Bottom info */}
                                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <Shield className="w-4 h-4 text-[#10B981]" />
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">Privacy Mode</span>
                                    </div>
                                    <p className="text-xs text-zinc-300 font-medium leading-relaxed max-w-lg">
                                        Only captures 1 frame on pothole impact • No continuous video recording stored or saved
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>,
                document.body
            )}

            {/* === HEADER === */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="mb-6 flex justify-between items-end"
            >
                <div>
                    <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>NADI Infra</h2>
                    <p className="text-xs font-medium mt-1 relative inline-block" style={{ color: 'var(--text-muted)' }}>
                        {detector.isCalibrating ? (
                            <span className="flex items-center gap-2">
                                <Gauge className="w-3 h-3 text-[#C5A367] animate-pulse" />
                                Calibrating sensors...
                            </span>
                        ) : (
                            <>
                                Smart pothole detection
                                <span className="absolute -right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
                            </>
                        )}
                    </p>
                </div>
                {/* Dashcam Toggle — always available so user can enable before driving */}
                <button
                    onClick={handleToggleDashcam}
                    className={`shrink-0 px-3 py-3 flex items-center justify-center gap-1.5 rounded-xl transition-all text-xs font-bold border focus:outline-none active:scale-95 ${dashcam.isDashcamEnabled ? 'bg-red-50 text-red-600 border-red-200' : ''}`}
                    style={!dashcam.isDashcamEnabled ? { background: 'var(--bg-subtle)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' } : {}}
                >
                    {dashcam.isDashcamEnabled ? <Video className="w-4 h-4 text-red-500" /> : <VideoOff className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
                    {dashcam.isDashcamEnabled ? '' : 'Cam'}
                </button>
            </motion.div>

            {/* === DRIVING HUD — only visible when actually moving === */}
            <AnimatePresence>
                {detector.currentSpeed > 0 && !detector.isCalibrating && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mb-6 bg-gradient-to-r from-[#0A0A0C] to-[#0f1a14] border border-zinc-800 rounded-2xl p-4 shadow-xl"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {/* Speed */}
                                <div className="text-center">
                                    <div className="text-2xl font-light text-white font-mono tracking-tight">{detector.currentSpeed}</div>
                                    <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">km/h</div>
                                </div>
                                <div className="w-px h-8 bg-zinc-800"></div>
                                {/* Detections */}
                                <div className="text-center">
                                    <div className="text-2xl font-light text-[#C5A367] font-mono tracking-tight">{detector.detectionCount}</div>
                                    <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Hits</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Dashcam Status */}
                                {dashcam.isDashcamEnabled && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">REC</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Motion Error */}
            {detector.motionError && (
                <div className="rounded-xl px-4 py-3 mb-4 text-xs font-medium" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
                     {detector.motionError}
                </div>
            )}

            {/* Dashcam Error */}
            {dashcam.error && (
                <div className="rounded-xl px-4 py-3 mb-4 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                     {dashcam.error}
                </div>
            )}

            {/* === STATS === */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                className="grid grid-cols-3 gap-3 mb-6"
            >
                <div className="bg-[#0f1a14] text-white p-4 rounded-2xl relative overflow-hidden shadow-xl border border-[#10B981]/20">
                    <div className="absolute -inset-4 bg-gradient-to-br from-[#10B981]/10 to-transparent blur-2xl"></div>
                    <Activity className="w-4 h-4 text-[#C5A367] mb-2 opacity-90 relative z-10" />
                    <div className="text-3xl font-light mb-0.5 text-[#FAFAFA] relative z-10 tracking-tight">{totalDetected}</div>
                    <div className="text-[9px] text-[#10B981]/70 font-bold uppercase tracking-widest relative z-10">Detected</div>
                </div>
                <div className="bg-gradient-to-br from-[#1A1C16] to-[#0A0A0C] border border-[#C5A367]/20 text-white p-4 rounded-2xl relative overflow-hidden shadow-xl">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#C5A367]/10 rounded-full blur-2xl -translate-y-8 translate-x-8"></div>
                    <Check className="w-4 h-4 text-[#C5A367] mb-2 relative z-10" />
                    <div className="text-3xl font-light mb-0.5 text-white relative z-10 tracking-tight">{totalVerified}</div>
                    <div className="text-[9px] text-[#C5A367]/80 font-bold uppercase tracking-widest relative z-10">Verified</div>
                </div>
                <div className="bg-[#0A0A0C] border border-zinc-800 text-white p-4 rounded-2xl relative overflow-hidden shadow-xl">
                    <Shield className="w-4 h-4 text-blue-400 mb-2 relative z-10" />
                    <div className="text-3xl font-light mb-0.5 text-white relative z-10 tracking-tight">{avgConfidence}<span className="text-lg text-zinc-500">%</span></div>
                    <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest relative z-10">Confidence</div>
                </div>
            </motion.div>



            {/* === ANOMALY LIST === */}
            <div className="flex-1 pb-10">
                <motion.h3
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                    className="text-xs uppercase font-bold tracking-widest text-zinc-400 mb-6 flex items-center justify-between px-1"
                >
                    <span>Pothole Reports</span>
                    <div className="flex gap-2">
                        {(['all', 'pending', 'verified'] as const).map((f) => (
                            <button key={f} onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] border transition-all ${filter === f ? 'bg-zinc-800 border-zinc-600 text-zinc-200' : 'bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                            >{f.toUpperCase()}</button>
                        ))}
                    </div>
                </motion.h3>

                <div className="space-y-4">
                    <AnimatePresence>
                        {filteredAnomalies.map((a, i) => {
                            const conf = confidenceColor(a.confidenceScore || 0);
                            return (
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
                                            <span className="font-mono text-[10px] bg-[#0A0A0C] text-zinc-400 px-3 py-1.5 rounded-md border border-zinc-800/80 uppercase font-bold tracking-widest">
                                                ID: {a.id.slice(-4)}
                                            </span>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{a.time}</span>
                                        </div>
                                        <h4 className="font-serif text-lg text-white mb-2 mt-2">{typeof a.lat === 'number' ? a.lat.toFixed(4) : a.lat}°, {typeof a.lng === 'number' ? a.lng.toFixed(4) : a.lng}°</h4>
                                        
                                        {/* === Sensor Fusion Badges === */}
                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                            {/* Confidence Score */}
                                            {a.confidenceScore != null && a.confidenceScore > 0 && (
                                                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border ${conf.text} ${conf.bg} ${conf.border}`}>
                                                    <Shield className="w-3 h-3 inline mr-1" />{conf.label} {a.confidenceScore}%
                                                </span>
                                            )}
                                            {/* Speed */}
                                            {a.speedKmh != null && a.speedKmh > 0 && (
                                                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border bg-blue-500/10 border-blue-500/20 text-blue-400">
                                                    <Gauge className="w-3 h-3 inline mr-1" />{a.speedKmh} km/h
                                                </span>
                                            )}
                                            {/* Dashcam indicator */}
                                            {a.snapshotBase64 && (
                                                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border bg-purple-500/10 border-purple-500/20 text-purple-400">
                                                     Frame
                                                </span>
                                            )}
                                        </div>

                                        {/* Cluster Verification Progress */}
                                        {a.cluster && (
                                            <div className="mb-3 bg-[#0A0A0C] rounded-xl p-3 border border-zinc-800/50">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1">
                                                        <Users className="w-3 h-3" /> Crowdsource Cluster
                                                    </span>
                                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${a.cluster.isVerified ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-zinc-800 text-zinc-400'}`}>
                                                        {a.cluster.isVerified ? ' Verified' : `${a.cluster.isUrban ? 'Urban' : 'Rural'}`}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${a.cluster.isVerified ? 'bg-[#10B981]' : 'bg-[#C5A367]'}`}
                                                            style={{ width: `${Math.min(100, (a.cluster.uniqueDevices / a.cluster.threshold) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-mono text-zinc-400">
                                                        {a.cluster.uniqueDevices}/{a.cluster.threshold}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest border-t border-zinc-800/50 pt-3">
                                            <span className="text-red-400 bg-[#1a0505] border border-red-900/30 px-3 py-1.5 rounded-md">Z: {a.zDropped.toFixed(1)}g</span>
                                            <span className={a.verifications >= 15 ? 'text-[#C5A367]' : 'text-zinc-400'}>
                                                {a.verifications}/15 VERIFICATIONS
                                            </span>
                                        </div>

                                        {/* Dashcam Snapshot Preview */}
                                        {a.snapshotBase64 && (
                                            <div className="mt-3 rounded-2xl overflow-hidden border border-zinc-800 h-28">
                                                <img src={a.snapshotBase64.startsWith('data:') ? a.snapshotBase64 : `data:image/jpeg;base64,${a.snapshotBase64}`} alt="Dashcam capture" className="w-full h-full object-cover" />
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex gap-2 mt-4">
                                            <button
                                                onClick={() => analyzeAnomaly(a.id)}
                                                disabled={a.isAnalyzing}
                                                className="flex items-center gap-1.5 px-4 py-3 bg-[#C5A367]/10 text-[#C5A367] border border-[#C5A367]/20 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#C5A367]/20 transition-all active:scale-95 disabled:opacity-60"
                                            >
                                                {a.isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                                AI Analyze
                                            </button>
                                            <button
                                                onClick={() => { setPhotoTargetId(a.id); fileInputRef.current?.click(); }}
                                                disabled={a.isAnalyzing}
                                                className="flex items-center gap-1.5 px-4 py-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500/20 transition-all active:scale-95 disabled:opacity-60"
                                            >
                                                <Camera className="w-4 h-4" /> Photo
                                            </button>
                                            {a.aiAnalysis && (
                                                <button onClick={() => setAnomalies(prev => prev.map(x => x.id === a.id ? { ...x, expanded: !x.expanded } : x))}
                                                    className="ml-auto p-3 text-zinc-400 hover:text-zinc-200 transition-colors"
                                                >
                                                    {a.expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
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
                                                    <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border ${severityColor(a.aiAnalysis.severityScore)}`}>
                                                        {a.aiAnalysis.severityLabel || a.aiAnalysis.damageType} (Sev {a.aiAnalysis.severityScore}/5)
                                                    </span>
                                                    {a.aiAnalysis.nearestRoadType && (
                                                        <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border bg-zinc-800/50 border-zinc-700 text-zinc-300">
                                                            {a.aiAnalysis.nearestRoadType}
                                                        </span>
                                                    )}
                                                    {a.aiAnalysis.recommendedAction && (
                                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border ${a.aiAnalysis.recommendedAction === 'Immediate' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-zinc-800/50 border-zinc-700 text-zinc-400'}`}>
                                                            {a.aiAnalysis.recommendedAction}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {a.aiAnalysis.estimatedWidth && <div className="bg-[#0A0A0C] rounded-xl p-3 border border-zinc-800/50"><span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-1">Size</span><span className="text-xs text-zinc-300 font-medium">{a.aiAnalysis.estimatedWidth} × {a.aiAnalysis.estimatedDepth}</span></div>}
                                                    {a.aiAnalysis.repairCostMYR && <div className="bg-[#0A0A0C] rounded-xl p-3 border border-zinc-800/50"><span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-1">Est. Cost</span><span className="text-xs text-[#C5A367] font-medium">{a.aiAnalysis.repairCostMYR}</span></div>}
                                                </div>
                                                {a.aiAnalysis.riskAssessment && (
                                                    <p className="text-xs text-zinc-300 font-medium leading-relaxed bg-[#0A0A0C] rounded-xl p-3 border border-zinc-800/50">
                                                        <span className="text-zinc-100 font-bold">Risk: </span>{a.aiAnalysis.riskAssessment}
                                                    </p>
                                                )}
                                                {a.aiAnalysis.repairMethod && (
                                                    <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                                                        <span className="text-zinc-300 font-bold">Fix: </span>{a.aiAnalysis.repairMethod}
                                                    </p>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                        })}
                    </AnimatePresence>
                    {anomalies.length === 0 && (
                        <div className="text-center py-12 text-zinc-400 border border-dashed border-zinc-800 rounded-3xl text-sm font-bold uppercase tracking-widest">
                            No potholes detected yet
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
