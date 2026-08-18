'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Activity,
    Check,
    AlertCircle,
    Camera,
    Loader2,
    Zap,
    ChevronDown,
    ChevronUp,
    Video,
    Shield,
    Share2,
    Send,
    Sparkles,
    Mic,
    FileText,
    Layers,
    Image as ImageIcon,
    X,
    MapPin,
    Volume2,
    Compass,
    AlertTriangle,
    Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import GlobalVoiceMic from '@/src/components/GlobalVoiceMic';
import { useTheme } from '../context/ThemeContext';
import { usePotholeDetector, type PotholeDetection } from '../hooks/usePotholeDetector';
import { useDashcam } from '../hooks/useDashcam';
import { createClient } from '@/src/lib/supabase/client';
import { generateAduanPdf } from '@/src/lib/pdf/generateAduanPdf';
import { speakDialect } from '@/src/lib/speech/speakDialect';

// =============================================================================
// OPTIMAL 7 CITIZEN-EYE CATEGORIES (SYMPTOMS CITIZENS REPORT)
// =============================================================================
export type CivicCategory = 'jalan' | 'saliran' | 'lampu' | 'sampah' | 'pokok' | 'kemudahan' | 'lain';

export interface CivicCategoryConfig {
    id: CivicCategory;
    label: string;
    image: string;
    color: string;
    activeBg: string;
    activeBorder: string;
    activeGlow: string;
    keywords: string[];
    suggestedAgency: string; // Invisible routing: JKR, JPS, TNB, Alam Flora, Landskap, PBT
}

export const CIVIC_CATEGORIES: CivicCategoryConfig[] = [
    {
        id: 'jalan',
        label: 'Jalan & Lubang',
        image: '/images/aduan/pothole.png',
        color: 'text-amber-400',
        activeBg: 'bg-amber-500/15',
        activeBorder: 'border-amber-500/30',
        activeGlow: 'shadow-[0_0_12px_rgba(245,158,11,0.15)]',
        keywords: ['jalan', 'lubang', 'berlubang', 'tar', 'pothole', 'pecah', 'lerek', 'kelebok', 'perok', 'retak', 'bonggol', 'mendap', 'lekuk', 'lopak', 'turap'],
        suggestedAgency: 'JKR / PBT'
    },
    {
        id: 'saliran',
        label: 'Longkang & Saliran',
        image: '/images/aduan/flood.png',
        color: 'text-sky-400',
        activeBg: 'bg-sky-500/15',
        activeBorder: 'border-sky-500/30',
        activeGlow: 'shadow-[0_0_12px_rgba(56,189,248,0.15)]',
        keywords: ['longkang', 'parit', 'saliran', 'tersumbat', 'melimpah', 'parit busuk', 'air bertakung', 'takung', 'lumpur', 'culvert', 'kotoran parit', 'tali air', 'parit pecah'],
        suggestedAgency: 'JPS / PBT'
    },
    {
        id: 'lampu',
        label: 'Lampu & Elektrik',
        image: '/images/aduan/electricity.png',
        color: 'text-yellow-400',
        activeBg: 'bg-yellow-500/15',
        activeBorder: 'border-yellow-500/30',
        activeGlow: 'shadow-[0_0_12px_rgba(234,179,8,0.15)]',
        keywords: ['lampu', 'tiang', 'gelap', 'padam', 'mentol', 'wayar', 'kabel', 'elektrik', 'tnb', 'putus', 'terpadam', 'lampu jalan', 'fius', 'tiang condong'],
        suggestedAgency: 'TNB / PBT'
    },
    {
        id: 'sampah',
        label: 'Sampah & Pembuangan',
        image: '/images/aduan/garbage.png',
        color: 'text-emerald-400',
        activeBg: 'bg-emerald-500/15',
        activeBorder: 'border-emerald-500/30',
        activeGlow: 'shadow-[0_0_12px_rgba(16,185,129,0.15)]',
        keywords: ['sampah', 'bau', 'longgokan', 'busuk', 'kotor', 'sisa', 'pembuangan', 'haram', 'bangkai', 'lalat', 'timbunan', 'pungutan', 'tong sampah', 'tong penuh'],
        suggestedAgency: 'Alam Flora / PBT'
    },
    {
        id: 'pokok',
        label: 'Pokok & Landskap',
        image: '/images/aduan/treeNew.png',
        color: 'text-green-400',
        activeBg: 'bg-green-500/15',
        activeBorder: 'border-green-500/30',
        activeGlow: 'shadow-[0_0_12px_rgba(34,197,94,0.15)]',
        keywords: ['pokok', 'dahan', 'tumbang', 'reput', 'rumput', 'semak', 'ranting', 'lalang', 'dahan patah', 'pokok condong', 'cantasan', 'hutan kecil', 'semak samun', 'pokok mati'],
        suggestedAgency: 'Jabatan Landskap / PBT'
    },
    {
        id: 'kemudahan',
        label: 'Kemudahan Awam',
        image: '/images/aduan/infrastructure.png',
        color: 'text-purple-400',
        activeBg: 'bg-purple-500/15',
        activeBorder: 'border-purple-500/30',
        activeGlow: 'shadow-[0_0_12px_rgba(168,85,247,0.15)]',
        keywords: ['perhentian bas', 'bus stop', 'taman permainan', 'pagar', 'tandas', 'papan tanda', 'signboard', 'jejantas', 'benches', 'kerusi awam', 'balairaya', 'kemudahan', 'pagar rosak', 'taman awam'],
        suggestedAgency: 'PBT'
    },
    {
        id: 'lain',
        label: 'Lain-lain',
        image: '/images/aduan/checklist.png',
        color: 'text-zinc-300',
        activeBg: 'bg-zinc-700/25',
        activeBorder: 'border-zinc-500/40',
        activeGlow: 'shadow-[0_0_12px_rgba(161,161,170,0.15)]',
        keywords: ['haiwan', 'anjing', 'monyet', 'kucing terbiar', 'kacau ganggu', 'lain', 'cadangan', 'umum', 'bantuan'],
        suggestedAgency: 'PBT / Jabatan Berkaitan'
    }
];

