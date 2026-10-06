/**
 * Citizen Civic Reports & Road Defect View
 * 
 * Provides voice/text report submission, AI triage, automated PostGIS clustering,
 * dashcam anomaly capture, and JKR/PBT complaint ticket generation.
 */
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
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
    MoreHorizontal,
    Copy,
    Sparkles,
    Mic,
    FileText,
    Layers,
    Image as ImageIcon,
    Plus,
    X,
    MapPin,
    Volume2,
    Compass,
    AlertTriangle,
    Building2,
    Clock,
    
    Phone,
    Heart,
    ShieldAlert,
    Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import GlobalVoiceMic from '@/src/components/GlobalVoiceMic';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '@/src/context/AuthContext';
import { usePotholeContext, getDeviceFingerprint } from '@/src/context/PotholeDetectorContext';
import { useDashcam } from '../hooks/useDashcam';
import { createClient } from '@/src/lib/supabase/client';
import { generateAduanPdf } from '@/src/lib/pdf/generateAduanPdf';
import { speakDialect } from '@/src/lib/speech/speakDialect';
import { DEFAULT_SENSOR_LOCATION } from '@/src/config/constants';
import { formatReportRelative, formatReportExact } from '@/src/lib/format';

// Civic Complaint Categories & Local Agency Routing
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
    suggestedAgency: string; // Automatic agency routing: JKR, JPS, TNB, Alam Flora, Landskap, PBT
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
        keywords: ['longkang', 'parit', 'saliran', 'tersumbat', 'melimpah', 'parit busuk', 'air bertakung', 'takung', 'lumpur', 'culvert', 'kotoran parit', 'tali air', 'parit pecah', 'jentik-jentik', 'pembiakan aedes', 'takungan nyamuk'],
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
        keywords: ['haiwan', 'anjing', 'monyet', 'kucing terbiar', 'kacau ganggu', 'lain', 'cadangan', 'umum', 'bantuan', 'denggi', 'dengue', 'aedes', 'fogging', 'semburan', 'wabak', 'vektor', 'kesihatan', 'penyakit', 'keracunan', 'anjing gila', 'rabies'],
        suggestedAgency: 'Pejabat Kesihatan Daerah (PKD) / PBT'
    }
];

// =================================================================
// SMART EMERGENCY DISPATCH PROTOCOLS & OFFICIAL HOTLINES
// =================================================================
export interface EmergencyProtocol {
    id: 'medical' | 'electrical' | 'dengue' | 'disaster';
    title: string;
    subtitle: string;
    actionLabel: string;
    primaryPhone: string;
    primaryTel: string;
    primaryLabel: string;
    secondaryPhone?: string;
    secondaryTel?: string;
    secondaryLabel?: string;
    agencyName: string;
    badgeText: string;
    instructions: string[];
    canOpenBencana?: boolean;
}

export function detectEmergencyProtocol(text: string): EmergencyProtocol | null {
    if (!text || text.trim().length < 3) return null;
    const lower = text.toLowerCase();

    // 1. Acute Medical Emergency (Heart Attack, Stroke, Cardiac Arrest, Collapse, Unconscious)
    if (/(sakit jantung|serangan jantung|heart attack|strok|stroke|pengsan|tak sedar|koma|lemas|drowning|sesak nafas teruk|pendarahan teruk|kemalangan parah)/i.test(lower)) {
        return {
            id: 'medical',
            title: 'Kecemasan Perubatan & Nyawa (Sakit Jantung / Kemalangan)',
            subtitle: 'Situasi perubatan akut mengancam nyawa. Jangan tunggu aduan sivik — hubungi Ambulans 999 sekarang juga!',
            actionLabel: 'Hubungi Ambulans (999)',
            primaryPhone: '999',
            primaryTel: 'tel:999',
            primaryLabel: 'Hubungi Ambulans (999)',
            agencyName: 'MERS 999 (Ambulans & KKM)',
            badgeText: 'Kecemasan Nyawa 999',
            instructions: [
                'Baringkan mangsa dalam posisi selesa & longgarkan pakaian ketat.',
                'Jika tidak sedarkan diri & tiada pernafasan normal, mulakan CPR segera atau dapatkan AED.',
                'Minta seseorang tunggu di simpang masuk utama untuk memandu ambulans ke lokasi.'
            ]
        };
    }

    // 2. Electrical Hazard & Fallen Tree on Power Line / High Voltage Fire
    const isTreeOnWire = (
        (/(pokok|dahan)/i.test(lower) && /(tumbang|hempap|patah|jatuh)/i.test(lower) && /(tiang|wayar|kabel|elektrik|api)/i.test(lower)) ||
        (/(tiang api|tiang elektrik|wayar elektrik|kabel elektrik|pencawang|renjatan)/i.test(lower) && /(tumbang|hempap|putus|terbakar|meletup|jatuh|bawah)/i.test(lower))
    );
    if (isTreeOnWire) {
        return {
            id: 'electrical',
            title: 'Bahaya Renjatan Elektrik (Pokok Atas Tiang Api)',
            subtitle: 'Pokok menimpa tiang elektrik / wayar hidup berisiko renjatan maut! Jauhi lokasi & hubungi Bomba / TNB segera.',
            actionLabel: 'Panggil Bomba (999) / TNB (15454)',
            primaryPhone: '999',
            primaryTel: 'tel:999',
            primaryLabel: 'Panggil Bomba (999)',
            secondaryPhone: '15454',
            secondaryTel: 'tel:15454',
            secondaryLabel: 'TNB CareLine (15454)',
            agencyName: 'Bomba & Penyelamat / TNB',
            badgeText: 'Bahaya Renjatan Maut',
            instructions: [
                'JAUHI kawasan sekurang-kurangnya 10 meter (33 kaki). Anggap semua wayar yang jatuh berkuasa hidup.',
                'Jangan sentuh pokok, dahan atau air yang menyentuh wayar elektrik.',
                'Sekat laluan orang ramai atau kanak-kanak daripada menghampiri tempat kejadian.'
            ]
        };
    }

    // 3. Dengue Epidemic Outbreak / Aedes / Vector Disease
    if (/(denggi|dengue|aedes|wabak denggi|demam berdarah|pembiakan aedes|anjing gila|rabies)/i.test(lower)) {
        return {
            id: 'dengue',
            title: 'Amaran Wabak Denggi & Pembiakan Aedes',
            subtitle: 'Wabak denggi memerlukan tindakan kawalan vektor & semburan fogging segera oleh Pejabat Kesihatan Daerah (PKD)!',
            actionLabel: 'Hubungi Bilik Gerakan Denggi',
            primaryPhone: '03-8881 0200',
            primaryTel: 'tel:0388810200',
            primaryLabel: 'CPRC KKM (03-8881 0200)',
            secondaryPhone: '999',
            secondaryTel: 'tel:999',
            secondaryLabel: 'Kecemasan 999 (Kritikal)',
            agencyName: 'Bilik Gerakan Denggi PKD / CPRC KKM',
            badgeText: 'Kawalan Vektor KKM',
            instructions: [
                'Jika pesakit ada tanda bahaya (muntah berterusan, sakit perut teruk, pendarahan), bawa ke hospital kecemasan serta-merta.',
                'Cari & musnahkan takungan air jentik-jentik di sekeliling rumah selama 10 minit.',
                'Laporkan ke PKD untuk operasi semburan kabus (fogging) dalam radius 200m.'
            ]
        };
    }

    // 4. Natural Disaster / Flooding / Entrapment
    if (/(banjir besar|banjir kilat teruk|air naik mendadak|terperangkap banjir|arus deras|pindah banjir|tanah runtuh besar|rumah tenggelam|paras bahaya|bencana alam|gas bocor)/i.test(lower)) {
        return {
            id: 'disaster',
            title: 'Kecemasan Bencana Alam & Pemindahan',
            subtitle: 'Situasi bencana membahayakan nyawa atau kediaman terancam. Hubungi MERS 999 atau buka Modul Bencana NADI.',
            actionLabel: 'Panggil Penyelamat MERS 999',
            primaryPhone: '999',
            primaryTel: 'tel:999',
            primaryLabel: 'Penyelamat MERS 999',
            agencyName: 'MERS 999 (Bomba, APM & Polis)',
            badgeText: 'Bencana & Penyelamat',
            canOpenBencana: true,
            instructions: [
                'Matikan suis utama bekalan elektrik & gas rumah sebelum air meningkat.',
                'Bawa dokumen penting, ubat-ubatan & berpindah ke Pusat Pemindahan Sementara (PPS).',
                'Jangan sesekali meredah air banjir yang berarus deras.'
            ]
        };
    }

    return null;
}

