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
    ThumbsUp,
    ThumbsDown,
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
import { fileToJpegDataUrl, toJpegDataUrl } from '@/src/lib/image';
import { formatReportRelative, formatReportExact } from '@/src/lib/format';

// Civic Complaint Categories & Local Agency Routing
export type CivicCategory = 'jalan' | 'saliran' | 'lampu' | 'sampah' | 'pokok' | 'kemudahan' | 'lain';

export interface CivicCategoryConfig {
    id: CivicCategory;
    label: string;
    image: string;
    keywords: string[];
    suggestedAgency: string; // Automatic agency routing: JKR, JPS, TNB, Alam Flora, Landskap, PBT
}

export const CIVIC_CATEGORIES: CivicCategoryConfig[] = [
    {
        id: 'jalan',
        label: 'Jalan & Lubang',
        image: '/images/aduan/pothole.png',
        keywords: ['jalan', 'lubang', 'berlubang', 'tar', 'pothole', 'pecah', 'lerek', 'kelebok', 'perok', 'retak', 'bonggol', 'mendap', 'lekuk', 'lopak', 'turap'],
        suggestedAgency: 'JKR / PBT'
    },
    {
        id: 'saliran',
        label: 'Longkang & Saliran',
        image: '/images/aduan/flood.png',
        keywords: ['longkang', 'parit', 'saliran', 'tersumbat', 'melimpah', 'parit busuk', 'air bertakung', 'takung', 'lumpur', 'culvert', 'kotoran parit', 'tali air', 'parit pecah', 'jentik-jentik', 'pembiakan aedes', 'takungan nyamuk'],
        suggestedAgency: 'JPS / PBT'
    },
    {
        id: 'lampu',
        label: 'Lampu & Elektrik',
        image: '/images/aduan/electricity.png',
        keywords: ['lampu', 'tiang', 'gelap', 'padam', 'mentol', 'wayar', 'kabel', 'elektrik', 'tnb', 'putus', 'terpadam', 'lampu jalan', 'fius', 'tiang condong'],
        suggestedAgency: 'TNB / PBT'
    },
    {
        id: 'sampah',
        label: 'Sampah & Pembuangan',
        image: '/images/aduan/garbage.png',
        keywords: ['sampah', 'bau', 'longgokan', 'busuk', 'kotor', 'sisa', 'pembuangan', 'haram', 'bangkai', 'lalat', 'timbunan', 'pungutan', 'tong sampah', 'tong penuh'],
        suggestedAgency: 'Alam Flora / PBT'
    },
    {
        id: 'pokok',
        label: 'Pokok & Landskap',
        image: '/images/aduan/treeNew.png',
        keywords: ['pokok', 'dahan', 'tumbang', 'reput', 'rumput', 'semak', 'ranting', 'lalang', 'dahan patah', 'pokok condong', 'cantasan', 'hutan kecil', 'semak samun', 'pokok mati'],
        suggestedAgency: 'Jabatan Landskap / PBT'
    },
    {
        id: 'kemudahan',
        label: 'Kemudahan Awam',
        image: '/images/aduan/infrastructure.png',
        keywords: ['perhentian bas', 'bus stop', 'taman permainan', 'pagar', 'tandas', 'papan tanda', 'signboard', 'jejantas', 'benches', 'kerusi awam', 'balairaya', 'kemudahan', 'pagar rosak', 'taman awam'],
        suggestedAgency: 'PBT'
    },
    {
        id: 'lain',
        label: 'Lain-lain',
        image: '/images/aduan/checklist.png',
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
            subtitle: 'Situasi perubatan akut mengancam nyawa. Jangan tunggu aduan sivik: hubungi Ambulans 999 sekarang juga!',
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

// Named columns only: device_fingerprint and speed_kmh are not client-readable (migration 019)
const INFRA_FEED_COLUMNS = 'id, user_id, lat, lng, z_dropped, verifications, status, created_at, title, ai_analysis, photo_url, confidence_score, snapshot_base64';

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
                    fileToJpegDataUrl(blob).then(setAttachedPhotoBase64).catch(() => {});
                    e.preventDefault();
                    break;
                }
            }
        }
    };

    const handleAttachedPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            fileToJpegDataUrl(file).then(dataUrl => {
                setAttachedPhotoBase64(dataUrl);
                try { playAlertSound('success'); } catch {}
            }).catch(() => {});
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
            setAttachedPhotoBase64(toJpegDataUrl(video, video.videoWidth || 1280, video.videoHeight || 720));
            try { playAlertSound('success'); } catch {}
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
            fileToJpegDataUrl(file).then(setAttachedPhotoBase64).catch(() => {});
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
                    headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}) },
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
            : ((resData?.urgency || (visionAnalysis?.visualSeverity >= 4 ? 'High' : clientUrgency)) as 'Low' | 'Medium' | 'High');

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
                severityScore: visionAnalysis.visualSeverity || (urgency === 'High' ? 4 : 3),
                severityLabel: visionAnalysis.damageType || `Aduan ${catConfig?.label}`,
                damageType: visionAnalysis.damageType || intent,
                estimatedWidth: visionAnalysis.estimatedDiameterCm ? `~${visionAnalysis.estimatedDiameterCm} cm` : '—',
                estimatedDepth: visionAnalysis.estimatedDepthCm ? `~${visionAnalysis.estimatedDepthCm} cm` : '—',
                repairMethod: visionAnalysis.repairRecommendation || (isVectorOrHealth ? 'Pemeriksaan Tapak & Semburan Fogging' : 'Penilaian & Tindakan PBT'),
                repairCostMYR: 'Mengikut Skop Kerosakan',
                priorityScore: visionAnalysis.priorityScore || (isVectorOrHealth ? 95 : 75),
                riskAssessment: visionAnalysis.description || intendedMeaning,
                nearestRoadType: locName,
                recommendedAction: visionAnalysis.repairRecommendation || (isVectorOrHealth ? 'Kawalan Vektor & Hapus Tempat Pembiakan' : 'Penugasan Skuad Tindakan Tapak'),
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
                headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}) },
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

        supabase.from('nadi_infra_reports').select(INFRA_FEED_COLUMNS).neq('status', 'rejected').order('created_at', { ascending: false }).limit(100)
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
                        speedKmh: 0, // speed_kmh is not readable by clients (migration 019)
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
                            speedKmh: 0, // speed_kmh is not readable by clients (migration 019)
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
        <div className="p-5 min-h-full w-full max-w-3xl mx-auto flex flex-col relative z-0">

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
                                transition={{ duration: 0.22 }}
                                className="fixed inset-0 z-[9999999] pointer-events-none"
                            >
                                <div className="absolute top-0 left-0 right-0 px-4 pt-safe pb-3 flex items-center justify-between gap-3 pointer-events-auto bg-overlay text-overlay-ink border-b border-overlay-rule">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-pill bg-danger" />
                                        <span className="text-sm font-semibold">Mod pemanduan (AR HUD)</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleToggleDashcam}
                                        aria-label="Tutup mod pemanduan"
                                        className="icon-btn text-overlay-ink hover:bg-overlay-rule hover:text-overlay-ink"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 px-4 pt-3 pb-safe bg-overlay text-overlay-ink border-t border-overlay-rule">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Shield className="w-4 h-4" />
                                        <span className="text-sm font-semibold">Mod privasi aktif</span>
                                    </div>
                                    <p className="max-w-lg text-sm text-overlay-muted">
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
            <div className="mb-6">
                <h2 className="text-2xl">
                    {t('aduan.title') || 'Aduan Sivik'}
                </h2>
                <p className="mt-2 text-md text-ink-2">
                    {t('aduan.subtitle') || 'NADI mendengar. Lapor apa sahaja: jalan rosak, longkang tersumbat, lampu terpadam, pokok tumbang, atau sampah.'}
                </p>
            </div>

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
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onPaste={handlePaste}
                className={`well mb-8 p-4 sm:p-5 shrink-0 ${isDragging ? 'border-accent' : ''}`}
            >
                {/* 7 Citizen-Eye Category Chips */}
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="mr-1 flex items-center gap-1 text-sm text-muted">
                        <Compass className="w-4 h-4" /> Kategori:
                    </span>
                    {CIVIC_CATEGORIES.map(cat => {
                        const isSelected = selectedCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => {
                                    setSelectedCategory(cat.id);
                                    setHasManuallySelectedCategory(true);
                                }}
                                className={`tag ${isSelected ? 'tag--on' : ''}`}
                            >
                                {cat.label}
                            </button>
                        );
                    })}
                </div>

                {/* Attached Photo Preview */}
                {attachedPhotoBase64 && (
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <img src={attachedPhotoBase64} alt="Lampiran Gambar" className="w-12 h-12 shrink-0 object-cover rounded-card" />
                            <div className="min-w-0">
                                <p className="flex items-center gap-1 text-sm font-semibold">
                                    <ImageIcon className="w-4 h-4" /> Foto Dilampirkan
                                </p>
                                <p className="text-sm text-muted">Analisis AI Vision akan diproses semasa hantar</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setAttachedPhotoBase64(null)}
                            className="icon-btn"
                            aria-label="Padam Foto"
                            title="Padam Foto"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Input Field */}
                <textarea
                    rows={2}
                    value={manualDescription}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    placeholder="Taip atau cakap aduan anda di sini…"
                    aria-label="Keterangan aduan"
                    className="field"
                    disabled={isParsingVoice}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            handleSendAduan();
                        }
                    }}
                />

                {/* REAL-TIME SMART EMERGENCY CALL BANNER */}
                {activeEmergencyProtocol && (
                    <div role="alert" className="mt-4 flex flex-col gap-4 p-4 rounded-control bg-danger-soft text-danger-soft-ink">
                        <div className="flex items-start gap-3">
                            {activeEmergencyProtocol.id === 'medical' && <Heart className="w-5 h-5 shrink-0 mt-0.5" />}
                            {activeEmergencyProtocol.id === 'electrical' && <Zap className="w-5 h-5 shrink-0 mt-0.5" />}
                            {activeEmergencyProtocol.id === 'dengue' && <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />}
                            {activeEmergencyProtocol.id === 'disaster' && <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
                            <div className="flex min-w-0 flex-col gap-1">
                                <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                                    <span className="font-semibold">{activeEmergencyProtocol.badgeText}</span>
                                    <span>{activeEmergencyProtocol.agencyName}</span>
                                </p>
                                <h3 className="text-lg">
                                    {activeEmergencyProtocol.title}
                                </h3>
                                <p className="text-md">
                                    {activeEmergencyProtocol.subtitle}
                                </p>
                            </div>
                        </div>

                        {/* Direct Call Action Buttons */}
                        <div className="flex flex-wrap gap-2">
                            <a
                                href={activeEmergencyProtocol.primaryTel}
                                onClick={() => { try { playAlertSound('beep'); } catch {} }}
                                className="btn btn--danger"
                            >
                                <Phone className="w-4 h-4" />
                                <span>{activeEmergencyProtocol.primaryLabel}</span>
                            </a>

                            {activeEmergencyProtocol.secondaryTel && (
                                <a
                                    href={activeEmergencyProtocol.secondaryTel}
                                    onClick={() => { try { playAlertSound('beep'); } catch {} }}
                                    className="btn"
                                >
                                    <Phone className="w-4 h-4" />
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
                                    className="btn"
                                >
                                    Buka Bencana
                                </button>
                            )}
                        </div>

                        {/* Safety Protocol Quick Checklist */}
                        <div>
                            <p className="flex items-center gap-1 text-sm font-semibold">
                                <AlertTriangle className="w-4 h-4" /> Tindakan Segera:
                            </p>
                            <ul className="mt-2 flex flex-col gap-1 text-md">
                                {activeEmergencyProtocol.instructions.map((inst, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                        <Check className="w-4 h-4 shrink-0 mt-1" />
                                        <span>{inst}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* Bottom Tools Row */}
                <div className="mt-4 pt-4 border-t border-rule flex flex-wrap items-center justify-between gap-3">
                    {/* Location Tag / Trigger & Error Feedback */}
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleGetGps}
                            disabled={isGettingGps}
                            className={`tag ${userGpsLocation ? 'tag--in' : ''}`}
                            title={userGpsLocation ? `Lokasi dikesan: ${userGpsLocation.label} (${userGpsLocation.lat}°, ${userGpsLocation.lng}°)` : "Kesan Lokasi GPS Peranti"}
                        >
                            {isGettingGps ? (
                                <Loader2 className="w-4 h-4 animate-spin keep-motion" />
                            ) : gpsErrorMessage ? (
                                <AlertCircle className="w-4 h-4" />
                            ) : (
                                <MapPin className="w-4 h-4" />
                            )}
                            <span className="truncate max-w-48 sm:max-w-72">
                                {userGpsLocation
                                    ? userGpsLocation.label
                                    : isGettingGps
                                    ? 'Mengesan GPS…'
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
                                className="icon-btn"
                                aria-label="Reset Lokasi"
                                title="Reset Lokasi"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}

                        {/* GPS Error Feedback */}
                        {gpsErrorMessage && (
                            <p role="alert" className="flex items-center gap-1 text-sm text-danger">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{gpsErrorMessage}</span>
                                <button
                                    type="button"
                                    onClick={() => setGpsErrorMessage(null)}
                                    className="icon-btn"
                                    aria-label="Tutup amaran"
                                    title="Tutup amaran"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </p>
                        )}
                    </div>

                    {/* Tools & Send Button */}
                    <div className="flex items-center gap-2">
                        {/* Media Attachment Action Hub */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsMediaMenuOpen(!isMediaMenuOpen);
                                    try { playAlertSound('beep'); } catch {}
                                }}
                                className="icon-btn"
                                aria-expanded={isMediaMenuOpen}
                                aria-label={isMediaMenuOpen ? "Tutup Pilihan Foto" : "Tambah Foto (Kamera / Galeri)"}
                                title={isMediaMenuOpen ? "Tutup Pilihan Foto" : "Tambah Foto (Kamera / Galeri)"}
                            >
                                {isMediaMenuOpen ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
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
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.22 }}
                                            className="absolute bottom-full right-0 mb-2 z-40 flex gap-1 p-1 bg-paper border border-rule shadow-card rounded-card"
                                        >
                                            <button
                                                type="button"
                                                onClick={handleTriggerCamera}
                                                className="btn btn--quiet"
                                                title="Ambil gambar menggunakan kamera"
                                            >
                                                <Camera className="w-4 h-4" />
                                                <span>Kamera</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleTriggerGallery}
                                                className="btn btn--quiet"
                                                title="Muat naik gambar daripada galeri"
                                            >
                                                <ImageIcon className="w-4 h-4" />
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
                            type="button"
                            onClick={() => handleSendAduan(false)}
                            disabled={(!manualDescription.trim() && !attachedPhotoBase64) || isParsingVoice}
                            className="btn btn--primary shrink-0 whitespace-nowrap"
                        >
                            {isParsingVoice ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin keep-motion" /> Proses AI…
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" /> Hantar Aduan
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* ================================================================= */}
            {/* 3. CIVIC OUTCOME METRICS                                          */}
            {/* ================================================================= */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <dl className="grid grid-cols-3 divide-x divide-rule">
                    <div className="flex flex-col justify-between pr-4 sm:pr-6">
                        <dt className="text-sm text-muted">Aduan Diterima</dt>
                        <dd className="figure mt-1">{totalReports}</dd>
                    </div>
                    <div className="flex flex-col justify-between px-4 sm:px-6">
                        <dt className="text-sm text-muted">Disahkan Pegawai</dt>
                        <dd className="figure mt-1">{totalVerified}</dd>
                    </div>
                    <div className="flex flex-col justify-between pl-4 sm:pl-6">
                        <dt className="text-sm text-muted">Selesai & Tindakan</dt>
                        <dd className="figure mt-1 text-accent">{totalResolved}</dd>
                    </div>
                </dl>

                {/* Mod Pemanduan Button */}
                <button
                    type="button"
                    onClick={handleToggleDashcam}
                    aria-pressed={dashcam.isDashcamEnabled}
                    className="btn self-start sm:self-auto"
                >
                    <Video className="w-4 h-4" />
                    <span>Mod Pemanduan</span>
                    <span className="tag">Beta</span>
                </button>
            </div>

            {/* Motion or Dashcam Errors */}
            {detector.motionError && (
                <div role="alert" className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-danger">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{detector.motionError}</span>
                    <button
                        type="button"
                        onClick={() => detector.startDriving()}
                        className="btn btn--sm"
                    >
                        Aktifkan Sensor
                    </button>
                </div>
            )}

            {/* ================================================================= */}
            {/* 4. FEED FILTERS WITH 7 CITIZEN CATEGORIES                          */}
            {/* ================================================================= */}
            <div className="flex-1 pb-10">
                <div className="mb-4 flex flex-col gap-3">
                    <h3 className="text-lg">Senarai Aduan Kawasan</h3>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setFilter('all')}
                            aria-pressed={filter === 'all'}
                            className={`tag ${filter === 'all' ? 'tag--on' : ''}`}
                        >
                            Semua
                        </button>
                        {CIVIC_CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setFilter(cat.id)}
                                aria-pressed={filter === cat.id}
                                className={`tag capitalize ${filter === cat.id ? 'tag--on' : ''}`}
                            >
                                {cat.id}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setFilter('verified')}
                            aria-pressed={filter === 'verified'}
                            className={`tag ${filter === 'verified' ? 'tag--on' : ''}`}
                        >
                            <Check className="w-3.5 h-3.5" /> Disahkan
                        </button>
                    </div>
                </div>

                {/* ================================================================= */}
                {/* 5. REPORT FEED                                                    */}
                {/* ================================================================= */}
                <ul className="ruled">
                    {filteredAnomalies.map((a) => {
                        const cat = resolveCategory(a);
                        const catConfig = CIVIC_CATEGORIES.find(c => c.id === cat) || CIVIC_CATEGORIES[0];

                        return (
                            <li key={a.id} className="flex flex-col gap-3 py-5">
                                {/* Head line: category, then status */}
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-semibold text-ink-2">{catConfig.label}</span>
                                    <span className={`tag ${a.status === 'resolved' ? 'tag--in' : a.status === 'verified' ? '' : 'tag--out'}`}>
                                        {isConfirmed(a.status) && <Check className="w-3.5 h-3.5" />}
                                        {STATUS_LABEL[a.status]}
                                    </span>
                                </div>

                                <h4 className="text-md font-semibold">
                                    {a.title || (a.aiAnalysis?.damageType ? `${a.aiAnalysis.damageType} @ ${a.locationName || 'Lokasi Kejadian'}` : `Laporan @ ${typeof a.lat === 'number' ? a.lat.toFixed(4) : a.lat}°, ${typeof a.lng === 'number' ? a.lng.toFixed(4) : a.lng}°`)}
                                </h4>

                                {/* Metadata */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                                    <span className="inline-flex items-center gap-1">
                                        <Building2 className="w-4 h-4" />
                                        Agensi: {a.suggestedAgency || a.aiAnalysis?.routingAgency || catConfig.suggestedAgency}
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                        <Clock className="w-4 h-4" />
                                        {formatReportRelative(a.createdAt || a.time, true, 'Baru sahaja')}
                                    </span>
                                    {a.createdAt && (
                                        <span>{formatReportExact(a.createdAt, true)}</span>
                                    )}
                                    {a.source === 'voice' ? (
                                        <span className="inline-flex items-center gap-1">
                                            <Mic className="w-4 h-4" /> Input Suara
                                        </span>
                                    ) : a.photoBase64 ? (
                                        <span className="inline-flex items-center gap-1">
                                            <ImageIcon className="w-4 h-4" /> Bukti Bergambar
                                        </span>
                                    ) : (
                                        <span>Laporan Teks</span>
                                    )}
                                    {a.urgency && (
                                        <span className={a.urgency === 'High' ? 'tag tag--warn' : undefined}>
                                            Keutamaan: {a.urgency === 'High' ? 'Tinggi' : a.urgency === 'Medium' ? 'Sederhana' : 'Biasa'}
                                        </span>
                                    )}
                                    {a.confidenceScore != null && a.confidenceScore > 0 && (
                                        <span className="inline-flex items-center gap-1">
                                            <Shield className="w-4 h-4" />Keyakinan AI {a.confidenceScore}%
                                        </span>
                                    )}
                                    {a.detectedDialect && (
                                        <span>
                                            Dialek <span className="capitalize">{a.detectedDialect}</span>
                                        </span>
                                    )}
                                </div>

                                {/* Speech & Dialect Area */}
                                {a.originalText && (
                                    <div className="well flex flex-col gap-4 p-4">
                                        <div>
                                            <div className="mb-1 flex items-center justify-between gap-2">
                                                <span className="text-sm text-muted">Keterangan Warga</span>
                                                <button
                                                    type="button"
                                                    onClick={() => speakDialect(a.userIntendedMeaning || a.originalText || '')}
                                                    className="btn btn--quiet btn--sm"
                                                    title="Sintesis Suara AI"
                                                >
                                                    <Volume2 className="w-4 h-4" /> Sebutan AI
                                                </button>
                                            </div>
                                            <p className="text-md">
                                                &quot;{a.originalText}&quot;
                                            </p>
                                        </div>

                                        {a.userIntendedMeaning && (
                                            <div className="pt-4 border-t border-rule">
                                                <span className="mb-1 flex items-center gap-1 text-sm text-muted">
                                                    <Sparkles className="w-4 h-4" /> Rumusan / Maksud AI (NLP)
                                                </span>
                                                <p className="text-md text-ink-2">
                                                    {a.userIntendedMeaning}
                                                </p>
                                            </div>
                                        )}

                                        {/* Dialect Feedback Loop */}
                                        <div className="pt-4 border-t border-rule flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-sm text-muted">
                                                Adakah Terjemahan AI Tepat?
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {a.feedbackGiven === 'up' ? (
                                                    <span className="tag tag--in">
                                                        <Check className="w-3.5 h-3.5" /> Disahkan Tepat
                                                    </span>
                                                ) : a.feedbackGiven === 'down' ? (
                                                    <span className="tag">
                                                        Maklum Balas Dihantar
                                                    </span>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
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
                                                                        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}) },
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
                                                            className="btn btn--sm"
                                                        >
                                                            <ThumbsUp className="w-4 h-4" /> Tepat
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFeedbackModalAnomaly(a);
                                                                setFeedbackCorrectText(a.translatedText || a.originalText || '');
                                                            }}
                                                            className="btn btn--sm"
                                                        >
                                                            <ThumbsDown className="w-4 h-4" /> Salah
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        {/* Direct Share Button */}
                                        <button
                                            type="button"
                                            onClick={() => handleShareReport(a)}
                                            className="btn btn--sm"
                                            title="Kongsi Aduan Ini"
                                        >
                                            <Share2 className="w-4 h-4" /> Kongsi
                                        </button>

                                        {/* Action Menu with Export PDF & Copy */}
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveMenuReportId(activeMenuReportId === a.id ? null : a.id);
                                                }}
                                                className="icon-btn"
                                                aria-label="Tindakan Tambahan"
                                                aria-expanded={activeMenuReportId === a.id}
                                                title="Tindakan Tambahan"
                                            >
                                                <MoreHorizontal className="w-5 h-5" />
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
                                                    <div className="absolute left-0 bottom-full mb-2 w-52 z-50 flex flex-col p-1 bg-paper border border-rule shadow-card rounded-card">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                generateAduanPdf(a);
                                                                setActiveMenuReportId(null);
                                                            }}
                                                            className="btn btn--quiet btn--block justify-start"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                            <span>Export PDF (PBT)</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCopyReport(a);
                                                                setActiveMenuReportId(null);
                                                            }}
                                                            className="btn btn--quiet btn--block justify-start"
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                            <span>Salin Butiran</span>
                                                        </button>
                                                        <div className="mt-1 pt-1 border-t border-rule">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteReport(a);
                                                                    setActiveMenuReportId(null);
                                                                }}
                                                                className="btn btn--quiet btn--block justify-start text-danger"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                                <span>Padam Aduan</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {a.aiAnalysis && (
                                        <button
                                            type="button"
                                            onClick={() => setAnomalies(prev => prev.map(x => x.id === a.id ? { ...x, expanded: !x.expanded } : x))}
                                            className="icon-btn"
                                            aria-label={a.expanded ? 'Tutup Perincian' : 'Buka Perincian'}
                                            aria-expanded={!!a.expanded}
                                            title={a.expanded ? 'Tutup Perincian' : 'Buka Perincian'}
                                        >
                                            {a.expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                        </button>
                                    )}
                                </div>

                                {/* AI Analysis */}
                                {a.aiAnalysis && a.expanded && (
                                    <div className="pt-4 border-t border-rule flex flex-col gap-3">
                                        {a.photoBase64 && (
                                            <img src={a.photoBase64} alt="Bukti" className="h-32 w-full max-w-sm object-cover rounded-card" />
                                        )}
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
                                            {a.aiAnalysis.severityScore > 0 && (
                                                <span>
                                                    {a.aiAnalysis.severityLabel || a.aiAnalysis.damageType} (Tahap {a.aiAnalysis.severityScore}/5)
                                                </span>
                                            )}
                                            {a.aiAnalysis.routingAgency && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Building2 className="w-4 h-4" /> Agensi: {a.aiAnalysis.routingAgency}
                                                </span>
                                            )}
                                            {a.aiAnalysis.recommendedAction && (
                                                <span>{a.aiAnalysis.recommendedAction}</span>
                                            )}
                                        </div>

                                        {a.aiAnalysis.riskAssessment && (
                                            <p className="text-md text-ink-2">
                                                <span className="font-semibold text-ink">Analisis Risiko: </span>{a.aiAnalysis.riskAssessment}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>

                {/* ============================================================= */}
                {/* 6. EMPTY STATE                                                */}
                {/* ============================================================= */}
                {filteredAnomalies.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <Layers className="w-6 h-6 text-muted" />
                        <h4 className="text-md font-semibold">
                            Jom Bantu Jaga Kawasan Kita!
                        </h4>
                        <p className="max-w-md text-md text-ink-2">
                            Belum ada aduan bagi kategori ini. Taip atau rakam suara anda di ruangan atas untuk menyalurkan aduan pertama kawasan anda kepada pihak berkuasa.
                        </p>
                    </div>
                )}

                {/* View Footer */}
                <div className="mt-auto pt-8 pb-2 flex flex-col items-center gap-1 text-center text-sm text-muted">
                    <span>NADI Sivik</span>
                    <span>Platform komuniti & respons bencana</span>
                </div>
            </div>

            {/* ================================================================= */}
            {/* 7. TOAST NOTIFICATIONS                                            */}
            {/* ================================================================= */}
            {mounted && typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {copiedToast && (
                        <motion.div
                            role="status"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[999999] flex items-center gap-2 px-4 py-3 rounded-control shadow-card bg-ink text-paper text-sm font-semibold"
                        >
                            <Check className="w-4 h-4 shrink-0" /> Butiran aduan berjaya disalin ke papan keratan!
                        </motion.div>
                    )}
                    {deletedToast && (
                        <motion.div
                            role="status"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[999999] flex items-center gap-2 px-4 py-3 rounded-control shadow-card bg-ink text-paper text-sm font-semibold"
                        >
                            <Trash2 className="w-4 h-4 shrink-0" /> Rekod aduan telah berjaya dipadam!
                        </motion.div>
                    )}
                    {deleteErrorToast && (
                        <motion.div
                            role="alert"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[999999] flex items-center gap-2 px-4 py-3 rounded-control shadow-card bg-danger-soft text-danger-soft-ink text-sm font-semibold"
                        >
                            <AlertTriangle className="w-4 h-4 shrink-0" /> Gagal memadam aduan: tiada kebenaran atau ralat rangkaian.
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
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-scrim"
                        >
                            <div
                                role="dialog"
                                aria-label="Bantu AI belajar dialek"
                                className="w-full max-w-sm max-h-full overflow-y-auto flex flex-col gap-4 p-6 bg-paper border border-rule rounded-card shadow-card"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-lg">Bantu AI belajar dialek</h3>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFeedbackModalAnomaly(null);
                                            setFeedbackCorrectText('');
                                        }}
                                        className="icon-btn"
                                        aria-label="Tutup"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <p className="text-md text-ink-2">
                                    Adakah terjemahan AI kurang tepat? Masukkan maksud sebenar untuk melatih enjin dialek NADI:
                                </p>

                                <div className="well p-3">
                                    <p className="text-sm text-muted">
                                        Ayat Asal Warga (<span className="capitalize">{feedbackModalAnomaly.detectedDialect || 'Kelantan'}</span>):
                                    </p>
                                    <p className="mt-1 text-md">&quot;{feedbackModalAnomaly.originalText || feedbackModalAnomaly.title}&quot;</p>
                                </div>

                                <div>
                                    <label className="label" htmlFor="aduan-maksud-sebenar">Maksud Sebenar:</label>
                                    <textarea
                                        id="aduan-maksud-sebenar"
                                        value={feedbackCorrectText}
                                        onChange={(e) => setFeedbackCorrectText(e.target.value)}
                                        rows={3}
                                        placeholder="Taip maksud sebenar di sini…"
                                        className="field"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <button
                                        type="button"
                                        className="btn btn--block"
                                        onClick={() => handleSendFeedback(false)}
                                        disabled={!feedbackCorrectText.trim() || isSubmittingFeedback}
                                    >
                                        {isSubmittingFeedback ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin keep-motion" /> Menghantar…
                                            </>
                                        ) : feedbackSuccessToast ? (
                                            <>
                                                <Check className="w-4 h-4" /> AI Berjaya Dikemaskini!
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" /> Hantar Terjemahan & Ajar AI
                                            </>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSendFeedback(true)}
                                        disabled={isSubmittingFeedback}
                                        className="btn btn--quiet btn--block"
                                    >
                                        Langkau
                                    </button>
                                </div>
                            </div>
                        </motion.div>
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
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-scrim"
                        >
                            <div
                                role="dialog"
                                aria-label={interceptEmergency.title}
                                className="w-full max-w-lg max-h-full overflow-y-auto flex flex-col gap-5 p-6 bg-paper border border-rule rounded-card shadow-card"
                            >
                                {/* Header */}
                                <div className="flex items-start gap-3">
                                    <Phone className="w-6 h-6 shrink-0 mt-1 text-danger" />
                                    <div className="flex min-w-0 flex-col gap-2">
                                        <h3 className="text-lg">
                                            {interceptEmergency.title}
                                        </h3>
                                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                                            <span className="tag tag--danger">{interceptEmergency.badgeText}</span>
                                            <span>{interceptEmergency.agencyName}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Warning message */}
                                <div className="flex flex-col gap-2 p-4 rounded-control bg-danger-soft text-danger-soft-ink">
                                    <p className="flex items-start gap-2 text-md">
                                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                        <span>
                                            <strong>PENTING:</strong> Aduan awam melalui aplikasi NADI memerlukan masa pemprosesan pegawai bertugas dan <strong>BUKAN saluran respons kecemasan segera</strong>.
                                        </span>
                                    </p>
                                    <p className="text-sm">
                                        Situasi ini memerlukan bantuan penyelamat atau tindakan teknikal serta-merta. Sila <strong>hubungi nombor kecemasan sekarang</strong> sebelum menunggu laporan diproses.
                                    </p>
                                </div>

                                {/* Safety instructions */}
                                <div>
                                    <p className="mb-2 text-sm font-semibold">
                                        Langkah Keselamatan Segera:
                                    </p>
                                    <ul className="flex flex-col gap-2 text-md">
                                        {interceptEmergency.instructions.map((step, idx) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <Check className="w-4 h-4 shrink-0 mt-1" />
                                                <span>{step}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Direct Calling Buttons */}
                                <div className="flex flex-col gap-2">
                                    <a
                                        href={interceptEmergency.primaryTel}
                                        onClick={() => setInterceptEmergency(null)}
                                        className="btn btn--danger btn--block whitespace-normal py-2 text-center"
                                    >
                                        <Phone className="w-4 h-4 shrink-0" />
                                        <span>Hubungi segera: {interceptEmergency.primaryPhone} ({interceptEmergency.primaryLabel})</span>
                                    </a>

                                    {interceptEmergency.secondaryTel && (
                                        <a
                                            href={interceptEmergency.secondaryTel}
                                            onClick={() => setInterceptEmergency(null)}
                                            className="btn btn--block whitespace-normal py-2 text-center"
                                        >
                                            <Phone className="w-4 h-4 shrink-0" />
                                            <span>Hubungi talian kedua: {interceptEmergency.secondaryPhone} ({interceptEmergency.secondaryLabel})</span>
                                        </a>
                                    )}
                                </div>

                                {/* Secondary Actions */}
                                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-rule">
                                    <button
                                        type="button"
                                        onClick={() => setInterceptEmergency(null)}
                                        className="btn btn--quiet"
                                    >
                                        Tutup & Buat Panggilan
                                    </button>
                                    <button
                                        type="button"
                                        className="btn"
                                        onClick={() => {
                                            setInterceptEmergency(null);
                                            handleSendAduan(true);
                                        }}
                                    >
                                        Simpan Rekod Aduan Sahaja
                                    </button>
                                </div>
                            </div>
                        </motion.div>
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
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            className="fixed inset-0 z-[999998] flex items-center justify-center p-4 bg-scrim"
                        >
                            <div
                                role="dialog"
                                aria-label="Kamera Langsung (Live Camera)"
                                className="relative w-full max-w-lg flex flex-col overflow-hidden bg-overlay text-overlay-ink border border-overlay-rule rounded-card shadow-card"
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-overlay-rule">
                                    <h3 className="flex items-center gap-2 text-lg">
                                        <Camera className="w-5 h-5" />
                                        Kamera Langsung (Live Camera)
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={stopLiveCamera}
                                        className="icon-btn text-overlay-ink hover:bg-overlay-rule hover:text-overlay-ink"
                                        aria-label="Tutup Kamera"
                                        title="Tutup Kamera"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Viewfinder / Video Stream */}
                                <div className="relative aspect-4/3 bg-overlay overflow-hidden flex items-center justify-center">
                                    <video
                                        ref={liveCameraVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover"
                                    />

                                    {/* Viewfinder Target Reticles */}
                                    <div className="absolute inset-8 pointer-events-none flex items-center justify-center">
                                        <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-overlay-ink rounded-tl-control" />
                                        <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-overlay-ink rounded-tr-control" />
                                        <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-overlay-ink rounded-bl-control" />
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-overlay-ink rounded-br-control" />

                                        {/* Center Crosshair */}
                                        <div className="w-8 h-0.5 bg-overlay-muted" />
                                        <div className="absolute h-8 w-0.5 bg-overlay-muted" />
                                    </div>

                                    {/* Status Badge */}
                                    <div className="absolute top-3 left-3 px-3 py-1 rounded-pill bg-overlay text-overlay-ink border border-overlay-rule text-sm">
                                        Sedia Tangkap Gambar
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center justify-between gap-4 p-4 border-t border-overlay-rule">
                                    <button
                                        type="button"
                                        onClick={stopLiveCamera}
                                        className="btn bg-transparent border-overlay-rule text-overlay-ink hover:bg-overlay-rule"
                                    >
                                        Batal
                                    </button>

                                    {/* Shutter Button */}
                                    <button
                                        type="button"
                                        onClick={snapLivePhoto}
                                        aria-label="Tangkap Gambar"
                                        className="btn bg-overlay-ink border-overlay-ink text-overlay hover:bg-overlay-muted hover:border-overlay-muted"
                                    >
                                        <span className="w-4 h-4 rounded-pill border-2 border-current" />
                                        <span>Tangkap Gambar</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