// Disaster Emergency Keywords for Real-Time Handoff Banner
const EMERGENCY_DISASTER_KEYWORDS = [
    'banjir besar',
    'banjir kilat teruk',
    'air naik mendadak',
    'terperangkap banjir',
    'arus deras',
    'pindah banjir',
    'lemas',
    'tanah runtuh besar',
    'rumah tenggelam',
    'paras bahaya',
    'bencana alam'
];

function isEmergencyDisasterText(text: string): boolean {
    const lower = text.toLowerCase();
    return EMERGENCY_DISASTER_KEYWORDS.some(kw => lower.includes(kw));
}

function detectCategoryFromText(text: string): CivicCategory {
    const lower = text.toLowerCase();
    for (const cat of CIVIC_CATEGORIES) {
        if (cat.keywords.some(kw => lower.includes(kw))) {
            return cat.id;
        }
    }
    return 'jalan';
}

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
    routingAgency?: string;
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
    category?: CivicCategory;
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
    suggestedAgency?: string;
}

function getDeviceFingerprint(): string {
    const key = 'nadi_device_fp';
    if (typeof window === 'undefined') return 'dev_server';
    let fp = localStorage.getItem(key);
    if (!fp) {
        fp = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(key, fp);
    }
    return fp;
}

interface AduanViewProps {
    onNavigateToBencana?: () => void;
}