function detectCategoryFromText(text: string): CivicCategory {
    const lower = text.toLowerCase();
    for (const cat of CIVIC_CATEGORIES) {
        if (cat.keywords.some(kw => lower.includes(kw))) {
            return cat.id;
        }
    }
    return 'lain';
}

export function detectUrgencyFromText(text: string): 'Low' | 'Medium' | 'High' {
    const lower = text.toLowerCase();
    // Critical public health, epidemic, or life-threatening hazards
    if (/(denggi|dengue|aedes|wabak|rabies|bangkai|keracunan|gas bocor|lemas|tanah runtuh|kebakaran|api|renjatan)/i.test(lower)) {
        return 'High';
    }
    // Severe infrastructure or safety risks
    if (/(lubang besar|pothole besar|terputus|hancur|banjir|melimpah|tiang tumbang|pokok tumbang)/i.test(lower)) {
        return 'High';
    }
    // Standard civic defect
    if (/(lubang|rosak|lampu padam|tersumbat|longkang|sampah|busuk)/i.test(lower)) {
        return 'Medium';
    }
    return 'Low';
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

// Officers move reports past 'pending' via /admin (citizens can only insert 'pending').
type AnomalyStatus = 'pending' | 'verified' | 'resolved' | 'rejected';
const STATUS_LABEL: Record<AnomalyStatus, string> = {
    pending: 'Dalam Semakan', verified: 'Disahkan', resolved: 'Selesai', rejected: 'Ditolak',
};
const isConfirmed = (s: AnomalyStatus) => s === 'verified' || s === 'resolved';

interface Anomaly {
    id: string;
    userId?: string;
    lat: number;
    lng: number;
    category?: CivicCategory;
    zDropped: number;
    verifications: number;
    status: AnomalyStatus;
    time: string;
    createdAt?: string;
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

async function fetchLocationNameFromCoords(lat: number, lng: number): Promise<string> {
    try {
        const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}`, {
            signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
            const data = await res.json();
            if (data.location && typeof data.location === 'string' && data.location.trim()) {
                return data.location.trim();
            }
            if (data.state && typeof data.state === 'string' && data.state.trim()) {
                return data.state.trim();
            }
        }
    } catch (e) {
        console.warn('Reverse geocode error:', e);
    }
    return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
}

interface AduanViewProps {
    onNavigateToBencana?: () => void;
}

export default function AduanView({ onNavigateToBencana }: AduanViewProps = {}) {
    const { user, session } = useAuth();
    const { t } = useLanguage();
    const { applyLocationPrecision, locationPrecision, playAlertSound } = useTheme();
    const [filter, setFilter] = useState<'all' | 'jalan' | 'saliran' | 'lampu' | 'sampah' | 'pokok' | 'kemudahan' | 'lain' | 'verified'>('all');
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [activeMenuReportId, setActiveMenuReportId] = useState<string | null>(null);

    // Universal Composer States
    const [manualDescription, setManualDescription] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<CivicCategory>('jalan');
    const [hasManuallySelectedCategory, setHasManuallySelectedCategory] = useState(false);
    const [isParsingVoice, setIsParsingVoice] = useState(false);
    const [userGpsLocation, setUserGpsLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
    const [isGettingGps, setIsGettingGps] = useState(false);
    const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);
    const gpsErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Modals
    const [copiedToast, setCopiedToast] = useState(false);
    const [deletedToast, setDeletedToast] = useState(false);
    const [deleteErrorToast, setDeleteErrorToast] = useState(false);
    const [feedbackModalAnomaly, setFeedbackModalAnomaly] = useState<Anomaly | null>(null);
    const [feedbackCorrectText, setFeedbackCorrectText] = useState('');
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [feedbackSuccessToast, setFeedbackSuccessToast] = useState(false);

    // Photo & Media Attachment Hub
    const [attachedPhotoBase64, setAttachedPhotoBase64] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isMediaMenuOpen, setIsMediaMenuOpen] = useState(false);
    const photoFileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
    const liveCameraVideoRef = useRef<HTMLVideoElement | null>(null);
    const liveCameraStreamRef = useRef<MediaStream | null>(null);

    const supabase = useMemo(() => createClient(), []);
    const detector = usePotholeContext();
    const dashcam = useDashcam();

    const isDesktop = typeof window !== 'undefined' && !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const activeEmergencyProtocol = useMemo(() => {
        return detectEmergencyProtocol(manualDescription);
    }, [manualDescription]);

    const [interceptEmergency, setInterceptEmergency] = useState<EmergencyProtocol | null>(null);

    const handleDescriptionChange = (text: string) => {
        setManualDescription(text);
        if (!hasManuallySelectedCategory) {
            const detected = detectCategoryFromText(text);
            setSelectedCategory(detected);
        }
    };

    useEffect(() => {
        if (!userGpsLocation && typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const adjusted = applyLocationPrecision(pos.coords.latitude, pos.coords.longitude);
                    setUserGpsLocation({
                        lat: adjusted.lat,
                        lng: adjusted.lng,
                        label: `${adjusted.lat.toFixed(4)}°, ${adjusted.lng.toFixed(4)}°`
                    });
                    const resolvedName = await fetchLocationNameFromCoords(adjusted.lat, adjusted.lng);
                    if (resolvedName) {
                        setUserGpsLocation(prev => prev ? { ...prev, label: resolvedName } : null);
                    }
                },
                () => {},
                { enableHighAccuracy: locationPrecision === 'high', timeout: 5000 }
            );
        }
    }, [userGpsLocation, applyLocationPrecision, locationPrecision]);

    const handleGetGps = () => {
        playAlertSound('radar');
        setGpsErrorMessage(null);
        if (gpsErrorTimeoutRef.current) clearTimeout(gpsErrorTimeoutRef.current);

        if (typeof window === 'undefined' || !navigator.geolocation) {
            setGpsErrorMessage('Pelayar anda tidak menyokong fungsi geolokasi.');
            playAlertSound('error');
            return;
        }

        setIsGettingGps(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const adjusted = applyLocationPrecision(pos.coords.latitude, pos.coords.longitude);
                setUserGpsLocation({
                    lat: adjusted.lat,
                    lng: adjusted.lng,
                    label: `${adjusted.lat.toFixed(4)}°, ${adjusted.lng.toFixed(4)}°`
                });
                setIsGettingGps(false);
                setGpsErrorMessage(null);
                playAlertSound('success');

                const resolvedName = await fetchLocationNameFromCoords(adjusted.lat, adjusted.lng);
                if (resolvedName) {
                    setUserGpsLocation(prev => prev ? { ...prev, label: resolvedName } : null);
                }
            },
            (err) => {
                console.warn('GPS location error:', err);
                setIsGettingGps(false);
                playAlertSound('error');

                let msg = 'Gagal dapatkan lokasi';
                if (err && typeof err.code === 'number') {
                    if (err.code === 1) {
                        msg = 'Akses lokasi disekat di pelayar';
                    }
                }
                setGpsErrorMessage(msg);

                if (gpsErrorTimeoutRef.current) clearTimeout(gpsErrorTimeoutRef.current);
                gpsErrorTimeoutRef.current = setTimeout(() => {
                    setGpsErrorMessage(null);
                }, 5000);
            },
            { enableHighAccuracy: locationPrecision === 'high', timeout: 6000 }
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
                try { playAlertSound('success'); } catch {}
            };
            reader.readAsDataURL(file);
        }
        setIsMediaMenuOpen(false);
        e.target.value = '';
    };

    const stopLiveCamera = () => {
        if (liveCameraStreamRef.current) {
            liveCameraStreamRef.current.getTracks().forEach(track => {
                try { track.stop(); } catch {}
            });
            liveCameraStreamRef.current = null;
        }
        setIsLiveCameraOpen(false);
    };

    const handleTriggerCamera = async () => {
        setIsMediaMenuOpen(false);
        if (!isDesktop) {
            cameraInputRef.current?.click();
            return;
        }

        if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
                });
                liveCameraStreamRef.current = stream;
                setIsLiveCameraOpen(true);
                setTimeout(() => {
                    if (liveCameraVideoRef.current) {
                        liveCameraVideoRef.current.srcObject = stream;
                        liveCameraVideoRef.current.play().catch(() => {});
                    }
                }, 100);
                return;
            } catch (err) {
                console.warn('Webcam access error, fallback to file input:', err);
            }
        }
        cameraInputRef.current?.click();
    };

    const snapLivePhoto = () => {
        const video = liveCameraVideoRef.current;
        if (!video) return;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const base64 = canvas.toDataURL('image/jpeg', 0.85);
                setAttachedPhotoBase64(base64);
                try { playAlertSound('success'); } catch {}
            }
        } catch (e) {
            console.warn('Live photo snap error:', e);
        }
        stopLiveCamera();
    };

    const handleTriggerGallery = () => {
        setIsMediaMenuOpen(false);
        photoFileInputRef.current?.click();
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

    const handleSendAduan = async (bypassEmergencyCheck = false) => {
        const textToProcess = manualDescription.trim();
        const photoToProcess = attachedPhotoBase64;
        if ((!textToProcess && !photoToProcess) || isParsingVoice) return;

        // Emergency intercept guard: direct user to official hotline before slow civic filing
        if (!bypassEmergencyCheck) {
            const detectedEmergency = detectEmergencyProtocol(textToProcess);
            if (detectedEmergency) {
                setInterceptEmergency(detectedEmergency);
                try { playAlertSound('siren'); } catch {}
                return;
            }
        }

        if (!user || !session?.access_token) {
            alert('Sila log masuk terlebih dahulu untuk menghantar aduan.');
            return;
        }

        setIsParsingVoice(true);
        let resData: any = null;
        let visionAnalysis: any = null;

        try {
            if (textToProcess) {
                const res = await fetch('/api/suara/parse', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        inputText: textToProcess,
                        targetLanguage: 'ms'
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
                    headers: {
                        'Content-Type': 'application/json',
                        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
                    },
                    body: JSON.stringify({
                        imageBase64: cleanBase64,
                        lat: userGpsLocation?.lat || resData?.coordinates?.lat || DEFAULT_SENSOR_LOCATION.lat,
                        lng: userGpsLocation?.lng || resData?.coordinates?.lng || DEFAULT_SENSOR_LOCATION.lng,
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

        const detectedCat = detectCategoryFromText(textToProcess);
        const reportCategory = (!hasManuallySelectedCategory && resData?.category)
            ? resData.category
            : (hasManuallySelectedCategory ? selectedCategory : (detectedCat || 'lain'));

        const catConfig = CIVIC_CATEGORIES.find(c => c.id === reportCategory);
        const intent = visionAnalysis?.damageType || resData?.intent || `Aduan ${catConfig?.label || 'Sivik'}`;
        const locName = userGpsLocation?.label || resData?.location || (userGpsLocation?.lat ? `${userGpsLocation.lat.toFixed(4)}°N, ${userGpsLocation.lng.toFixed(4)}°E` : 'Lokasi Semasa');
        const translation = resData?.simplifiedTranslation || textToProcess || visionAnalysis?.damageType || `Aduan ${catConfig?.label || 'Sivik'}`;
        const dialect = resData?.detectedDialect || 'kelantan';

        // Public health, vector threats, & dengue are ALWAYS High urgency!
        const isVectorOrHealth = /(denggi|dengue|aedes|wabak|rabies|vektor|fogging)/i.test(textToProcess);
        const clientUrgency = detectUrgencyFromText(textToProcess);
        const urgency: 'Low' | 'Medium' | 'High' = isVectorOrHealth
            ? 'High'
            : ((resData?.urgency || (visionAnalysis?.severityScore >= 4 ? 'High' : clientUrgency)) as 'Low' | 'Medium' | 'High');

        const effectiveAgency = resData?.suggestedAgency || (isVectorOrHealth ? 'Pejabat Kesihatan Daerah (PKD) / KKM' : catConfig?.suggestedAgency || 'PBT');

        const intendedMeaning = resData?.userIntendedMeaning || translation;
        const parsedConfidence = resData?.confidenceScore
            ? Number(resData.confidenceScore)
            : Math.min(98, Math.max(75, 80 + (resData?.dialectWords?.length || 0) * 4));

        const reportLat = userGpsLocation?.lat || resData?.coordinates?.lat || 0;
        const reportLng = userGpsLocation?.lng || resData?.coordinates?.lng || 0;

        const createdAtIso = new Date().toISOString();
        const newA: Anomaly = {
            id: `aduan-${Date.now()}`,
            userId: user?.id,
            lat: reportLat,
            lng: reportLng,
            category: reportCategory,
            suggestedAgency: effectiveAgency,
            zDropped: 0,
            verifications: 1,
            status: 'pending',
            createdAt: createdAtIso,
            time: formatReportRelative(createdAtIso, true, 'Baru sahaja'),
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
                repairMethod: visionAnalysis.recommendedAction || (isVectorOrHealth ? 'Pemeriksaan Tapak & Semburan Fogging' : 'Penilaian & Tindakan PBT'),
                repairCostMYR: 'Mengikut Skop Kerosakan',
                priorityScore: visionAnalysis.priorityScore || (isVectorOrHealth ? 95 : 75),
                riskAssessment: visionAnalysis.riskAssessment || intendedMeaning,
                nearestRoadType: locName,
                recommendedAction: visionAnalysis.recommendedAction || (isVectorOrHealth ? 'Kawalan Vektor & Hapus Tempat Pembiakan' : 'Penugasan Skuad Tindakan Tapak'),
                routingAgency: effectiveAgency
            } : {
                severityScore: urgency === 'High' ? 4 : urgency === 'Medium' ? 3 : 2,
                severityLabel: `Aduan ${catConfig?.label}`,
                damageType: intent,
                estimatedWidth: '—',
                estimatedDepth: '—',
                repairMethod: isVectorOrHealth ? 'Pemeriksaan Tapak & Semburan Fogging' : 'Penilaian & Tindakan PBT',
                repairCostMYR: 'Mengikut Skop Kerosakan',
                priorityScore: isVectorOrHealth ? 95 : urgency === 'High' ? 88 : urgency === 'Medium' ? 68 : 48,
                riskAssessment: intendedMeaning,
                nearestRoadType: locName,
                recommendedAction: isVectorOrHealth ? 'Kawalan Vektor & Hapus Tempat Pembiakan' : 'Penugasan Skuad Tindakan Tapak',
                routingAgency: effectiveAgency
            }
        };

        setAnomalies(prev => {
            const updated = [newA, ...prev];
            const cacheKey = user?.id ? `nadi_local_potholes_${user.id}` : 'nadi_local_potholes';
            try { localStorage.setItem(cacheKey, JSON.stringify(updated.slice(0, 50))); } catch {}
            return updated;
        });
        setManualDescription('');
        setAttachedPhotoBase64(null);
        setHasManuallySelectedCategory(false);

        try {
            const deviceFp = getDeviceFingerprint();
            const { data: insertRes, error: insertError } = await supabase.from('nadi_infra_reports').insert({
                user_id: user?.id || null,
                lat: String(newA.lat),
                lng: String(newA.lng),
                z_dropped: 0,
                confidence_score: parsedConfidence,
                device_fingerprint: deviceFp,
                status: newA.status,
                title: newA.title,
                ai_analysis: {
                    ...newA.aiAnalysis,
                    originalText: newA.originalText,
                    userIntendedMeaning: newA.userIntendedMeaning,
                    translatedText: newA.translatedText,
                    detectedDialect: newA.detectedDialect,
                    urgency: newA.urgency,
                    category: newA.category
                },
                photo_url: photoToProcess || null,
                created_at: createdAtIso,
            }).select('id').single();
            if (insertError) console.error('[AduanView] report insert failed:', insertError.message);

            if (insertRes?.id) {
                const dbId = insertRes.id;
                setAnomalies(prev => {
                    const updated = prev.map(a => a.id === newA.id ? { ...a, id: dbId } : a);
                    const cacheKey = user?.id ? `nadi_local_potholes_${user.id}` : 'nadi_local_potholes';
                    try {
                        localStorage.setItem(cacheKey, JSON.stringify(updated.slice(0, 50)));
                        localStorage.setItem('nadi_local_potholes', JSON.stringify(updated.slice(0, 50)));
                    } catch {}
                    return updated;
                });
            }
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
            if (filter === 'verified') return isConfirmed(a.status);
            if (filter === 'all') return true;
            return resolveCategory(a) === filter;
        });
    }, [anomalies, filter]);

    const totalReports = anomalies.length;
    const totalVerified = anomalies.filter(a => isConfirmed(a.status)).length;
    const totalResolved = anomalies.filter(a => a.status === 'resolved').length;

    const persistAnomaliesAndFeedback = (
        updatedList: Anomaly[],
        reportId: string,
        feedback: {
            feedbackGiven: 'up' | 'down';
            userIntendedMeaning?: string;
            translatedText?: string;
            originalText?: string;
        }
    ) => {
        const cacheKey = user?.id ? `nadi_local_potholes_${user.id}` : 'nadi_local_potholes';
        try {
            localStorage.setItem(cacheKey, JSON.stringify(updatedList.slice(0, 50)));
            localStorage.setItem('nadi_local_potholes', JSON.stringify(updatedList.slice(0, 50)));
        } catch (e) {
            console.warn('Failed to save anomalies to localStorage:', e);
        }

        try {
            const rawMap = localStorage.getItem('nadi_aduan_feedback_map');
            const map = rawMap ? JSON.parse(rawMap) : {};
            const entry = {
                feedbackGiven: feedback.feedbackGiven,
                userIntendedMeaning: feedback.userIntendedMeaning,
                translatedText: feedback.translatedText,
                updatedAt: Date.now()
            };
            if (reportId) {
                map[reportId] = entry;
            }
            if (feedback.originalText) {
                map[feedback.originalText.trim()] = entry;
            }
            localStorage.setItem('nadi_aduan_feedback_map', JSON.stringify(map));
        } catch (e) {
            console.warn('Failed to save feedback map to localStorage:', e);
        }

        if (reportId && !reportId.startsWith('aduan-')) {
            const item = updatedList.find(x => x.id === reportId);
            if (item?.aiAnalysis) {
                supabase.from('nadi_infra_reports')
                    .update({
                        ai_analysis: {
                            ...item.aiAnalysis,
                            riskAssessment: feedback.userIntendedMeaning || item.aiAnalysis.riskAssessment,
                            userCorrection: feedback.translatedText || undefined,
                            feedbackGiven: feedback.feedbackGiven
                        }
                    })
                    .eq('id', reportId)
                    .then(() => {});
            }
        }
    };

    const handleSendFeedback = async (skipCorrection = false) => {
        if (!feedbackModalAnomaly || isSubmittingFeedback) return;

        const anomalyId = feedbackModalAnomaly.id;
        const correction = skipCorrection ? '' : feedbackCorrectText.trim();
        const originalText = feedbackModalAnomaly.originalText || feedbackModalAnomaly.title || '';

        // If skipping, dismiss immediately
        if (skipCorrection) {
            setAnomalies(prev => {
                const updated = prev.map(item => item.id === anomalyId ? {
                    ...item,
                    feedbackGiven: 'down' as const
                } : item);
                persistAnomaliesAndFeedback(updated, anomalyId, {
                    feedbackGiven: 'down',
                    originalText
                });
                return updated;
            });
            setFeedbackModalAnomaly(null);
            setFeedbackCorrectText('');
            return;
        }

        setIsSubmittingFeedback(true);

        const updatedMeaning = correction ? `Dikemaskini Warga: "${correction}"` : (feedbackModalAnomaly.userIntendedMeaning || '');

        // Optimistic update immediately - apply corrected meaning to report and persist locally
        setAnomalies(prev => {
            const updated = prev.map(item => item.id === anomalyId ? {
                ...item,
                feedbackGiven: 'down' as const,
                translatedText: correction || item.translatedText,
                userIntendedMeaning: updatedMeaning,
                aiAnalysis: item.aiAnalysis ? {
                    ...item.aiAnalysis,
                    riskAssessment: updatedMeaning
                } : item.aiAnalysis
            } : item);
            persistAnomaliesAndFeedback(updated, anomalyId, {
                feedbackGiven: 'down',
                translatedText: correction || feedbackModalAnomaly.translatedText,
                userIntendedMeaning: updatedMeaning,
                originalText
            });
            return updated;
        });

        try {
            await fetch('/api/dialect/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dialectText: originalText,
                    correctMeaning: correction,
                    region: feedbackModalAnomaly.detectedDialect || 'kelantan',
                    rawVoice: feedbackModalAnomaly.originalText || '',
                    reportId: anomalyId,
                    isPositive: false
                })
            });

            setFeedbackSuccessToast(true);
            setTimeout(() => {
                setFeedbackSuccessToast(false);
                setFeedbackModalAnomaly(null);
                setFeedbackCorrectText('');
            }, 1200);
        } catch (err) {
            console.warn('Feedback submit error:', err);
            // Even if network fails, client persistence is already saved
            setFeedbackSuccessToast(true);
            setTimeout(() => {
                setFeedbackSuccessToast(false);
                setFeedbackModalAnomaly(null);
                setFeedbackCorrectText('');
            }, 1200);
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    useEffect(() => {
        const cacheKey = user?.id ? `nadi_local_potholes_${user.id}` : 'nadi_local_potholes';
        const savedLocal = localStorage.getItem(cacheKey) || localStorage.getItem('nadi_local_potholes');

        let feedbackMap: Record<string, any> = {};
        try {
            const rawMap = localStorage.getItem('nadi_aduan_feedback_map');
            if (rawMap) feedbackMap = JSON.parse(rawMap);
        } catch {}

        if (savedLocal) {
            try {
                const parsed = JSON.parse(savedLocal);
                // Sanitize any historic dengue reports and re-apply crowd feedback
                const sanitized = parsed.map((item: Anomaly) => {
                    const fb = feedbackMap[item.id] || (item.originalText && feedbackMap[item.originalText.trim()]);
                    let resItem = { ...item };
                    if (fb) {
                        resItem.feedbackGiven = fb.feedbackGiven || resItem.feedbackGiven;
                        resItem.translatedText = fb.translatedText || resItem.translatedText;
                        resItem.userIntendedMeaning = fb.userIntendedMeaning || resItem.userIntendedMeaning;
                        if (resItem.aiAnalysis && fb.userIntendedMeaning) {
                            resItem.aiAnalysis = { ...resItem.aiAnalysis, riskAssessment: fb.userIntendedMeaning };
                        }
                    }

                    const txt = `${resItem.title || ''} ${resItem.originalText || ''} ${resItem.translatedText || ''}`.toLowerCase();
                    if (/(denggi|dengue|aedes|wabak|rabies)/i.test(txt)) {
                        return {
                            ...resItem,
                            urgency: 'High' as const,
                            suggestedAgency: (!resItem.suggestedAgency || resItem.suggestedAgency === 'JKR / PBT' || resItem.suggestedAgency === 'PBT')
                                ? 'Pejabat Kesihatan Daerah (PKD) / KKM'
                                : resItem.suggestedAgency,
                            category: (resItem.category === 'jalan' ? 'lain' : resItem.category) as CivicCategory
                        };
                    }
                    return resItem;
                });
                setAnomalies(sanitized);
            } catch {}
        }

        supabase.from('nadi_infra_reports').select('*').neq('status', 'rejected').order('created_at', { ascending: false }).limit(100)
            .then(({ data }) => {
                if (data && data.length > 0) {
                    const mapped: Anomaly[] = data.map((d: any) => ({
                        id: d.id,
                        userId: d.user_id,
                        lat: typeof d.lat === 'string' ? parseFloat(d.lat) : (d.lat || d.latitude || 0),
                        lng: typeof d.lng === 'string' ? parseFloat(d.lng) : (d.lng || d.longitude || 0),
                        zDropped: Number(d.z_dropped || 0),
                        verifications: Number(d.verifications || 1),
                        status: d.status || 'pending',
                        createdAt: d.created_at,
                        time: formatReportRelative(d.created_at, true, 'Baru sahaja'),
                        title: d.title || d.ai_analysis?.damageType || (d.z_dropped ? `Lubang Jalan Dikesan (${Number(d.z_dropped).toFixed(1)}g)` : 'Aduan Infrastruktur'),
                        aiAnalysis: d.ai_analysis,
                        photoBase64: d.photo_url,
                        confidenceScore: d.confidence_score || 0,
                        speedKmh: d.speed_kmh || 0,
                        snapshotBase64: d.snapshot_base64,
                        suggestedAgency: d.ai_analysis?.routingAgency || 'JKR / PBT',
                        category: d.ai_analysis?.category || 'lain',
                        urgency: d.ai_analysis?.urgency || 'Medium',
                        originalText: d.ai_analysis?.originalText,
                        translatedText: d.ai_analysis?.userCorrection || d.ai_analysis?.translatedText,
                        userIntendedMeaning: d.ai_analysis?.userCorrection
                            ? `Dikemaskini Warga: "${d.ai_analysis.userCorrection}"`
                            : (d.ai_analysis?.userIntendedMeaning || d.ai_analysis?.riskAssessment),
                        feedbackGiven: d.ai_analysis?.feedbackGiven,
                        detectedDialect: d.ai_analysis?.detectedDialect || 'kelantan',
                    }));

                    setAnomalies(prev => {
                        const merged = [...prev];
                        mapped.forEach(m => {
                            const existingIndex = merged.findIndex(item => item.id === m.id);
                            const fb = feedbackMap[m.id] || (m.originalText && feedbackMap[m.originalText.trim()]);
                            if (existingIndex >= 0) {
                                const existing = merged[existingIndex];
                                const existingFb = existing.feedbackGiven ? existing : fb;
                                merged[existingIndex] = {
                                    ...existing,
                                    ...m,
                                    // PRESERVE local edits, feedback and citizen corrections
                                    feedbackGiven: existing.feedbackGiven || existingFb?.feedbackGiven,
                                    userIntendedMeaning: existing.userIntendedMeaning || existingFb?.userIntendedMeaning || m.userIntendedMeaning,
                                    translatedText: existing.translatedText || existingFb?.translatedText || m.translatedText,
                                    originalText: existing.originalText || m.originalText,
                                    aiAnalysis: (existing.aiAnalysis || m.aiAnalysis) ? ({
                                        ...(m.aiAnalysis || {}),
                                        ...(existing.aiAnalysis || {}),
                                        riskAssessment: existing.userIntendedMeaning || existingFb?.userIntendedMeaning || m.aiAnalysis?.riskAssessment || ''
                                    } as AiAnalysis) : undefined
                                };
                            } else {
                                if (fb) {
                                    merged.push({
                                        ...m,
                                        feedbackGiven: fb.feedbackGiven,
                                        userIntendedMeaning: fb.userIntendedMeaning,
                                        translatedText: fb.translatedText,
                                        aiAnalysis: m.aiAnalysis ? {
                                            ...m.aiAnalysis,
                                            riskAssessment: fb.userIntendedMeaning || m.aiAnalysis.riskAssessment
                                        } : undefined
                                    });
                                } else {
                                    merged.push(m);
                                }
                            }
                        });
                        try {
                            localStorage.setItem(cacheKey, JSON.stringify(merged.slice(0, 50)));
                        } catch {}
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

                        // Check if this incoming insert corresponds to a locally created report (same coordinates within ~20m)
                        const localIndex = prev.findIndex(a =>
                            a.id.startsWith('aduan-') &&
                            Math.abs((a.lat || 0) - (Number(d.lat) || 0)) < 0.0002 &&
                            Math.abs((a.lng || 0) - (Number(d.lng) || 0)) < 0.0002
                        );

                        if (localIndex >= 0) {
                            // Update temporary local ID to real DB ID while preserving all local fields & feedback
                            const updated = [...prev];
                            const localItem = updated[localIndex];
                            updated[localIndex] = {
                                ...localItem,
                                id: d.id,
                                status: d.status || localItem.status
                            };
                            try {
                                localStorage.setItem(cacheKey, JSON.stringify(updated.slice(0, 50)));
                            } catch {}
                            return updated;
                        }

                        const fb = feedbackMap[d.id] || (d.ai_analysis?.originalText && feedbackMap[d.ai_analysis.originalText.trim()]);
                        const newReport: Anomaly = {
                            id: d.id,
                            userId: d.user_id,
                            lat: typeof d.lat === 'string' ? parseFloat(d.lat) : (d.lat || d.latitude || 0),
                            lng: typeof d.lng === 'string' ? parseFloat(d.lng) : (d.lng || d.longitude || 0),
                            zDropped: Number(d.z_dropped || 0),
                            verifications: Number(d.verifications || 1),
                            status: d.status || 'pending',
                            createdAt: d.created_at,
                            time: formatReportRelative(d.created_at, true, 'Baru sahaja'),
                            title: d.title || d.ai_analysis?.damageType || (d.z_dropped ? `Lubang Jalan Dikesan (${Number(d.z_dropped).toFixed(1)}g)` : 'Aduan Infrastruktur'),
                            aiAnalysis: d.ai_analysis,
                            photoBase64: d.photo_url,
                            confidenceScore: d.confidence_score || 0,
                            speedKmh: d.speed_kmh || 0,
                            snapshotBase64: d.snapshot_base64,
                            suggestedAgency: d.ai_analysis?.routingAgency || 'JKR / PBT',
                            category: d.ai_analysis?.category || 'lain',
                            urgency: d.ai_analysis?.urgency || 'Medium',
                            originalText: d.ai_analysis?.originalText,
                            translatedText: fb?.translatedText || d.ai_analysis?.userCorrection || d.ai_analysis?.translatedText,
                            userIntendedMeaning: fb?.userIntendedMeaning || (d.ai_analysis?.userCorrection ? `Dikemaskini Warga: "${d.ai_analysis.userCorrection}"` : (d.ai_analysis?.userIntendedMeaning || d.ai_analysis?.riskAssessment)),
                            feedbackGiven: fb?.feedbackGiven || d.ai_analysis?.feedbackGiven,
                            detectedDialect: d.ai_analysis?.detectedDialect || 'kelantan',
                        };

                        const updated = [newReport, ...prev];
                        try {
                            localStorage.setItem(cacheKey, JSON.stringify(updated.slice(0, 50)));
                        } catch {}
                        return updated;
                    });
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [supabase, user]);

    useEffect(() => {
        if (!detector.lastDetection) return;
        const det = detector.lastDetection;
        const tempId = det.id;

        // Check if Dashcam frame snapshot can be attached
        let snapshot: string | null = null;
        if (dashcam.isDashcamEnabled && dashcam.isStreaming) {
            snapshot = dashcam.captureFrame();
        }

        const createdAtIso = new Date().toISOString();
        const newAnomaly: Anomaly = {
            id: tempId,
            userId: user?.id,
            lat: det.lat,
            lng: det.lng,
            category: 'jalan',
            suggestedAgency: 'JKR / PBT',
            zDropped: det.zDrop,
            verifications: 1,
            status: 'pending',
            createdAt: createdAtIso,
            time: formatReportRelative(createdAtIso, true, 'Baru sahaja'),
            confidenceScore: det.confidenceScore,
            speedKmh: det.speedKmh,
            snapshotBase64: snapshot || undefined,
            title: `Lubang Jalan Dikesan (${det.zDrop.toFixed(1)}g)`,
        };

        const cacheKey = user?.id ? `nadi_local_potholes_${user.id}` : 'nadi_local_potholes';
        setAnomalies(prev => {
            if (prev.some(a => a.id === tempId)) {
                return prev.map(a => a.id === tempId ? { ...a, snapshotBase64: snapshot || a.snapshotBase64 } : a);
            }
            const updated = [newAnomaly, ...prev];
            try {
                localStorage.setItem(cacheKey, JSON.stringify(updated.slice(0, 50)));
            } catch {}
            return updated;
        });

        // If snapshot is captured from dashcam HUD, update Supabase record
        if (snapshot) {
            const rawBase64 = snapshot.split(',')[1] || null;
            supabase.from('nadi_infra_reports')
                .update({ snapshot_base64: rawBase64 })
                .eq('user_id', user?.id || null)
                .order('created_at', { ascending: false })
                .limit(1)
                .then(() => {});
        }
    }, [detector.lastDetection, user, dashcam.isDashcamEnabled, dashcam.isStreaming]);

    const handleToggleDashcam = async () => {
        detector.startDriving();
        if (dashcam.isDashcamEnabled) {
            dashcam.disableDashcam();
        } else {
            await dashcam.enableDashcam();
        }
    };

    const handleShareReport = async (a: Anomaly) => {
        const issueTitle = a.title || a.aiAnalysis?.damageType || 'Aduan Warga';
        const loc = a.locationName ? `${a.locationName} (${a.lat}°, ${a.lng}°)` : `${a.lat}°, ${a.lng}°`;
        const quote = a.originalText ? `"${a.originalText}"` : (a.translatedText ? `"${a.translatedText}"` : '');
        const shareText = `🚨 Aduan NADI: ${issueTitle}\n📍 Lokasi: ${loc}\n💬 Keterangan: ${quote}\n⚠️ Status: ${STATUS_LABEL[a.status]} (ID: #${a.id.slice(-6)})\n\nLayari NADI Civic OS untuk tindakan lanjut.`;

        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({
                    title: `Aduan: ${issueTitle}`,
                    text: shareText,
                    url: typeof window !== 'undefined' ? window.location.href : undefined
                });
                return;
            } catch {
                // User cancelled or aborted native share sheet
            }
        }

        try {
            await navigator.clipboard.writeText(shareText);
            setCopiedToast(true);
            setTimeout(() => setCopiedToast(false), 2000);
        } catch {}
    };

    const handleCopyReport = async (a: Anomaly) => {
        const issueTitle = a.title || a.aiAnalysis?.damageType || 'Aduan Warga';
        const loc = a.locationName ? `${a.locationName} (${a.lat}°, ${a.lng}°)` : `${a.lat}°, ${a.lng}°`;
        const quote = a.originalText ? `"${a.originalText}"` : (a.translatedText ? `"${a.translatedText}"` : '');
        const shareText = `🚨 Aduan NADI: ${issueTitle}\n📍 Lokasi: ${loc}\n💬 Keterangan: ${quote}\n⚠️ Status: ${STATUS_LABEL[a.status]}`;

        try {
            await navigator.clipboard.writeText(shareText);
            setCopiedToast(true);
            setTimeout(() => setCopiedToast(false), 2000);
        } catch {}
    };

    const handleDeleteReport = async (a: Anomaly) => {
        const showDeleteError = () => {
            setDeleteErrorToast(true);
            setTimeout(() => setDeleteErrorToast(false), 3500);
        };
        try {
            // 1. Delete from Supabase first (synced reports have UUID ids; local drafts don't).
            // RLS rejections return no error, just 0 rows, so confirm via the returned rows.
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a.id)) {
                const { data, error } = await supabase.from('nadi_infra_reports').delete().eq('id', a.id).select('id');
                if (error || !data?.length) {
                    console.error('Gagal memadam aduan:', error ?? 'ditolak oleh RLS');
                    showDeleteError();
                    return;
                }
            }

            // 2. Remove from local state and browser localStorage caches
            setAnomalies(prev => prev.filter(item => item.id !== a.id));
            const cacheKey = user?.id ? `nadi_local_potholes_${user.id}` : 'nadi_local_potholes';
            for (const key of [cacheKey, 'nadi_local_potholes']) {
                try {
                    const list: unknown = JSON.parse(localStorage.getItem(key) || 'null');
                    if (Array.isArray(list)) {
                        localStorage.setItem(key, JSON.stringify(list.filter((item: { id?: string }) => item.id !== a.id)));
                    }
                } catch {}
            }

            setDeletedToast(true);
            setTimeout(() => setDeletedToast(false), 2500);
        } catch (err) {
            console.error('Gagal memadam aduan:', err);
            showDeleteError();
        }
    };

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    return (
        <div className="p-5 min-h-full w-full flex flex-col relative z-0">

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
                className="mb-4 sm:mb-5"
            >
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-[#C5A367]/10 text-[#C5A367] border border-[#C5A367]/20">
                        {t('aduan.badge') || 'Sistem Sivik & Aduan Warga'}
                    </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-100 to-zinc-400">
                    {t('aduan.title') || 'Aduan Sivik'}
                </h1>
                <p className="text-xs sm:text-sm font-medium mt-1 text-zinc-400">
                    {t('aduan.subtitle') || 'NADI mendengar. Lapor apa sahaja — jalan rosak, longkang tersumbat, lampu terpadam, pokok tumbang, atau sampah.'}
                </p>
            </motion.div>

            {/* Hidden file inputs for photo attachment */}
            <input
                type="file"
                accept="image/*"
                ref={photoFileInputRef}
                className="hidden"
                onChange={handleAttachedPhotoSelect}
            />
            <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={cameraInputRef}
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
                className={`mb-6 p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-[#121217] via-[#0E0E12] to-[#0A0A0D] border transition-all shadow-[0_12px_40px_rgba(0,0,0,0.5)] relative overflow-hidden shrink-0 ${
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
                        className="w-full min-h-[96px] text-xs sm:text-sm rounded-2xl p-3.5 sm:p-4 bg-[#060608]/90 border border-zinc-800/70 text-zinc-100 placeholder-zinc-500 outline-none focus:border-[#C5A367]/60 focus:ring-1 focus:ring-[#C5A367]/20 transition-all resize-none leading-relaxed shadow-inner"
                        disabled={isParsingVoice}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                handleSendAduan();
                            }
                        }}
                    />
                </div>

                {/* REAL-TIME SMART EMERGENCY CALL BANNER */}
                <AnimatePresence>
                    {activeEmergencyProtocol && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="relative z-10 mb-3 overflow-hidden"
                        >
                            <div className={`p-4 rounded-2xl border shadow-xl ${
                                activeEmergencyProtocol.id === 'medical'
                                    ? 'bg-gradient-to-r from-red-950/90 via-red-900/40 to-red-950/90 border-red-500/50 shadow-red-950/40'
                                    : activeEmergencyProtocol.id === 'electrical'
                                    ? 'bg-gradient-to-r from-amber-950/90 via-orange-950/40 to-amber-950/90 border-orange-500/50 shadow-orange-950/40'
                                    : activeEmergencyProtocol.id === 'dengue'
                                    ? 'bg-gradient-to-r from-rose-950/90 via-red-950/40 to-rose-950/90 border-rose-500/50 shadow-rose-950/40'
                                    : 'bg-gradient-to-r from-red-950/90 via-red-900/40 to-red-950/90 border-red-500/50 shadow-red-950/40'
                            }`}>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                            {activeEmergencyProtocol.id === 'medical' && <Heart className="w-5 h-5 text-red-400 animate-pulse" />}
                                            {activeEmergencyProtocol.id === 'electrical' && <Zap className="w-5 h-5 text-amber-400 animate-bounce" />}
                                            {activeEmergencyProtocol.id === 'dengue' && <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />}
                                            {activeEmergencyProtocol.id === 'disaster' && <AlertTriangle className="w-5 h-5 text-red-400 animate-bounce" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                                                    {activeEmergencyProtocol.badgeText}
                                                </span>
                                                <span className="text-[11px] font-bold text-zinc-300">
                                                    {activeEmergencyProtocol.agencyName}
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-black text-white leading-snug">
                                                {activeEmergencyProtocol.title}
                                            </h4>
                                            <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                                                {activeEmergencyProtocol.subtitle}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Direct Call Action Buttons */}
                                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                                        <a
                                            href={activeEmergencyProtocol.primaryTel}
                                            onClick={() => { try { playAlertSound('beep'); } catch {} }}
                                            className="px-4 py-2.5 rounded-xl font-black text-xs text-white bg-red-600 hover:bg-red-500 active:scale-95 transition-all shadow-lg flex items-center gap-2 ring-2 ring-red-500/30 animate-pulse whitespace-nowrap"
                                        >
                                            <Phone className="w-3.5 h-3.5" />
                                            <span>{activeEmergencyProtocol.primaryLabel}</span>
                                        </a>

                                        {activeEmergencyProtocol.secondaryTel && (
                                            <a
                                                href={activeEmergencyProtocol.secondaryTel}
                                                onClick={() => { try { playAlertSound('beep'); } catch {} }}
                                                className="px-3.5 py-2.5 rounded-xl font-bold text-xs text-zinc-200 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 active:scale-95 transition-all flex items-center gap-1.5 whitespace-nowrap"
                                            >
                                                <Phone className="w-3.5 h-3.5 text-amber-400" />
                                                <span>{activeEmergencyProtocol.secondaryLabel}</span>
                                            </a>
                                        )}

                                        {activeEmergencyProtocol.canOpenBencana && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (onNavigateToBencana) onNavigateToBencana();
                                                    else window.location.href = '/?tab=bencana';
                                                }}
                                                className="px-3.5 py-2.5 rounded-xl font-bold text-xs text-white bg-red-700/80 hover:bg-red-600 border border-red-500/40 active:scale-95 transition-all flex items-center gap-1 whitespace-nowrap"
                                            >
                                                <span>Buka Bencana</span>
                                                <span>➔</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Safety Protocol Quick Checklist */}
                                <div className="pt-2.5 border-t border-white/10 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-300">
                                    <span className="font-bold text-white flex items-center gap-1">
                                        ⚠️ Tindakan Segera:
                                    </span>
                                    {activeEmergencyProtocol.instructions.map((inst, idx) => (
                                        <span key={idx} className="flex items-center gap-1">
                                            <span className="text-red-400 font-bold">•</span> {inst}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Bottom Tools Row */}
                <div className="relative z-10 flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-zinc-800/50">
                    {/* Location Badge / Trigger & Error Feedback */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={handleGetGps}
                            disabled={isGettingGps}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                                userGpsLocation
                                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                                    : gpsErrorMessage
                                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                                    : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                            }`}
                            title={userGpsLocation ? `Lokasi dikesan: ${userGpsLocation.label} (${userGpsLocation.lat}°, ${userGpsLocation.lng}°)` : "Kesan Lokasi GPS Peranti"}
                        >
                            {isGettingGps ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                            ) : gpsErrorMessage ? (
                                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                            ) : (
                                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                            )}
                            <span className="truncate max-w-[190px] sm:max-w-[280px]">
                                {userGpsLocation 
                                    ? `📍 ${userGpsLocation.label}` 
                                    : isGettingGps 
                                    ? 'Mengesan GPS...' 
                                    : 'Guna Lokasi Saya!'}
                            </span>
                        </button>
                        {userGpsLocation && (
                            <button
                                type="button"
                                onClick={() => {
                                    setUserGpsLocation(null);
                                    playAlertSound('beep');
                                }}
                                className="text-zinc-500 hover:text-zinc-300 text-xs px-1"
                                title="Reset Lokasi"
                            >
                                ✕
                            </button>
                        )}

                        {/* GPS Error Feedback Banner */}
                        <AnimatePresence>
                            {gpsErrorMessage && (
                                <motion.div
                                    initial={{ opacity: 0, x: -6, scale: 0.96 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: -6, scale: 0.96 }}
                                    className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-red-950/90 border border-red-500/40 text-red-200 flex items-center gap-2 shadow-lg backdrop-blur-md"
                                >
                                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                    <span>{gpsErrorMessage}</span>
                                    <button
                                        type="button"
                                        onClick={() => setGpsErrorMessage(null)}
                                        className="text-zinc-400 hover:text-white px-0.5 text-xs"
                                        title="Tutup amaran"
                                    >
                                        ✕
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Tools & Send Button */}
                    <div className="flex items-center gap-2">
                        {/* Media Attachment Action Hub (+ button rotating to X) */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMediaMenuOpen(!isMediaMenuOpen);
                                    try { playAlertSound('beep'); } catch {}
                                }}
                                className={`p-2.5 rounded-xl border transition-all text-xs font-bold flex items-center justify-center shrink-0 active:scale-95 ${
                                    isMediaMenuOpen
                                        ? 'bg-zinc-800 border-[#C5A367] text-[#C5A367] ring-2 ring-[#C5A367]/30 shadow-lg'
                                        : attachedPhotoBase64
                                        ? 'bg-[#C5A367]/20 border-[#C5A367] text-[#C5A367]'
                                        : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                                }`}
                                title={isMediaMenuOpen ? "Tutup Pilihan Foto" : "Tambah Foto (Kamera / Galeri)"}
                            >
                                <motion.div
                                    animate={{ rotate: isMediaMenuOpen ? 45 : 0 }}
                                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                                    className="flex items-center justify-center"
                                >
                                    <Plus className="w-4 h-4" />
                                </motion.div>
                            </button>

                            {/* Floating 2-choice Menu: Kamera & Galeri */}
                            <AnimatePresence>
                                {isMediaMenuOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-30"
                                            onClick={() => setIsMediaMenuOpen(false)}
                                        />
                                        <motion.div
                                            initial={{ opacity: 0, y: 8, scale: 0.92 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 8, scale: 0.92 }}
                                            transition={{ duration: 0.18, ease: 'easeOut' }}
                                            className="absolute bottom-full mb-2.5 right-0 flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#0E0E13]/95 border border-zinc-700/80 shadow-[0_12px_32px_rgba(0,0,0,0.65)] backdrop-blur-xl z-40 whitespace-nowrap"
                                        >
                                            <button
                                                type="button"
                                                onClick={handleTriggerCamera}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900/90 hover:bg-emerald-500/15 border border-zinc-800/80 hover:border-emerald-500/40 text-zinc-200 hover:text-emerald-300 transition-all text-xs font-semibold active:scale-95 shadow-sm group"
                                                title="Ambil gambar menggunakan kamera"
                                            >
                                                <Camera className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                                                <span>Kamera</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleTriggerGallery}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900/90 hover:bg-sky-500/15 border border-zinc-800/80 hover:border-sky-500/40 text-zinc-200 hover:text-sky-300 transition-all text-xs font-semibold active:scale-95 shadow-sm group"
                                                title="Muat naik gambar daripada galeri"
                                            >
                                                <ImageIcon className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
                                                <span>Galeri</span>
                                            </button>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Speech Mic */}
                        <GlobalVoiceMic
                            currentText={manualDescription}
                            onTranscript={(text) => handleDescriptionChange(text)}
                            size="md"
                        />

                        {/* Primary Submit Button */}
                        <button
                            onClick={() => handleSendAduan(false)}
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
                className="bg-gradient-to-r from-[#0F0F14] via-[#121218] to-[#0F0F14] border border-zinc-800/80 backdrop-blur-xl rounded-2xl p-4 sm:p-5 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-xl shrink-0"
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
                                Disahkan Pegawai
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
                            <span className="text-xl font-bold text-[#C5A367] font-mono">{totalResolved}</span>
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
                                                isConfirmed(a.status)
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
                                                    <span className="text-[10px] font-mono text-zinc-300 font-medium bg-zinc-900/90 px-2.5 py-0.5 rounded-md border border-zinc-800 flex items-center gap-1.5 shadow-sm">
                                                        <Clock className="w-3 h-3 text-[#C5A367]" />
                                                        <span className="font-semibold text-white">{formatReportRelative(a.createdAt || a.time, true, 'Baru sahaja')}</span>
                                                        {a.createdAt && (
                                                            <>
                                                                <span className="text-zinc-600">•</span>
                                                                <span className="text-zinc-400">{formatReportExact(a.createdAt, true)}</span>
                                                            </>
                                                        )}
                                                    </span>
                                                </div>
                                                <h4 className="font-sans text-base font-bold text-white leading-snug mt-1">
                                                    {a.title || (a.aiAnalysis?.damageType ? `${a.aiAnalysis.damageType} @ ${a.locationName || 'Lokasi Kejadian'}` : `Laporan @ ${typeof a.lat === 'number' ? a.lat.toFixed(4) : a.lat}°, ${typeof a.lng === 'number' ? a.lng.toFixed(4) : a.lng}°`)}
                                                </h4>
                                            </div>
                                        </div>

                                        {/* Status Pill */}
                                        <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border shadow-sm ${
                                            isConfirmed(a.status)
                                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                : 'bg-zinc-800/80 text-zinc-400 border-zinc-700'
                                        }`}>
                                            {isConfirmed(a.status) ? `✓ ${STATUS_LABEL[a.status]}` : STATUS_LABEL[a.status]}
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
                                                                    setAnomalies(prev => {
                                                                        const updated = prev.map(x => x.id === a.id ? { ...x, feedbackGiven: 'up' as const } : x);
                                                                        persistAnomaliesAndFeedback(updated, a.id, {
                                                                            feedbackGiven: 'up',
                                                                            originalText: a.originalText || a.title || ''
                                                                        });
                                                                        return updated;
                                                                    });
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
                                        <div className="flex items-center gap-2 relative">
                                            {/* Direct Share Button */}
                                            <button
                                                onClick={() => handleShareReport(a)}
                                                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-all active:scale-95"
                                                title="Kongsi Aduan Ini"
                                            >
                                                <Share2 className="w-3.5 h-3.5" /> Kongsi
                                            </button>

                                            {/* Action Menu (...) with Export PDF & Copy */}
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveMenuReportId(activeMenuReportId === a.id ? null : a.id);
                                                    }}
                                                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-zinc-800/70 border border-zinc-700/60 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all active:scale-95"
                                                    title="Tindakan Tambahan"
                                                >
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </button>

                                                {activeMenuReportId === a.id && (
                                                    <>
                                                        <div
                                                            className="fixed inset-0 z-40"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveMenuReportId(null);
                                                            }}
                                                        />
                                                        <div className="absolute left-0 bottom-full mb-2 w-48 bg-[#121217] border border-zinc-800 rounded-2xl shadow-2xl p-1.5 z-50 text-left animate-in fade-in slide-in-from-bottom-2 duration-150">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    generateAduanPdf(a);
                                                                    setActiveMenuReportId(null);
                                                                }}
                                                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-xl transition-colors"
                                                            >
                                                                <FileText className="w-3.5 h-3.5 text-purple-400" />
                                                                <span>Export PDF (PBT)</span>
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCopyReport(a);
                                                                    setActiveMenuReportId(null);
                                                                }}
                                                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-xl transition-colors"
                                                            >
                                                                <Copy className="w-3.5 h-3.5 text-emerald-400" />
                                                                <span>Salin Butiran</span>
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteReport(a);
                                                                    setActiveMenuReportId(null);
                                                                }}
                                                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors border-t border-zinc-800/60 mt-1 pt-2"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                                                <span>Padam Aduan</span>
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {a.aiAnalysis && (
                                            <button
                                                onClick={() => setAnomalies(prev => prev.map(x => x.id === a.id ? { ...x, expanded: !x.expanded } : x))}
                                                className="p-2 text-zinc-400 hover:text-white transition-colors"
                                                title={a.expanded ? 'Tutup Perincian' : 'Buka Perincian'}
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

                {/* View Footer */}
                <div className="mt-auto pt-8 text-center pb-2 text-[10px] text-zinc-600 font-medium">
                    <span>NADI SIVIK • PLATFORM KOMUNITI & RESPONS BENCANA</span>
                </div>
            </div>

            {/* ================================================================= */}
            {/* 7. COPIED TOAST NOTIFICATION                                      */}
            {/* ================================================================= */}
            {mounted && typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {copiedToast && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[999999] bg-emerald-500 text-black px-5 py-2.5 rounded-2xl font-bold text-xs shadow-2xl flex items-center gap-2 border border-emerald-400/50 backdrop-blur-md"
                        >
                            <Check className="w-4 h-4 text-black" /> Butiran aduan berjaya disalin ke papan keratan!
                        </motion.div>
                    )}
                    {deletedToast && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[999999] bg-rose-600 text-white px-5 py-2.5 rounded-2xl font-bold text-xs shadow-2xl flex items-center gap-2 border border-rose-400/40 backdrop-blur-md"
                        >
                            <Trash2 className="w-4 h-4 text-white" /> Rekod aduan telah berjaya dipadam!
                        </motion.div>
                    )}
                    {deleteErrorToast && (
                        <motion.div
                            role="alert"
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[999999] bg-zinc-900 text-rose-300 px-5 py-2.5 rounded-2xl font-bold text-xs shadow-2xl flex items-center gap-2 border border-rose-500/50 backdrop-blur-md"
                        >
                            <AlertTriangle className="w-4 h-4 text-rose-400" /> Gagal memadam aduan — tiada kebenaran atau ralat rangkaian.
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* ================================================================= */}
            {/* 8. DIALECT AI FEEDBACK LOOP MODAL                                 */}
            {/* ================================================================= */}
            {mounted && typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {feedbackModalAnomaly && (
                        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
                                        onClick={() => {
                                            setFeedbackModalAnomaly(null);
                                            setFeedbackCorrectText('');
                                        }}
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
                </AnimatePresence>,
                document.body
            )}

            {/* ================================================================= */}
            {/* 9. EMERGENCY INTERCEPT MODAL: LIFE-SAFETY PHONE CALL GATEWAY      */}
            {/* ================================================================= */}
            {mounted && typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {interceptEmergency && (
                        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="w-full max-w-lg rounded-3xl bg-[#111116] border border-red-500/50 p-6 shadow-[0_0_60px_rgba(239,68,68,0.3)] relative overflow-hidden text-white"
                            >
                                {/* Glow Background */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 blur-3xl pointer-events-none rounded-full" />

                                {/* Header */}
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-14 h-14 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 shrink-0 shadow-inner">
                                        <Phone className="w-7 h-7 animate-pulse" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-red-600 text-white shadow-sm">
                                            {interceptEmergency.badgeText}
                                        </span>
                                        <h3 className="text-xl font-extrabold text-white mt-1 leading-snug">
                                            {interceptEmergency.title}
                                        </h3>
                                        <p className="text-xs text-zinc-400">
                                            {interceptEmergency.agencyName}
                                        </p>
                                    </div>
                                </div>

                                {/* Warning message */}
                                <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/30 mb-5">
                                    <p className="text-xs sm:text-sm text-red-200 leading-relaxed font-medium">
                                        ⚠️ <strong>PENTING:</strong> Aduan awam melalui aplikasi NADI memerlukan masa pemprosesan pegawai bertugas dan <strong>BUKAN saluran respons kecemasan segera</strong>.
                                    </p>
                                    <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
                                        Situasi ini memerlukan bantuan penyelamat atau tindakan teknikal serta-merta. Sila <strong>hubungi nombor kecemasan sekarang</strong> sebelum menunggu laporan diproses.
                                    </p>
                                </div>

                                {/* Safety instructions */}
                                <div className="mb-5 space-y-1.5 text-xs text-zinc-300 bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800">
                                    <p className="font-bold text-white text-[11px] uppercase tracking-wider mb-1">
                                        Langkah Keselamatan Segera:
                                    </p>
                                    {interceptEmergency.instructions.map((step, idx) => (
                                        <p key={idx} className="flex items-start gap-2">
                                            <span className="text-red-400 font-bold">✓</span>
                                            <span>{step}</span>
                                        </p>
                                    ))}
                                </div>

                                {/* Direct Calling Buttons */}
                                <div className="space-y-2.5 mb-4">
                                    <a
                                        href={interceptEmergency.primaryTel}
                                        onClick={() => setInterceptEmergency(null)}
                                        className="w-full py-3.5 px-5 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_8px_25px_rgba(239,68,68,0.35)] ring-2 ring-red-500/40 animate-pulse"
                                    >
                                        <Phone className="w-5 h-5" />
                                        <span>HUBUNGI SEGERA: {interceptEmergency.primaryPhone} ({interceptEmergency.primaryLabel})</span>
                                    </a>

                                    {interceptEmergency.secondaryTel && (
                                        <a
                                            href={interceptEmergency.secondaryTel}
                                            onClick={() => setInterceptEmergency(null)}
                                            className="w-full py-3 px-5 rounded-2xl font-bold text-xs text-zinc-100 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Phone className="w-4 h-4 text-amber-400" />
                                            <span>HUBUNGI TALIAN KEDUA: {interceptEmergency.secondaryPhone} ({interceptEmergency.secondaryLabel})</span>
                                        </a>
                                    )}
                                </div>

                                {/* Secondary Actions */}
                                <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-800/80">
                                    <button
                                        type="button"
                                        onClick={() => setInterceptEmergency(null)}
                                        className="text-xs text-zinc-400 hover:text-white transition-colors"
                                    >
                                        Tutup & Buat Panggilan
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setInterceptEmergency(null);
                                            handleSendAduan(true);
                                        }}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-[#C5A367] bg-[#C5A367]/10 hover:bg-[#C5A367]/20 border border-[#C5A367]/30 transition-all active:scale-95"
                                    >
                                        Simpan Rekod Aduan Sahaja ➔
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* ================================================================= */}
            {/* 10. LIVE CAMERA VIEWFINDER MODAL (ON-THE-SPOT PHOTO CAPTURE)       */}
            {/* ================================================================= */}
            {mounted && typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {isLiveCameraOpen && (
                        <div className="fixed inset-0 z-[999998] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.94, y: 16 }}
                                transition={{ duration: 0.22 }}
                                className="relative w-full max-w-lg bg-[#0D0D12] border border-zinc-700/80 rounded-3xl overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.85)] flex flex-col"
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-950/60">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                            <Camera className="w-4 h-4 text-emerald-400" />
                                            Kamera Langsung (Live Camera)
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={stopLiveCamera}
                                        className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                                        title="Tutup Kamera"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Viewfinder / Video Stream */}
                                <div className="relative aspect-[4/3] bg-black overflow-hidden flex items-center justify-center">
                                    <video
                                        ref={liveCameraVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover"
                                    />

                                    {/* Viewfinder Target Reticles */}
                                    <div className="absolute inset-8 pointer-events-none border border-white/20 rounded-2xl flex items-center justify-center">
                                        {/* Corner markings */}
                                        <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
                                        <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
                                        <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />
                                        
                                        {/* Center Crosshair */}
                                        <div className="w-8 h-0.5 bg-emerald-400/60" />
                                        <div className="h-8 w-0.5 bg-emerald-400/60 absolute" />
                                    </div>

                                    {/* Status Badge */}
                                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-medium text-emerald-300 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        Sedia Tangkap Gambar
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="p-4 bg-zinc-950/90 border-t border-zinc-800/80 flex items-center justify-between gap-4">
                                    <button
                                        type="button"
                                        onClick={stopLiveCamera}
                                        className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-all active:scale-95 cursor-pointer"
                                    >
                                        Batal
                                    </button>

                                    {/* Shutter Button */}
                                    <button
                                        type="button"
                                        onClick={snapLivePhoto}
                                        className="group flex items-center gap-2.5 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold text-xs shadow-[0_4px_20px_rgba(16,185,129,0.35)] transition-all active:scale-95 cursor-pointer"
                                    >
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-black group-hover:scale-110 transition-transform" />
                                        <span>Tangkap Gambar</span>
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
