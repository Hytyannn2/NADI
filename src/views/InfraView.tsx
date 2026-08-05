'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Check, AlertCircle, Camera, Loader2, Zap, ChevronDown, ChevronUp, Gauge, Video, VideoOff, Shield, Users, Share2, Send, Plus, Sparkles, Mic, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import GlobalVoiceMic from '@/src/components/GlobalVoiceMic';
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
    title?: string;
    source?: 'sensor' | 'voice' | 'text' | 'dashcam';
    originalText?: string;
    translatedText?: string;
    locationName?: string;
    urgency?: 'Low' | 'Medium' | 'High';
    detectedDialect?: string;
    dialectWords?: string[];
    userIntendedMeaning?: string;
    feedbackGiven?: 'up' | 'down';
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
    const [filter, setFilter] = useState<'all' | 'potholes' | 'civic' | 'verified'>('all');
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photoTargetId, setPhotoTargetId] = useState<string | null>(null);

    const [manualDescription, setManualDescription] = useState('');
    const [isParsingVoice, setIsParsingVoice] = useState(false);
    const [isSubmittingManual, setIsSubmittingManual] = useState(false);
    const [shareModalAnomaly, setShareModalAnomaly] = useState<Anomaly | null>(null);
    const [copiedToast, setCopiedToast] = useState(false);

    const { completeQuest, incrementStat } = useGame();
    const { addXp } = useXP();
    const supabase = createClient();

    const [feedbackModalAnomaly, setFeedbackModalAnomaly] = useState<Anomaly | null>(null);
    const [feedbackCorrectText, setFeedbackCorrectText] = useState('');
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [feedbackSuccessToast, setFeedbackSuccessToast] = useState(false);

    const handleSendAduan = async () => {
        const textToProcess = manualDescription.trim();
        if (!textToProcess || isParsingVoice) return;

        setIsParsingVoice(true);
        let resData: any = null;

        try {
            const res = await fetch('/api/suara/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inputText: textToProcess,
                    targetLanguage: 'ms',
                    dialectRegion: 'kelantan'
                })
            });
            if (res.ok) {
                const json = await res.json();
                if (json.success && json.data) {
                    resData = json.data;
                }
            }
        } catch (err) {
            console.warn('Suara AI parse notice:', err);
        } finally {
            setIsParsingVoice(false);
        }

        const intent = resData?.intent || 'Aduan Infrastruktur';
        const locName = resData?.location || 'Kota Bharu';
        const translation = resData?.simplifiedTranslation || textToProcess;
        const dialect = resData?.detectedDialect || 'kelantan';
        const urgency = (resData?.urgency || 'Medium') as 'Low' | 'Medium' | 'High';
        const intendedMeaning = resData?.userIntendedMeaning || translation;
        const parsedConfidence = resData?.confidenceScore
            ? Number(resData.confidenceScore)
            : Math.min(98, Math.max(72, 78 + (resData?.dialectWords?.length || 0) * 4));

        const newA: Anomaly = {
            id: `aduan-${Date.now()}`,
            lat: resData?.coordinates?.lat || 6.0833,
            lng: resData?.coordinates?.lng || 102.2500,
            zDropped: 0,
            verifications: 1,
            status: 'pending',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            title: `${intent} @ ${locName}`,
            source: 'voice',
            originalText: textToProcess,
            translatedText: translation,
            userIntendedMeaning: intendedMeaning,
            locationName: locName,
            urgency: urgency,
            detectedDialect: dialect,
            dialectWords: resData?.dialectWords || [],
            confidenceScore: parsedConfidence,
            aiAnalysis: {
                severityScore: urgency === 'High' ? 4 : urgency === 'Medium' ? 3 : 2,
                severityLabel: `Aduan Dialek ${dialect.toUpperCase()}`,
                damageType: intent,
                estimatedWidth: '—',
                estimatedDepth: '—',
                repairMethod: 'Penilaian & Tindakan PBT',
                repairCostMYR: 'Mengikut Skop Kerosakan',
                priorityScore: urgency === 'High' ? 88 : urgency === 'Medium' ? 68 : 48,
                riskAssessment: intendedMeaning,
                nearestRoadType: locName,
                recommendedAction: 'Penugasan Skuad Tapak'
            }
        };

        setAnomalies(prev => [newA, ...prev]);
        setManualDescription('');
        incrementStat('reports');
        addXp(25);

        try {
            const deviceFp = getDeviceFingerprint();
            await supabase.from('nadi_infra_reports').insert({
                lat: String(newA.lat),
                lng: String(newA.lng),
                z_dropped: 0,
                confidence_score: parsedConfidence,
                device_fingerprint: deviceFp,
                status: 'pending',
                ai_analysis: newA.aiAnalysis,
            });
        } catch (dbErr) {
            console.warn('DB insert error:', dbErr);
        }
    };

    const handleSendFeedback = async (skipCorrection = false) => {
        if (!feedbackModalAnomaly || isSubmittingFeedback) return;
        setIsSubmittingFeedback(true);

        const correction = skipCorrection ? '' : feedbackCorrectText.trim();

        try {
            const res = await fetch('/api/dialect/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dialectText: feedbackModalAnomaly.originalText || feedbackModalAnomaly.title || '',
                    correctMeaning: correction,
                    region: feedbackModalAnomaly.detectedDialect || 'kelantan',
                    rawVoice: feedbackModalAnomaly.originalText || '',
                    reportId: feedbackModalAnomaly.id,
                    isPositive: false
                })
            });

            if (res.ok) {
                setAnomalies(prev => prev.map(item => item.id === feedbackModalAnomaly.id ? {
                    ...item,
                    feedbackGiven: 'down',
                    translatedText: correction || item.translatedText,
                    userIntendedMeaning: correction ? `Dikemaskini Warga: "${correction}"` : item.userIntendedMeaning
                } : item));

                if (!skipCorrection && correction) {
                    addXp(10);
                }

                setFeedbackSuccessToast(true);
                setTimeout(() => {
                    setFeedbackSuccessToast(false);
                    setFeedbackModalAnomaly(null);
                }, 1500);
            }
        } catch (err) {
            console.warn('Feedback submit error:', err);
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    // === NEW: Sensor Fusion Hook ===
    const detector = usePotholeDetector();

    // === NEW: Dashcam Hook ===
    const dashcam = useDashcam();

    function isPotholeReport(a: Anomaly): boolean {
        if (a.zDropped && a.zDropped > 0) return true;
        if (a.source === 'sensor' || a.source === 'dashcam') return true;
        
        const text = `${a.title || ''} ${a.originalText || ''} ${a.translatedText || ''} ${a.aiAnalysis?.damageType || ''}`.toLowerCase();
        const keywords = ['pothole', 'lubang', 'berlubang', 'pecah', 'sinkhole', 'kelebok', 'lerek', 'perok'];
        return keywords.some(kw => text.includes(kw));
    }

    const potholeAnomalies = anomalies.filter(isPotholeReport);
    const civicAnomalies = anomalies.filter(a => !isPotholeReport(a));

    const totalPotholes = potholeAnomalies.length;
    const totalCivic = civicAnomalies.length;
    const totalVerified = anomalies.filter(a => a.status === 'verified').length;
    const avgConfidence = anomalies.length > 0
        ? Math.round(anomalies.reduce((sum, a) => sum + (a.confidenceScore || 0), 0) / anomalies.length)
        : 0;

    const filteredAnomalies = anomalies.filter(a => {
        if (filter === 'potholes') return isPotholeReport(a);
        if (filter === 'civic') return !isPotholeReport(a);
        if (filter === 'verified') return a.status === 'verified';
        return true;
    });

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
                    title: anomaly.title,
                    originalText: anomaly.originalText,
                    translatedText: anomaly.translatedText,
                    locationName: anomaly.locationName,
                    source: anomaly.source,
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
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        NADI Aduan Desk
                    </h2>
                    <p className="text-xs font-medium mt-1 relative inline-block" style={{ color: 'var(--text-muted)' }}>
                        {detector.isCalibrating ? (
                            <span className="flex items-center gap-2">
                                <Gauge className="w-3 h-3 text-[#C5A367] animate-pulse" />
                                Calibrating sensors...
                            </span>
                        ) : (
                            <>
                                Unified Civic Infrastructure Reporting & Pothole Suite
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

            {/* === AMBIENT VOICE ADUAN INPUT BOX === */}
            <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#0D0D10] via-[#121217] to-[#0D0D10] border border-zinc-800/80 shadow-2xl relative overflow-hidden"
            >
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 text-[#C5A367]">
                        <Sparkles className="w-3.5 h-3.5 text-[#C5A367]" /> Buat Aduan Suara / Teks
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Dialek Kelantan Tuned
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={manualDescription}
                        onChange={(e) => setManualDescription(e.target.value)}
                        placeholder="Cakap atau taip aduan (cth: Pothole dalam dekat Hospital Kubang Kerian)..."
                        className="flex-1 text-xs rounded-xl px-4 py-3 bg-[#050507] border border-zinc-800/80 text-zinc-200 placeholder-zinc-500 outline-none focus:border-[#C5A367]/50 transition-all"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleSendAduan();
                            }
                        }}
                        disabled={isParsingVoice}
                    />
                    <GlobalVoiceMic
                        onTranscript={(text) => setManualDescription(prev => (prev ? `${prev} ${text}` : text))}
                        size="md"
                    />
                    <button
                        onClick={handleSendAduan}
                        disabled={!manualDescription.trim() || isParsingVoice}
                        className="px-5 py-3 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#C5A367] to-[#E5C387] hover:brightness-110 flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-md active:scale-95 shrink-0"
                    >
                        {isParsingVoice ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Prosès AI...
                            </>
                        ) : (
                            <>
                                <Send className="w-3.5 h-3.5" /> Hantar
                            </>
                        )}
                    </button>
                </div>
            </motion.div>

            {/* === DRIVING HUD — only visible when user is moving and telemetry is valid === */}
            <AnimatePresence>
                {detector.currentSpeed > 0 && detector.currentSpeed <= 180 && !detector.isCalibrating && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mb-6 bg-gradient-to-r from-[#0A0A0C] via-[#0f1a14] to-[#0A0A0C] border border-zinc-800 rounded-2xl p-4 shadow-xl flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-light text-white font-mono tracking-tight">
                                    {Math.min(180, Math.max(0, Math.round(detector.currentSpeed || 0)))}
                                </div>
                                <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">km/h</div>
                            </div>
                            <div className="w-px h-8 bg-zinc-800"></div>
                            <div className="text-center">
                                <div className="text-2xl font-light text-[#C5A367] font-mono tracking-tight">{detector.detectionCount}</div>
                                <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Hits</div>
                            </div>
                        </div>
                        {dashcam.isDashcamEnabled && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">REC</span>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Motion Error */}
            {detector.motionError && (
                <div className="rounded-xl px-4 py-3 mb-4 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                     {detector.motionError}
                </div>
            )}

            {/* Dashcam Error */}
            {dashcam.error && (
                <div className="rounded-xl px-4 py-3 mb-4 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                     {dashcam.error}
                </div>
            )}

            {/* === STATS (Bento Grid - Hick's Law Clean Layout) === */}
            <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6"
            >
                {/* Card 1 */}
                <div className="bg-gradient-to-br from-[#0c1c14] to-[#050B08] p-4 rounded-2xl border border-emerald-500/30 shadow-lg relative overflow-hidden flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/90 block mb-1">
                            Lubang Dikesan
                        </span>
                        <div className="text-2xl font-black text-white font-mono tracking-tight">{totalPotholes}</div>
                        <span className="text-[9px] text-zinc-500 font-medium">Sensori & Visual Akselerometer</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Activity className="w-5 h-5" />
                    </div>
                </div>

                {/* Card 2 */}
                <div className="bg-gradient-to-br from-[#1c170c] to-[#0B0905] p-4 rounded-2xl border border-[#C5A367]/30 shadow-lg relative overflow-hidden flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#C5A367] block mb-1">
                            Aduan Suara Warga
                        </span>
                        <div className="text-2xl font-black text-white font-mono tracking-tight">{totalCivic}</div>
                        <span className="text-[9px] text-zinc-500 font-medium">Analisis Suara & Dialek</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#C5A367]/10 border border-[#C5A367]/20 flex items-center justify-center text-[#C5A367]">
                        <Mic className="w-5 h-5" />
                    </div>
                </div>

                {/* Card 3 */}
                <div className="bg-gradient-to-br from-[#10121c] to-[#05060B] p-4 rounded-2xl border border-purple-500/30 shadow-lg relative overflow-hidden flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400 block mb-1">
                            Disahkan Rakyat
                        </span>
                        <div className="text-2xl font-black text-white font-mono tracking-tight flex items-baseline gap-1">
                            {totalVerified} <span className="text-xs font-mono font-medium text-purple-300">({avgConfidence}%)</span>
                        </div>
                        <span className="text-[9px] text-zinc-500 font-medium">Pengesahan Komuniti</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                        <Shield className="w-5 h-5" />
                    </div>
                </div>
            </motion.div>

            {/* === ANOMALY LIST === */}
            <div className="flex-1 pb-10">
                <motion.h3
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                    className="text-xs uppercase font-bold tracking-widest text-zinc-400 mb-6 flex items-center justify-between px-1 flex-wrap gap-2"
                >
                    <span className="text-zinc-200 font-bold">Aduan Sivik & Infrastruktur</span>
                    <div className="flex gap-1.5 flex-wrap">
                        {(['all', 'potholes', 'civic', 'verified'] as const).map((f) => (
                            <button key={f} onClick={() => setFilter(f)}
                                className={`px-3.5 py-1.5 rounded-xl text-[10px] border transition-all ${filter === f ? 'bg-zinc-800 border-zinc-600 text-zinc-100 font-bold shadow-md' : 'bg-zinc-950 border-zinc-800/80 text-zinc-500 hover:text-zinc-300'}`}
                            >
                                {f === 'all' ? 'SEMUA' : f === 'potholes' ? 'POTHOLES' : f === 'civic' ? 'ADUAN WARGA' : 'VERIFIED'}
                            </button>
                        ))}
                    </div>
                </motion.h3>

                <div className="space-y-4">
                    <AnimatePresence>
                        {filteredAnomalies.map((a, i) => {
                            const conf = confidenceColor(a.confidenceScore || 0);
                            const isPothole = isPotholeReport(a);

                            return (
                            <motion.div
                                key={a.id}
                                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.05 }}
                                className="bg-gradient-to-b from-[#0F0F13] to-[#0A0A0C] border border-zinc-800/90 rounded-3xl p-5 shadow-2xl space-y-4 hover:border-zinc-700/80 transition-all"
                            >
                                {/* 1. Header Row */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-inner ${a.status === 'verified' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-500/10' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                                            {a.status === 'verified' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <h4 className="font-serif text-base font-bold text-white leading-snug">
                                                {a.title || (a.aiAnalysis?.damageType ? `${a.aiAnalysis.damageType} @ ${a.locationName || 'Kota Bharu'}` : `Laporan @ ${typeof a.lat === 'number' ? a.lat.toFixed(4) : a.lat}°, ${typeof a.lng === 'number' ? a.lng.toFixed(4) : a.lng}°`)}
                                            </h4>
                                            <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-widest">
                                                TICKET ID: #{a.id.slice(-4)} • {a.time}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* Verification status pill — High Contrast Emerald */}
                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border shadow-sm ${a.status === 'verified' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-bold' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                                        {a.status === 'verified' ? '✓ Verified' : 'Pending'}
                                    </span>
                                </div>

                                {/* 2. Metadata Badges Strip */}
                                <div className="flex flex-wrap gap-2">
                                    {a.source === 'voice' ? (
                                        <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 flex items-center gap-1">
                                            <Mic className="w-3 h-3" /> Aduan Suara
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border bg-red-500/10 border-red-500/20 text-red-400">
                                            G-Impact: {a.zDropped ? a.zDropped.toFixed(1) : '2.5'}g
                                        </span>
                                    )}
                                    {a.urgency && (
                                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                                            a.urgency === 'High' ? 'bg-red-500/20 border-red-500/30 text-red-400' : a.urgency === 'Medium' ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                                        }`}>
                                            Keutamaan: {a.urgency === 'High' ? 'Tinggi' : a.urgency === 'Medium' ? 'Sederhana' : 'Rendah'}
                                        </span>
                                    )}
                                    {a.confidenceScore != null && a.confidenceScore > 0 && (
                                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border ${conf.text} ${conf.bg} ${conf.border}`}>
                                            <Shield className="w-3 h-3 inline mr-1" />Keyakinan AI {a.confidenceScore}%
                                        </span>
                                    )}
                                    {a.detectedDialect && (
                                        <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                            Dialek {a.detectedDialect}
                                        </span>
                                    )}
                                </div>

                                {/* 3. Speech & Dialect AI Box */}
                                {a.originalText && (
                                    <div className="p-4 rounded-2xl bg-[#050507] border border-zinc-800/80 space-y-3 shadow-inner">
                                        {/* Intent-Aware Non-Infra Banner Guard */}
                                        {!isPothole && (
                                            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-medium">
                                                <Info className="w-4 h-4 text-blue-400 shrink-0" />
                                                <span>NLP mengesan ini BUKAN aduan infrastruktur fizikal (Ungkapan Peribadi / Dialek).</span>
                                            </div>
                                        )}

                                        {/* Teks Asal Quote */}
                                        <div>
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block mb-1">
                                                💬 Teks Asal (Warga)
                                            </span>
                                            <p className="text-xs text-zinc-100 font-medium italic bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/50">
                                                "{a.originalText}"
                                            </p>
                                        </div>

                                        {/* Maksud / Niat Sebenar NLP */}
                                        {a.userIntendedMeaning && (
                                            <div className="pt-2 border-t border-zinc-800/80">
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1 mb-1">
                                                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Maksud / Niat Sebenar (NLP Analysis)
                                                </span>
                                                <p className="text-xs text-amber-200/90 font-medium leading-relaxed bg-amber-500/5 p-2.5 rounded-xl border border-amber-500/20">
                                                    {a.userIntendedMeaning}
                                                </p>
                                            </div>
                                        )}

                                        {/* Dialect Words Badges */}
                                        {a.dialectWords && a.dialectWords.length > 0 && (
                                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                                <span className="text-[8px] uppercase font-bold text-zinc-500">Kata Dialek:</span>
                                                {a.dialectWords.map((w, idx) => (
                                                    <span key={idx} className="text-[8px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                        {w}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Interactive Feedback Loop */}
                                        <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between flex-wrap gap-2">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                                                Adakah Terjemahan AI Tepat?
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {a.feedbackGiven === 'up' ? (
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                                                        <Check className="w-3 h-3 text-emerald-400" /> Disahkan Tepat
                                                    </span>
                                                ) : a.feedbackGiven === 'down' ? (
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
                                                        ⚠️ Feedback Dihantar
                                                    </span>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={async () => {
                                                                setAnomalies(prev => prev.map(x => x.id === a.id ? { ...x, feedbackGiven: 'up' } : x));
                                                                try {
                                                                    await fetch('/api/dialect/feedback', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({
                                                                            dialectText: a.originalText || a.title || '',
                                                                            correctMeaning: a.translatedText || '',
                                                                            region: a.detectedDialect || 'kelantan',
                                                                            reportId: a.id,
                                                                            isPositive: true
                                                                        })
                                                                    });
                                                                } catch {}
                                                            }}
                                                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 text-xs transition-all active:scale-95 font-bold min-h-[38px]"
                                                            title="Terjemahan tepat!"
                                                        >
                                                            👍 <span className="text-[10px] font-bold uppercase">Tepat</span>
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setFeedbackModalAnomaly(a);
                                                                setFeedbackCorrectText(a.translatedText || a.originalText || '');
                                                            }}
                                                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 text-xs transition-all active:scale-95 font-bold min-h-[38px]"
                                                            title="Terjemahan kurang tepat / Ajar AI"
                                                        >
                                                            👎 <span className="text-[10px] font-bold uppercase">Salah</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 4. Action Buttons Footer Row (Gated Viral Card for Physical Infra Only) */}
                                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => analyzeAnomaly(a.id)}
                                            disabled={a.isAnalyzing}
                                            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#C5A367]/10 text-[#C5A367] border border-[#C5A367]/30 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#C5A367]/20 transition-all active:scale-95 disabled:opacity-60"
                                        >
                                            {a.isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                            AI Analyze
                                        </button>
                                        <button
                                            onClick={() => { setPhotoTargetId(a.id); fileInputRef.current?.click(); }}
                                            disabled={a.isAnalyzing}
                                            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500/20 transition-all active:scale-95 disabled:opacity-60"
                                        >
                                            <Camera className="w-3.5 h-3.5" /> Photo
                                        </button>
                                        {/* Gate Viral Card: ONLY show for physical infrastructure issues */}
                                        {isPothole ? (
                                            <button
                                                onClick={() => setShareModalAnomaly(a)}
                                                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-all active:scale-95"
                                                title="Jana Kad Eskalasi Awam"
                                            >
                                                <Share2 className="w-3.5 h-3.5" /> Kad Eskalasi Awam
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setFeedbackModalAnomaly(a);
                                                    setFeedbackCorrectText(a.userIntendedMeaning || a.originalText || '');
                                                }}
                                                className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-500/10 text-purple-300 border border-purple-500/30 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-purple-500/20 transition-all active:scale-95"
                                                title="Bantu AI Belajar Dialek"
                                            >
                                                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Dialek Info
                                            </button>
                                        )}
                                    </div>

                                    {a.aiAnalysis && (
                                        <button onClick={() => setAnomalies(prev => prev.map(x => x.id === a.id ? { ...x, expanded: !x.expanded } : x))}
                                            className="p-2 text-zinc-400 hover:text-white transition-colors"
                                        >
                                            {a.expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                        </button>
                                    )}
                                </div>

                                {/* AI Analysis Result (Clean N/A Hiding) */}
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
                                                    {a.aiAnalysis.severityScore > 0 && (
                                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border ${severityColor(a.aiAnalysis.severityScore)}`}>
                                                            {a.aiAnalysis.severityLabel || a.aiAnalysis.damageType} (Tahap {a.aiAnalysis.severityScore}/5)
                                                        </span>
                                                    )}
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
                                                
                                                {/* Hide N/A Size & Cost fields for non-physical/null values */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    {a.aiAnalysis.estimatedWidth && a.aiAnalysis.estimatedWidth !== 'N/A' && (
                                                        <div className="bg-[#0A0A0C] rounded-xl p-3 border border-zinc-800/50">
                                                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-1">Saiz</span>
                                                            <span className="text-xs text-zinc-300 font-medium">{a.aiAnalysis.estimatedWidth} × {a.aiAnalysis.estimatedDepth}</span>
                                                        </div>
                                                    )}
                                                    {a.aiAnalysis.repairCostMYR && a.aiAnalysis.repairCostMYR !== 'RM 0' && a.aiAnalysis.repairCostMYR !== 'N/A' && (
                                                        <div className="bg-[#0A0A0C] rounded-xl p-3 border border-zinc-800/50">
                                                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-1">Anggaran Kos</span>
                                                            <span className="text-xs text-[#C5A367] font-medium">{a.aiAnalysis.repairCostMYR}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {a.aiAnalysis.riskAssessment && (
                                                    <p className="text-xs text-zinc-300 font-medium leading-relaxed bg-[#0A0A0C] rounded-xl p-3 border border-zinc-800/50">
                                                        <span className="text-zinc-100 font-bold">Risiko: </span>{a.aiAnalysis.riskAssessment}
                                                    </p>
                                                )}
                                                {a.aiAnalysis.repairMethod && (
                                                    <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                                                        <span className="text-zinc-300 font-bold">Cadangan Pembaikan: </span>{a.aiAnalysis.repairMethod}
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

            {/* === VIRAL SHARE CARD MODAL === */}
            <AnimatePresence>
                {shareModalAnomaly && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-[#0A0A0C] border-2 border-red-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-white"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                                    🚨 KAD ESKALASI AWAM (SLA)
                                </span>
                                <button
                                    onClick={() => setShareModalAnomaly(null)}
                                    className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Ticket Card Image Preview */}
                            <div className="bg-gradient-to-br from-red-950/40 via-zinc-900 to-black border border-red-500/30 rounded-2xl p-5 mb-4 relative overflow-hidden">
                                <div className="absolute top-0 right-0 px-3 py-1 bg-red-600 text-[10px] font-black uppercase tracking-widest text-white rounded-bl-xl shadow-md">
                                    HARI KE-14 UNRESOLVED
                                </div>
                                <h3 className="text-sm font-black text-red-400 mb-1 uppercase">
                                    {shareModalAnomaly.title || shareModalAnomaly.aiAnalysis?.damageType || 'ADUAN INFRASTRUKTUR'}
                                </h3>
                                <p className="text-[10px] text-zinc-400 mb-3 font-mono">TICKET ID: #{shareModalAnomaly.id.slice(-6)}</p>
                                
                                <div className="space-y-2 text-xs mb-3">
                                    <div className="bg-black/60 p-2.5 rounded-xl border border-zinc-800">
                                        <span className="text-[9px] text-zinc-500 font-bold block uppercase">Lokasi / Kawasan</span>
                                        <span className="font-mono text-zinc-200 font-bold">
                                            {shareModalAnomaly.locationName ? `${shareModalAnomaly.locationName} (${shareModalAnomaly.lat}°, ${shareModalAnomaly.lng}°)` : `${shareModalAnomaly.lat}°, ${shareModalAnomaly.lng}°`}
                                        </span>
                                    </div>
                                    <div className="bg-black/60 p-2.5 rounded-xl border border-zinc-800">
                                        <span className="text-[9px] text-zinc-500 font-bold block uppercase">Keterangan Aduan & Terjemahan</span>
                                        <span className="text-zinc-300">
                                            {shareModalAnomaly.translatedText || shareModalAnomaly.aiAnalysis?.riskAssessment || shareModalAnomaly.originalText || 'Kerosakan jalan teruk, berisiko bahaya kemalangan.'}
                                        </span>
                                    </div>
                                </div>

                                <div className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest text-center border-t border-zinc-800 pt-2">
                                    NADI CIVIC SYSTEM • DISAHKAN WARGA
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-2">
                                <button
                                    onClick={() => {
                                        const issueTitle = shareModalAnomaly.title || shareModalAnomaly.aiAnalysis?.damageType || 'Aduan Warga';
                                        const loc = shareModalAnomaly.locationName ? `${shareModalAnomaly.locationName} (${shareModalAnomaly.lat}°, ${shareModalAnomaly.lng}°)` : `${shareModalAnomaly.lat}°, ${shareModalAnomaly.lng}°`;
                                        const quote = shareModalAnomaly.originalText ? `"${shareModalAnomaly.originalText}"` : `"${shareModalAnomaly.translatedText || ''}"`;
                                        const caption = `🚨 ADUAN SIVIK TERBENGKALAI — KELANTAN!\n\n📌 Issue: ${issueTitle}\n📍 Lokasi: ${loc}\n💬 Aduan Warga: ${quote}\n⚠️ Status: Belum Dibaiki (Ticket #${shareModalAnomaly.id.slice(-6)})\n\nSila ambil tindakan segera! #KelantanFixOurRoads #NADI #PBTKelantan #AduanWarga`;
                                        navigator.clipboard.writeText(caption);
                                        setCopiedToast(true);
                                        setTimeout(() => setCopiedToast(false), 2000);
                                    }}
                                    className="w-full py-3 rounded-xl bg-emerald-500 text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all"
                                >
                                    <Share2 className="w-4 h-4" /> {copiedToast ? '✓ Kapsyen Disalin!' : 'Salin Kapsyen TikTok/FB'}
                                </button>
                                <p className="text-[9px] text-zinc-500 text-center">
                                    Kongsi di TikTok / FB dengan hashtag di atas untuk beri tekanan SLA kepada pihak berkuasa tempatan.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* === DIALECT AI FEEDBACK LOOP MODAL === */}
            <AnimatePresence>
                {feedbackModalAnomaly && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-[#0A0A0C] border-2 border-purple-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-white"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 text-purple-400" /> BANTU AI BELAJAR DIALEK
                                </span>
                                <button
                                    onClick={() => setFeedbackModalAnomaly(null)}
                                    className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400"
                                >
                                    ✕
                                </button>
                            </div>

                            <p className="text-xs text-zinc-400 mb-3">
                                Adakah terjemahan AI dialek kurang tepat? Masukkan maksud sebenar untuk melatih enjin AI NADI:
                            </p>

                            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 mb-3 space-y-1">
                                <span className="text-[9px] text-zinc-500 font-bold uppercase block">Ayat Asal Warga ({feedbackModalAnomaly.detectedDialect || 'Kelantan'}):</span>
                                <span className="text-xs text-emerald-400 font-medium">"{feedbackModalAnomaly.originalText || feedbackModalAnomaly.title}"</span>
                            </div>

                            <div className="space-y-1 mb-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-[9px] text-zinc-400 font-bold uppercase block">Maksud Sebenar (Opsional):</label>
                                    <span className="text-[9px] text-purple-400 font-mono font-bold">+10 XP</span>
                                </div>
                                <textarea
                                    value={feedbackCorrectText}
                                    onChange={(e) => setFeedbackCorrectText(e.target.value)}
                                    rows={3}
                                    placeholder="Taip maksud sebenar di sini (opsional)... Cth: Sakit kepala / kelesuan fikiran (kiasan Kelantan)..."
                                    className="w-full text-xs rounded-xl p-3 bg-zinc-950 border border-zinc-800 text-zinc-200 outline-none focus:border-purple-500 transition-colors"
                                />
                            </div>

                            <div className="space-y-2">
                                <button
                                    onClick={() => handleSendFeedback(false)}
                                    disabled={!feedbackCorrectText.trim() || isSubmittingFeedback}
                                    className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-purple-500 transition-all disabled:opacity-50"
                                >
                                    {isSubmittingFeedback ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" /> Menghantar Ke Dialect Engine...
                                        </>
                                    ) : feedbackSuccessToast ? (
                                        <>✓ AI Berjaya Di-kemaskini!</>
                                    ) : (
                                        <>
                                            <Send className="w-3.5 h-3.5" /> Hantar Terjemahan & Ajar AI (+10 XP)
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => handleSendFeedback(true)}
                                    disabled={isSubmittingFeedback}
                                    className="w-full py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white font-bold text-[10px] uppercase tracking-wider transition-all"
                                >
                                    Langkau (Cuma Hantar Feedback 👎)
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