export default function AduanView({ onNavigateToBencana }: AduanViewProps = {}) {
    const { formatTime } = useTheme();
    const [filter, setFilter] = useState<'all' | 'jalan' | 'saliran' | 'lampu' | 'sampah' | 'pokok' | 'kemudahan' | 'lain' | 'verified'>('all');
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photoTargetId, setPhotoTargetId] = useState<string | null>(null);

    // Universal Composer States
    const [manualDescription, setManualDescription] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<CivicCategory>('jalan');
    const [hasManuallySelectedCategory, setHasManuallySelectedCategory] = useState(false);
    const [isParsingVoice, setIsParsingVoice] = useState(false);
    const [userGpsLocation, setUserGpsLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
    const [isGettingGps, setIsGettingGps] = useState(false);

    // Modals
    const [shareModalAnomaly, setShareModalAnomaly] = useState<Anomaly | null>(null);
    const [copiedToast, setCopiedToast] = useState(false);
    const [feedbackModalAnomaly, setFeedbackModalAnomaly] = useState<Anomaly | null>(null);
    const [feedbackCorrectText, setFeedbackCorrectText] = useState('');
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [feedbackSuccessToast, setFeedbackSuccessToast] = useState(false);

    // Photo Attachment
    const [attachedPhotoBase64, setAttachedPhotoBase64] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const photoFileInputRef = useRef<HTMLInputElement>(null);

    const supabase = createClient();
    const detector = usePotholeDetector();
    const dashcam = useDashcam();

    const isDesktop = typeof window !== 'undefined' && !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const isEmergencyDetected = useMemo(() => {
        return isEmergencyDisasterText(manualDescription);
    }, [manualDescription]);

    const handleDescriptionChange = (text: string) => {
        setManualDescription(text);
        if (!hasManuallySelectedCategory && text.trim().length > 2) {
            const detected = detectCategoryFromText(text);
            setSelectedCategory(detected);
        }
    };

    const handleGetGps = () => {
        if (!navigator.geolocation) return;
        setIsGettingGps(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserGpsLocation({
                    lat: Number(pos.coords.latitude.toFixed(5)),
                    lng: Number(pos.coords.longitude.toFixed(5)),
                    label: 'Lokasi Semasa (GPS)'
                });
                setIsGettingGps(false);
            },
            (err) => {
                console.warn('GPS location error:', err);
                setIsGettingGps(false);
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        setAttachedPhotoBase64(event.target?.result as string);
                    };
                    reader.readAsDataURL(blob);
                    e.preventDefault();
                    break;
                }
            }
        }
    };

    const handleAttachedPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setAttachedPhotoBase64(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (!isDesktop) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        if (!isDesktop) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        if (!isDesktop) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer?.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setAttachedPhotoBase64(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSendAduan = async () => {
        const textToProcess = manualDescription.trim();
        const photoToProcess = attachedPhotoBase64;
        if ((!textToProcess && !photoToProcess) || isParsingVoice) return;

        setIsParsingVoice(true);
        let resData: any = null;
        let visionAnalysis: any = null;
        const reportCategory = selectedCategory;

        try {
            if (textToProcess) {
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
                    if (json.success && json.data) resData = json.data;
                }
            }

            if (photoToProcess) {
                const cleanBase64 = photoToProcess.split(',')[1] || photoToProcess;
                const vRes = await fetch('/api/infra/vision', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imageBase64: cleanBase64,
                        lat: userGpsLocation?.lat || resData?.coordinates?.lat || 6.0833,
                        lng: userGpsLocation?.lng || resData?.coordinates?.lng || 102.2500,
                        zDropped: 0
                    })
                });
                if (vRes.ok) {
                    const vJson = await vRes.json();
                    if (vJson.success && vJson.analysis) visionAnalysis = vJson.analysis;
                }
            }
        } catch (err) {
            console.warn('Aduan AI parse notice:', err);
        } finally {
            setIsParsingVoice(false);
        }

        const catConfig = CIVIC_CATEGORIES.find(c => c.id === reportCategory);
        const intent = visionAnalysis?.damageType || resData?.intent || `Aduan ${catConfig?.label || 'Sivik'}`;
        const locName = userGpsLocation?.label || resData?.location || 'Kota Bharu';
        const translation = resData?.simplifiedTranslation || textToProcess || visionAnalysis?.damageType || `Aduan ${catConfig?.label || 'Sivik'}`;
        const dialect = resData?.detectedDialect || 'kelantan';
        const urgency = (resData?.urgency || (visionAnalysis?.severityScore >= 4 ? 'High' : 'Medium')) as 'Low' | 'Medium' | 'High';
        const intendedMeaning = resData?.userIntendedMeaning || translation;
        const parsedConfidence = resData?.confidenceScore
            ? Number(resData.confidenceScore)
            : Math.min(98, Math.max(75, 80 + (resData?.dialectWords?.length || 0) * 4));

        const reportLat = userGpsLocation?.lat || resData?.coordinates?.lat || 6.0833;
        const reportLng = userGpsLocation?.lng || resData?.coordinates?.lng || 102.2500;

        const newA: Anomaly = {
            id: `aduan-${Date.now()}`,
            lat: reportLat,
            lng: reportLng,
            category: reportCategory,
            suggestedAgency: catConfig?.suggestedAgency || 'PBT',
            zDropped: 0,
            verifications: 1,
            status: photoToProcess ? 'verified' : 'pending',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            title: `${intent} @ ${locName}`,
            source: photoToProcess ? 'dashcam' : 'voice',
            originalText: textToProcess || `Aduan bergambar (${catConfig?.label})`,
            translatedText: translation,
            userIntendedMeaning: intendedMeaning,
            locationName: locName,
            urgency: urgency,
            detectedDialect: dialect,
            dialectWords: resData?.dialectWords || [],
            confidenceScore: parsedConfidence,
            photoBase64: photoToProcess || undefined,
            aiAnalysis: visionAnalysis ? {
                severityScore: visionAnalysis.severityScore || (urgency === 'High' ? 4 : 3),
                severityLabel: visionAnalysis.damageType || `Aduan ${catConfig?.label}`,
                damageType: visionAnalysis.damageType || intent,
                estimatedWidth: visionAnalysis.estimatedWidth || '—',
                estimatedDepth: visionAnalysis.estimatedDepth || '—',
                repairMethod: visionAnalysis.recommendedAction || 'Penilaian & Tindakan PBT',
                repairCostMYR: 'Mengikut Skop Kerosakan',
                priorityScore: visionAnalysis.priorityScore || 75,
                riskAssessment: visionAnalysis.riskAssessment || intendedMeaning,
                nearestRoadType: locName,
                recommendedAction: visionAnalysis.recommendedAction || 'Penugasan Skuad Tindakan Tapak',
                routingAgency: catConfig?.suggestedAgency || 'PBT'
            } : {
                severityScore: urgency === 'High' ? 4 : urgency === 'Medium' ? 3 : 2,
                severityLabel: `Aduan ${catConfig?.label}`,
                damageType: intent,
                estimatedWidth: '—',
                estimatedDepth: '—',
                repairMethod: 'Penilaian & Tindakan PBT',
                repairCostMYR: 'Mengikut Skop Kerosakan',
                priorityScore: urgency === 'High' ? 88 : urgency === 'Medium' ? 68 : 48,
                riskAssessment: intendedMeaning,
                nearestRoadType: locName,
                recommendedAction: 'Penugasan Skuad Tindakan Tapak',
                routingAgency: catConfig?.suggestedAgency || 'PBT'
            }
        };

        setAnomalies(prev => [newA, ...prev]);
        setManualDescription('');
        setAttachedPhotoBase64(null);
        setHasManuallySelectedCategory(false);

        try {
            const deviceFp = getDeviceFingerprint();
            await supabase.from('nadi_infra_reports').insert({
                lat: String(newA.lat),
                lng: String(newA.lng),
                z_dropped: 0,
                confidence_score: parsedConfidence,
                device_fingerprint: deviceFp,
                status: newA.status,
                ai_analysis: newA.aiAnalysis,
                photo_url: photoToProcess || null,
            });
        } catch (dbErr) {
            console.warn('DB insert error:', dbErr);
        }
    };

    function resolveCategory(a: Anomaly): CivicCategory {
        if (a.category) return a.category;
        const text = `${a.title || ''} ${a.originalText || ''} ${a.translatedText || ''} ${a.aiAnalysis?.damageType || ''}`.toLowerCase();
        return detectCategoryFromText(text);
    }

    const filteredAnomalies = useMemo(() => {
        return anomalies.filter(a => {
            if (filter === 'verified') return a.status === 'verified';
            if (filter === 'all') return true;
            return resolveCategory(a) === filter;
        });
    }, [anomalies, filter]);

    const totalReports = anomalies.length;
    const totalVerified = anomalies.filter(a => a.status === 'verified').length;
    const estimatedResolved = Math.max(1, Math.floor(totalVerified * 0.38));

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

    useEffect(() => {
        const savedLocal = localStorage.getItem('nadi_local_potholes');
        if (savedLocal) {
            try {
                const parsed = JSON.parse(savedLocal);
                setAnomalies(parsed);
            } catch {}
        }

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
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [supabase]);

    useEffect(() => {
        if (!detector.lastDetection) return;
        const det = detector.lastDetection;
        const tempId = det.id;

        let snapshot: string | null = null;
        if (dashcam.isDashcamEnabled && dashcam.isStreaming) {
            snapshot = dashcam.captureFrame();
        }

        const newAnomaly: Anomaly = {
            id: tempId,
            lat: det.lat,
            lng: det.lng,
            category: 'jalan',
            suggestedAgency: 'JKR / PBT',
            zDropped: det.zDrop,
            verifications: 1,
            status: 'pending',
            time: 'Baru sahaja',
            confidenceScore: det.confidenceScore,
            speedKmh: det.speedKmh,
            snapshotBase64: snapshot || undefined,
            title: `Lubang Jalan Dikesan (${det.zDrop.toFixed(1)}g)`,
        };

        setAnomalies(prev => {
            const updated = [newAnomaly, ...prev];
            localStorage.setItem('nadi_local_potholes', JSON.stringify(updated.slice(0, 50)));
            return updated;
        });

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
            snapshot_base64: snapshot?.split(',')[1] || null,
            status: 'pending'
        }).select().single().then(async ({ data }) => {
            if (data) {
                setAnomalies(prev => prev.map(a => a.id === tempId ? { ...a, id: data.id } : a));
            }
        });
    }, [detector.lastDetection]);

    const handleToggleDashcam = async () => {
        detector.startDriving();
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

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    return (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto h-full flex flex-col relative z-0">
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handlePhotoUpload} />

            {/* Edge-to-edge Fullscreen Dashcam Portal */}
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
                                <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between pointer-events-auto bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                                    <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
                                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-xs font-bold text-white uppercase tracking-widest">Mod Pemanduan (AR HUD)</span>
                                    </div>
                                    <button
                                        onClick={handleToggleDashcam}
                                        className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/20 active:scale-90 transition-transform text-white font-bold text-sm"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Shield className="w-4 h-4 text-[#10B981]" />
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">Mod Privasi Aktif</span>
                                    </div>
                                    <p className="text-xs text-zinc-300 font-medium leading-relaxed max-w-lg">
                                        Hanya merakam 1 bingkai automatik semasa hentakan dikesan. Tiada video berterusan disimpan.
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>,
                document.body
            )}

            {/* ================================================================= */}
            {/* 1. PAGE HEADER                                                   */}
            {/* ================================================================= */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="mb-6"
            >
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-[#C5A367]/10 text-[#C5A367] border border-[#C5A367]/20">
                        Sistem Sivik & Aduan Warga
                    </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-100 to-zinc-400">
                    Aduan Sivik
                </h1>
                <p className="text-xs sm:text-sm font-medium mt-1 text-zinc-400">
                    NADI mendengar. Lapor apa sahaja — jalan rosak, longkang tersumbat, lampu terpadam, pokok tumbang, atau sampah.
                </p>
            </motion.div>

            {/* Hidden file input for photo attachment */}
            <input
                type="file"
                accept="image/*"
                ref={photoFileInputRef}
                className="hidden"
                onChange={handleAttachedPhotoSelect}
            />

            {/* ================================================================= */}
            {/* 2. UNIVERSAL COMPOSER WITH 7 CATEGORIES & EMERGENCY HANDOFF        */}
            {/* ================================================================= */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onPaste={handlePaste}
                className={`mb-6 p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-[#121217] via-[#0E0E12] to-[#0A0A0D] border transition-all shadow-[0_12px_40px_rgba(0,0,0,0.5)] relative overflow-hidden ${
                    isDragging ? 'border-[#C5A367] ring-2 ring-[#C5A367]/30 bg-[#C5A367]/5' : 'border-zinc-800/80 hover:border-zinc-700/80'
                }`}
            >
                {/* Subtle Ambient Radial Glow */}
                <div className="absolute top-0 right-1/4 w-72 h-36 bg-[#C5A367]/5 blur-3xl pointer-events-none rounded-full" />

                {/* 7 Citizen-Eye Category Chips - Auto fit & wrap without horizontal scroll */}
                <div className="relative z-10 flex flex-wrap items-center gap-1.5 sm:gap-2 mb-3">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider mr-0.5 shrink-0 flex items-center gap-1">
                        <Compass className="w-3 h-3 text-[#C5A367]" /> Kategori:
                    </span>
                    {CIVIC_CATEGORIES.map(cat => {
                        const isSelected = selectedCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                    setSelectedCategory(cat.id);
                                    setHasManuallySelectedCategory(true);
                                }}
                                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 transition-all border active:scale-95 ${
                                    isSelected
                                        ? `${cat.activeBg} ${cat.color} ${cat.activeBorder} ${cat.activeGlow} font-bold ring-1 ring-white/10`
                                        : 'bg-zinc-900/80 border-zinc-800/90 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 hover:border-zinc-700'
                                }`}
                            >
                                <img
                                    src={cat.image}
                                    alt={cat.label}
                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain shrink-0 rounded"
                                />
                                <span className="whitespace-nowrap">{cat.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Attached Photo Preview */}
                {attachedPhotoBase64 && (
                    <div className="relative z-10 mb-3 p-3 rounded-2xl bg-zinc-950/90 border border-zinc-800/90 flex items-center justify-between gap-3 shadow-inner">
                        <div className="flex items-center gap-3">
                            <img src={attachedPhotoBase64} alt="Lampiran Gambar" className="w-12 h-12 object-cover rounded-xl border border-zinc-800 shadow" />
                            <div>
                                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <ImageIcon className="w-3.5 h-3.5 text-[#C5A367]" /> Foto Dilampirkan
                                </p>
                                <p className="text-[10px] text-zinc-400">Analisis AI Vision akan diproses semasa hantar</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setAttachedPhotoBase64(null)}
                            className="w-7 h-7 rounded-full bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20 flex items-center justify-center transition-all shrink-0 active:scale-90"
                            title="Padam Foto"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Clean, Simple Input Field */}
                <div className="relative z-10 mb-3">
                    <textarea
                        rows={2}
                        value={manualDescription}
                        onChange={(e) => handleDescriptionChange(e.target.value)}
                        placeholder="Taip atau cakap aduan anda di sini..."
                        className="w-full text-xs sm:text-sm rounded-2xl p-3.5 sm:p-4 bg-[#060608]/90 border border-zinc-800/70 text-zinc-100 placeholder-zinc-500 outline-none focus:border-[#C5A367]/60 focus:ring-1 focus:ring-[#C5A367]/20 transition-all resize-none leading-relaxed shadow-inner"
                        disabled={isParsingVoice}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                handleSendAduan();
                            }
                        }}
                    />
                </div>

                {/* REAL-TIME EMERGENCY DISASTER HANDOFF BANNER */}
                <AnimatePresence>
                    {isEmergencyDetected && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="relative z-10 mb-3 overflow-hidden"
                        >
                            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-950/80 via-red-900/40 to-red-950/80 border border-red-500/40 text-red-200 flex items-center justify-between gap-3 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                                        <AlertTriangle className="w-4 h-4 text-red-400 animate-bounce" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-red-300">
                                            Kecemasan Bencana Dikesan
                                        </p>
                                        <p className="text-[11px] text-red-300/80 leading-snug">
                                            Untuk situasi bencana & pemindahan segera, sila buka <strong>Modul Bencana</strong> atau hubungi talian kecemasan 999.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (onNavigateToBencana) {
                                            onNavigateToBencana();
                                        } else {
                                            window.location.href = '/?tab=bencana';
                                        }
                                    }}
                                    className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shrink-0 transition-all active:scale-95 shadow-md flex items-center gap-1.5"
                                >
                                    <span>Buka Bencana</span>
                                    <span>➔</span>
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Bottom Tools Row */}
                <div className="relative z-10 flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-zinc-800/50">
                    {/* Location Badge / Trigger */}
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={handleGetGps}
                            disabled={isGettingGps}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                                userGpsLocation
                                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                                    : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                            }`}
                            title="Kesan Lokasi GPS Peranti"
                        >
                            {isGettingGps ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                            ) : (
                                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                            )}
                            <span>{userGpsLocation ? `📍 ${userGpsLocation.lat}°, ${userGpsLocation.lng}°` : 'Guna Lokasi Saya (GPS)'}</span>
                        </button>
                        {userGpsLocation && (
                            <button
                                type="button"
                                onClick={() => setUserGpsLocation(null)}
                                className="text-zinc-500 hover:text-zinc-300 text-xs px-1"
                                title="Reset Lokasi"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Tools & Send Button */}
                    <div className="flex items-center gap-2">
                        {/* Photo attachment button */}
                        <button
                            type="button"
                            onClick={() => photoFileInputRef.current?.click()}
                            className={`p-2.5 rounded-xl border transition-all text-xs font-bold flex items-center justify-center shrink-0 active:scale-95 ${
                                attachedPhotoBase64
                                    ? 'bg-[#C5A367]/20 border-[#C5A367] text-[#C5A367]'
                                    : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                            }`}
                            title={isDesktop ? "Muat Naik, Tampal (Paste) atau Drag & Drop Foto" : "Muat Naik Foto"}
                        >
                            <ImageIcon className="w-4 h-4" />
                        </button>

                        {/* Speech Mic */}
                        <GlobalVoiceMic
                            onTranscript={(text) => handleDescriptionChange(manualDescription ? `${manualDescription} ${text}` : text)}
                            size="md"
                        />

                        {/* Primary Submit Button */}
                        <button
                            onClick={handleSendAduan}
                            disabled={(!manualDescription.trim() && !attachedPhotoBase64) || isParsingVoice}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#D4AF37] to-[#AA820A] hover:brightness-110 flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-[0_4px_16px_rgba(212,175,55,0.25)] active:scale-95 shrink-0"
                        >
                            {isParsingVoice ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Proses AI...
                                </>
                            ) : (
                                <>
                                    <Send className="w-3.5 h-3.5" /> Hantar Aduan
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* ================================================================= */}
            {/* 3. CIVIC OUTCOME METRICS                                          */}
            {/* ================================================================= */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-gradient-to-r from-[#0F0F14] via-[#121218] to-[#0F0F14] border border-zinc-800/80 backdrop-blur-xl rounded-2xl p-4 sm:p-5 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-xl"
            >
                <div className="flex items-center gap-6 sm:gap-8 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        <div>
                            <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-400 block mb-0.5">
                                Aduan Diterima
                            </span>
                            <span className="text-xl font-bold text-white font-mono">{totalReports}</span>
                        </div>
                    </div>

                    <div className="w-px h-8 bg-zinc-800/80 hidden sm:block" />

                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <div>
                            <span className="text-[9px] uppercase font-bold tracking-widest text-emerald-400 block mb-0.5">
                                Disahkan AI & Warga
                            </span>
                            <span className="text-xl font-bold text-emerald-400 font-mono">{totalVerified}</span>
                        </div>
                    </div>

                    <div className="w-px h-8 bg-zinc-800/80 hidden sm:block" />

                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#C5A367] shadow-[0_0_8px_rgba(197,163,103,0.5)]" />
                        <div>
                            <span className="text-[9px] uppercase font-bold tracking-widest text-[#C5A367] block mb-0.5">
                                Selesai & Tindakan
                            </span>
                            <span className="text-xl font-bold text-[#C5A367] font-mono">{estimatedResolved} minggu ini</span>
                        </div>
                    </div>
                </div>

                {/* Mod Pemanduan Button */}
                <button
                    onClick={handleToggleDashcam}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all active:scale-95 shadow-md ${
                        dashcam.isDashcamEnabled
                            ? 'bg-red-500/20 text-red-300 border-red-500/40 shadow-red-500/10'
                            : 'bg-zinc-900/90 text-zinc-200 border-zinc-700/80 hover:border-[#C5A367]/50 hover:bg-zinc-800'
                    }`}
                >
                    <Video className="w-4 h-4 text-[#C5A367]" />
                    <span>Mod Pemanduan</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono font-bold">BETA</span>
                </button>
            </motion.div>

            {/* Motion or Dashcam Errors */}
            {detector.motionError && (
                <div className="rounded-2xl px-4 py-3 mb-4 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-between">
                    <span>{detector.motionError}</span>
                    <button
                        onClick={() => detector.startDriving()}
                        className="text-[10px] font-bold underline ml-2 hover:text-amber-300"
                    >
                        Aktifkan Sensor
                    </button>
                </div>
            )}

            {/* ================================================================= */}
            {/* 4. FEED FILTERS WITH 7 CITIZEN CATEGORIES                          */}
            {/* ================================================================= */}
            <div className="flex-1 pb-10">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center justify-between px-1 mb-5 flex-wrap gap-2"
                >
                    <span className="text-xs uppercase font-bold tracking-widest text-zinc-300">
                        Senarai Aduan Kawasan
                    </span>
                    <div className="flex gap-1.5 flex-wrap pb-1">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] border transition-all ${
                                filter === 'all'
                                    ? 'bg-zinc-800 border-zinc-600 text-zinc-100 font-bold shadow-md'
                                    : 'bg-zinc-950/80 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            SEMUA
                        </button>
                        {CIVIC_CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setFilter(cat.id)}
                                className={`px-3 py-1.5 rounded-xl text-[10px] border transition-all flex items-center gap-1.5 ${
                                    filter === cat.id
                                        ? `${cat.activeBg} ${cat.color} ${cat.activeBorder} font-bold shadow-sm`
                                        : 'bg-zinc-950/80 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                <img
                                    src={cat.image}
                                    alt={cat.label}
                                    className="w-3.5 h-3.5 object-contain shrink-0 rounded"
                                />
                                <span className="uppercase">{cat.id}</span>
                            </button>
                        ))}
                        <button
                            onClick={() => setFilter('verified')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] border transition-all ${
                                filter === 'verified'
                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold shadow-md'
                                    : 'bg-zinc-950/80 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            ✓ DISAHKAN
                        </button>
                    </div>
                </motion.div>

                {/* ================================================================= */}
                {/* 5. ANOMALY CARDS FEED                                             */}
                {/* ================================================================= */}
                <div className="space-y-4">
                    <AnimatePresence>
                        {filteredAnomalies.map((a, i) => {
                            const cat = resolveCategory(a);
                            const catConfig = CIVIC_CATEGORIES.find(c => c.id === cat) || CIVIC_CATEGORIES[0];

                            return (
                                <motion.div
                                    key={a.id}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: i * 0.04 }}
                                    className="bg-gradient-to-b from-[#111116] to-[#0A0A0D] border border-zinc-800/80 rounded-3xl p-5 shadow-xl space-y-4 hover:border-zinc-700 transition-all"
                                >
                                    {/* Header Row */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border p-2 shadow-inner ${
                                                a.status === 'verified'
                                                    ? 'bg-emerald-500/10 border-emerald-500/30'
                                                    : 'bg-zinc-900/90 border-zinc-800'
                                            }`}>
                                                <img
                                                    src={catConfig.image}
                                                    alt={catConfig.label}
                                                    className="w-full h-full object-contain drop-shadow"
                                                />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border flex items-center gap-1 ${catConfig.activeBg} ${catConfig.color} ${catConfig.activeBorder}`}>
                                                        <img src={catConfig.image} alt="" className="w-2.5 h-2.5 object-contain" />
                                                        {catConfig.label}
                                                    </span>
                                                    <span className="text-[9px] font-mono text-zinc-400 font-bold bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800 flex items-center gap-1">
                                                        <Building2 className="w-2.5 h-2.5 text-[#C5A367]" />
                                                        Agensi: {a.suggestedAgency || a.aiAnalysis?.routingAgency || catConfig.suggestedAgency}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-widest">
                                                        #{a.id.slice(-4)} • {a.time}
                                                    </span>
                                                </div>
                                                <h4 className="font-sans text-base font-bold text-white leading-snug mt-1">
                                                    {a.title || (a.aiAnalysis?.damageType ? `${a.aiAnalysis.damageType} @ ${a.locationName || 'Kota Bharu'}` : `Laporan @ ${typeof a.lat === 'number' ? a.lat.toFixed(4) : a.lat}°, ${typeof a.lng === 'number' ? a.lng.toFixed(4) : a.lng}°`)}
                                                </h4>
                                            </div>
                                        </div>

                                        {/* Status Pill */}
                                        <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border shadow-sm ${
                                            a.status === 'verified'
                                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                : 'bg-zinc-800/80 text-zinc-400 border-zinc-700'
                                        }`}>
                                            {a.status === 'verified' ? '✓ Disahkan' : 'Dalam Semakan'}
                                        </span>
                                    </div>

                                    {/* Metadata Badges */}
                                    <div className="flex flex-wrap gap-2">
                                        {a.source === 'voice' ? (
                                            <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border bg-purple-500/10 border-purple-500/20 text-purple-300 flex items-center gap-1">
                                                <Mic className="w-3 h-3" /> Input Suara
                                            </span>
                                        ) : a.photoBase64 ? (
                                            <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border bg-blue-500/10 border-blue-500/20 text-blue-400 flex items-center gap-1">
                                                <ImageIcon className="w-3 h-3" /> Bukti Bergambar
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border bg-zinc-800/80 text-zinc-400 border-zinc-700">
                                                Laporan Teks
                                            </span>
                                        )}

                                        {a.urgency && (
                                            <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                                                a.urgency === 'High'
                                                    ? 'bg-red-500/20 border-red-500/30 text-red-400'
                                                    : a.urgency === 'Medium'
                                                    ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                                                    : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                                            }`}>
                                                Keutamaan: {a.urgency === 'High' ? 'Tinggi' : a.urgency === 'Medium' ? 'Sederhana' : 'Biasa'}
                                            </span>
                                        )}

                                        {a.confidenceScore != null && a.confidenceScore > 0 && (
                                            <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                                <Shield className="w-3 h-3 inline mr-1" />Keyakinan AI {a.confidenceScore}%
                                            </span>
                                        )}

                                        {a.detectedDialect && (
                                            <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                                Dialek {a.detectedDialect}
                                            </span>
                                        )}
                                    </div>

                                    {/* Speech & Dialect Card Area */}
                                    {a.originalText && (
                                        <div className="p-4 rounded-2xl bg-[#060609] border border-zinc-800/70 space-y-3 shadow-inner">
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 block">
                                                        💬 Keterangan Warga
                                                    </span>
                                                    <button
                                                        onClick={() => speakDialect(a.userIntendedMeaning || a.originalText || '')}
                                                        className="flex items-center gap-1 text-[9px] font-bold text-amber-400 hover:text-amber-300 transition-colors bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 active:scale-95"
                                                        title="Sintesis Suara AI"
                                                    >
                                                        <Volume2 className="w-3 h-3" /> Sebutan AI
                                                    </button>
                                                </div>
                                                <p className="text-xs sm:text-sm text-zinc-200 font-medium italic bg-zinc-900/70 p-3 rounded-xl border border-zinc-800/60">
                                                    "{a.originalText}"
                                                </p>
                                            </div>

                                            {a.userIntendedMeaning && (
                                                <div className="pt-2 border-t border-zinc-800/80">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1 mb-1">
                                                        <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Rumusan / Maksud AI (NLP)
                                                    </span>
                                                    <p className="text-xs text-amber-200/90 font-medium leading-relaxed bg-amber-500/5 p-2.5 rounded-xl border border-amber-500/20">
                                                        {a.userIntendedMeaning}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Dialect Feedback Loop */}
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
                                                            ⚠️ Maklum Balas Dihantar
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
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase active:scale-95 hover:bg-emerald-500/20"
                                                            >
                                                                👍 Tepat
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setFeedbackModalAnomaly(a);
                                                                    setFeedbackCorrectText(a.translatedText || a.originalText || '');
                                                                }}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase active:scale-95 hover:bg-amber-500/20"
                                                            >
                                                                👎 Salah
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons Footer */}
                                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 flex-wrap gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                onClick={() => analyzeAnomaly(a.id)}
                                                disabled={a.isAnalyzing}
                                                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#C5A367]/10 text-[#C5A367] border border-[#C5A367]/30 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#C5A367]/20 transition-all active:scale-95 disabled:opacity-60"
                                            >
                                                {a.isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                                Analisis AI
                                            </button>
                                            <button
                                                onClick={() => { setPhotoTargetId(a.id); fileInputRef.current?.click(); }}
                                                disabled={a.isAnalyzing}
                                                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500/20 transition-all active:scale-95 disabled:opacity-60"
                                            >
                                                <Camera className="w-3.5 h-3.5" /> Foto
                                            </button>
                                            <button
                                                onClick={() => setShareModalAnomaly(a)}
                                                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-all active:scale-95"
                                                title="Jana Kad Eskalasi Awam"
                                            >
                                                <Share2 className="w-3.5 h-3.5" /> Eskalasi Awam
                                            </button>
                                            <button
                                                onClick={() => generateAduanPdf(a)}
                                                className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-500/10 text-purple-300 border border-purple-500/30 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-purple-500/20 transition-all active:scale-95"
                                                title="Jana Borang Aduan Rasmi PBT (PDF)"
                                            >
                                                <FileText className="w-3.5 h-3.5 text-purple-400" /> Export PDF
                                            </button>
                                        </div>

                                        {a.aiAnalysis && (
                                            <button
                                                onClick={() => setAnomalies(prev => prev.map(x => x.id === a.id ? { ...x, expanded: !x.expanded } : x))}
                                                className="p-2 text-zinc-400 hover:text-white transition-colors"
                                            >
                                                {a.expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                            </button>
                                        )}
                                    </div>

                                    {/* AI Analysis Dropdown */}
                                    <AnimatePresence>
                                        {a.aiAnalysis && a.expanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-5 pb-5 pt-2 border-t border-zinc-800/50 space-y-3">
                                                    {a.photoBase64 && (
                                                        <div className="rounded-2xl overflow-hidden border border-zinc-800 h-32">
                                                            <img src={a.photoBase64} alt="Bukti" className="w-full h-full object-cover" />
                                                        </div>
                                                    )}
                                                    <div className="flex flex-wrap gap-2">
                                                        {a.aiAnalysis.severityScore > 0 && (
                                                            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border bg-amber-500/10 text-amber-400 border-amber-500/20">
                                                                {a.aiAnalysis.severityLabel || a.aiAnalysis.damageType} (Tahap {a.aiAnalysis.severityScore}/5)
                                                            </span>
                                                        )}
                                                        {a.aiAnalysis.routingAgency && (
                                                            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border bg-blue-500/10 border-blue-500/20 text-blue-300 flex items-center gap-1">
                                                                <Building2 className="w-3 h-3" /> Agensi: {a.aiAnalysis.routingAgency}
                                                            </span>
                                                        )}
                                                        {a.aiAnalysis.recommendedAction && (
                                                            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border bg-zinc-800/50 border-zinc-700 text-zinc-300">
                                                                {a.aiAnalysis.recommendedAction}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {a.aiAnalysis.riskAssessment && (
                                                        <p className="text-xs text-zinc-300 font-medium leading-relaxed bg-[#0A0A0C] rounded-xl p-3 border border-zinc-800/50">
                                                            <span className="text-zinc-100 font-bold">Analisis Risiko: </span>{a.aiAnalysis.riskAssessment}
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

                    {/* ============================================================= */}
                    {/* 6. REFINED EMPTY STATE                                        */}
                    {/* ============================================================= */}
                    {filteredAnomalies.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-12 px-6 bg-gradient-to-b from-[#101014] to-[#0A0A0C] border border-dashed border-zinc-800/80 rounded-3xl space-y-4 shadow-xl relative overflow-hidden my-4"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-center shadow-lg mx-auto">
                                <Layers className="w-7 h-7 text-[#C5A367]" />
                            </div>

                            <h4 className="font-sans text-lg font-bold text-white tracking-tight">
                                Jom Bantu Jaga Kawasan Kita!
                            </h4>

                            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed font-medium">
                                Belum ada aduan bagi kategori ini. Taip atau rakam suara anda di ruangan atas untuk menyalurkan aduan pertama kawasan anda kepada pihak berkuasa.
                            </p>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* ================================================================= */}
            {/* 7. VIRAL SHARE CARD MODAL                                         */}
            {/* ================================================================= */}
            <AnimatePresence>
                {shareModalAnomaly && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-[#0A0A0C] border-2 border-red-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-white"
                        >
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

                            <div className="bg-gradient-to-br from-red-950/40 via-zinc-900 to-black border border-red-500/30 rounded-2xl p-5 mb-4 relative overflow-hidden">
                                <h3 className="text-sm font-black text-red-400 mb-1 uppercase">
                                    {shareModalAnomaly.title || shareModalAnomaly.aiAnalysis?.damageType || 'ADUAN AWAM'}
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
                                        <span className="text-[9px] text-zinc-500 font-bold block uppercase">Keterangan Aduan</span>
                                        <span className="text-zinc-300">
                                            {shareModalAnomaly.translatedText || shareModalAnomaly.aiAnalysis?.riskAssessment || shareModalAnomaly.originalText || 'Aduan komuniti memerlukan tindakan pihak berkuasa.'}
                                        </span>
                                    </div>
                                </div>

                                <div className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest text-center border-t border-zinc-800 pt-2">
                                    NADI CIVIC SYSTEM • DISAHKAN WARGA
                                </div>
                            </div>

                            <div className="space-y-2">
                                <button
                                    onClick={() => {
                                        const issueTitle = shareModalAnomaly.title || shareModalAnomaly.aiAnalysis?.damageType || 'Aduan Warga';
                                        const loc = shareModalAnomaly.locationName ? `${shareModalAnomaly.locationName} (${shareModalAnomaly.lat}°, ${shareModalAnomaly.lng}°)` : `${shareModalAnomaly.lat}°, ${shareModalAnomaly.lng}°`;
                                        const quote = shareModalAnomaly.originalText ? `"${shareModalAnomaly.originalText}"` : `"${shareModalAnomaly.translatedText || ''}"`;
                                        const caption = `🚨 ADUAN SIVIK — KELANTAN!\n\n📌 Isu: ${issueTitle}\n📍 Lokasi: ${loc}\n💬 Aduan Warga: ${quote}\n⚠️ Status: Belum Selesai (Ticket #${shareModalAnomaly.id.slice(-6)})\n\nSila ambil tindakan segera! #KelantanSivik #NADI #PBTKelantan #AduanWarga`;
                                        navigator.clipboard.writeText(caption);
                                        setCopiedToast(true);
                                        setTimeout(() => setCopiedToast(false), 2000);
                                    }}
                                    className="w-full py-3 rounded-xl bg-emerald-500 text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all"
                                >
                                    <Share2 className="w-4 h-4" /> {copiedToast ? '✓ Kapsyen Disalin!' : 'Salin Kapsyen Media Sosial'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ================================================================= */}
            {/* 8. DIALECT AI FEEDBACK LOOP MODAL                                 */}
            {/* ================================================================= */}
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
                                Adakah terjemahan AI kurang tepat? Masukkan maksud sebenar untuk melatih enjin dialek NADI:
                            </p>

                            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 mb-3 space-y-1">
                                <span className="text-[9px] text-zinc-500 font-bold uppercase block">Ayat Asal Warga ({feedbackModalAnomaly.detectedDialect || 'Kelantan'}):</span>
                                <span className="text-xs text-emerald-400 font-medium">"{feedbackModalAnomaly.originalText || feedbackModalAnomaly.title}"</span>
                            </div>

                            <div className="space-y-1 mb-4">
                                <label className="text-[9px] text-zinc-400 font-bold uppercase block">Maksud Sebenar:</label>
                                <textarea
                                    value={feedbackCorrectText}
                                    onChange={(e) => setFeedbackCorrectText(e.target.value)}
                                    rows={3}
                                    placeholder="Taip maksud sebenar di sini..."
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
                                            <Loader2 className="w-4 h-4 animate-spin" /> Menghantar...
                                        </>
                                    ) : feedbackSuccessToast ? (
                                        <>✓ AI Berjaya Dikemaskini!</>
                                    ) : (
                                        <>
                                            <Send className="w-3.5 h-3.5" /> Hantar Terjemahan & Ajar AI
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => handleSendFeedback(true)}
                                    disabled={isSubmittingFeedback}
                                    className="w-full py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white font-bold text-[10px] uppercase tracking-wider transition-all"
                                >
                                    Langkau
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
