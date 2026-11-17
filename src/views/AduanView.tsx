/**
 * Citizen Civic Reports & Road Defect View
 * 
 * Provides voice/text report submission, AI triage, automated PostGIS clustering,
 * dashcam anomaly capture, and JKR/PBT complaint ticket generation.
 */
'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { generateAduanPdf, generatePayloadHash } from '@/src/lib/pdf/generateAduanPdf';
import { speakDialect } from '@/src/lib/speech/speakDialect';
import { fileToJpegDataUrl, toJpegDataUrl } from '@/src/lib/image';
import { formatReportRelative, formatReportExact } from '@/src/lib/format';
import {
    CIVIC_CATEGORIES,
    INFRA_FEED_COLUMNS,
    detectCategoryFromText,
    detectEmergencyProtocol,
    detectUrgencyFromText,
    type CivicCategory,
    type EmergencyProtocol,
} from '@/src/lib/aduan';

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

// ai_analysis as stored: a full AiAnalysis plus the report text for citizen reports,
// { category, hasPhoto } for dashcam potholes, null for plain sensor potholes.
type StoredAiAnalysis = Partial<AiAnalysis> & {
    category?: CivicCategory;
    urgency?: 'Low' | 'Medium' | 'High';
    originalText?: string;
    translatedText?: string;
    userIntendedMeaning?: string;
    userCorrection?: string;
    detectedDialect?: string;
    feedbackGiven?: 'up' | 'down';
    locationName?: string;
    hasPhoto?: boolean;
};

// Officers move reports past 'pending' via /admin (citizens can only insert 'pending').
type AnomalyStatus = 'pending' | 'verified' | 'resolved' | 'rejected';
const STATUS_LABEL: Record<AnomalyStatus, string> = {
    pending: 'Dalam Semakan', verified: 'Disahkan', resolved: 'Selesai', rejected: 'Ditolak',
};
const isConfirmed = (s: AnomalyStatus) => s === 'verified' || s === 'resolved';

// One row of INFRA_FEED_COLUMNS
interface InfraReportRow {
    id: string;
    user_id: string | null;
    lat: string | number;
    lng: string | number;
    z_dropped: number | null;
    verifications: number | null;
    status: AnomalyStatus;
    created_at: string;
    title: string | null;
    ai_analysis: StoredAiAnalysis | null;
    confidence_score: number | null;
}

interface Anomaly {
    id: string;
    userId?: string;
    lat: number;
    lng: number;
    category: CivicCategory;
    zDropped: number;
    verifications: number;
    status: AnomalyStatus;
    time: string;
    createdAt?: string;
    aiAnalysis: StoredAiAnalysis | null;
    hasPhoto: boolean;
    confidenceScore?: number;
    title?: string;
    originalText?: string;
    translatedText?: string;
    locationName?: string;
    urgency?: 'Low' | 'Medium' | 'High';
    detectedDialect?: string;
    userIntendedMeaning?: string;
    feedbackGiven?: 'up' | 'down';
    suggestedAgency?: string;
}

function rowToAnomaly(row: InfraReportRow): Anomaly {
    const ai: StoredAiAnalysis = row.ai_analysis ?? {};
    const zDropped = Number(row.z_dropped) || 0;
    return {
        id: row.id,
        userId: row.user_id ?? undefined,
        lat: Number(row.lat),
        lng: Number(row.lng),
        category: ai.category ?? (zDropped > 0 ? 'jalan' : 'lain'),
        zDropped,
        verifications: Number(row.verifications) || 1,
        status: row.status || 'pending',
        createdAt: row.created_at,
        time: formatReportRelative(row.created_at, true, 'Baru sahaja'),
        title: row.title || ai.damageType || (zDropped ? `Lubang Jalan Dikesan (${zDropped.toFixed(1)}g)` : 'Aduan Infrastruktur'),
        aiAnalysis: row.ai_analysis,
        hasPhoto: ai.hasPhoto === true,
        confidenceScore: row.confidence_score || 0,
        suggestedAgency: ai.routingAgency || 'JKR / PBT',
        urgency: ai.urgency || 'Medium',
        originalText: ai.originalText,
        translatedText: ai.userCorrection || ai.translatedText,
        userIntendedMeaning: ai.userCorrection
            ? `Dikemaskini Warga: "${ai.userCorrection}"`
            : (ai.userIntendedMeaning || ai.riskAssessment),
        feedbackGiven: ai.feedbackGiven,
        detectedDialect: ai.detectedDialect,
        locationName: ai.locationName ?? ai.nearestRoadType,
    };
}

// The fields this view reads from /api/suara/parse and /api/infra/vision
interface ParseResult {
    intent?: string;
    category?: CivicCategory;
    suggestedAgency?: string;
    urgency?: 'Low' | 'Medium' | 'High';
    simplifiedTranslation?: string;
    userIntendedMeaning?: string;
    detectedDialect?: string;
    confidenceScore?: number;
}
interface VisionResult {
    damageType?: string;
    visualSeverity?: number;
    description?: string;
    repairRecommendation?: string;
}

const SUBMIT_FAILED = 'Gagal menghantar aduan. Teks anda masih ada — cuba lagi.';

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
    const userId = user?.id;
    const { t } = useLanguage();
    const { applyLocationPrecision, locationPrecision, playAlertSound } = useTheme();
    const [filter, setFilter] = useState<CivicCategory | 'all' | 'verified' | 'mine'>('all');
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [activeMenuReportId, setActiveMenuReportId] = useState<string | null>(null);
    // UI state kept outside the list so it survives a refetch
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [photos, setPhotos] = useState<Record<string, string>>({});
    // AduanView only mounts once signed in (page.tsx auth gate), so userId is known here
    const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>(() => {
        try { return JSON.parse(localStorage.getItem(`nadi_aduan_feedback_${userId}`) || '{}'); } catch { return {}; }
    });

    // Universal Composer States
    const [manualDescription, setManualDescription] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<CivicCategory>('jalan');
    const [hasManuallySelectedCategory, setHasManuallySelectedCategory] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userGpsLocation, setUserGpsLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
    const [isGettingGps, setIsGettingGps] = useState(false);
    const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);
    const gpsErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Modals
    const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const showToast = useCallback((text: string, error = false) => {
        setToast({ text, error });
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => setToast(null), error ? 4000 : 2500);
    }, []);
    const [feedbackModalAnomaly, setFeedbackModalAnomaly] = useState<Anomaly | null>(null);
    const [feedbackCorrectText, setFeedbackCorrectText] = useState('');
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

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
        if ((!textToProcess && !photoToProcess) || isSubmitting) return;

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
            showToast('Sila log masuk terlebih dahulu untuk menghantar aduan.', true);
            return;
        }

        setIsSubmitting(true);
        try {
            // ponytail: GPS is required (lat/lng are NOT NULL, and a report without a place is useless
            // to an agency). Upgrade path: nullable coordinates plus a typed address.
            let loc = userGpsLocation;
            if (!loc) {
                const pos = await new Promise<GeolocationPosition | null>(resolve => {
                    if (!navigator.geolocation) return resolve(null);
                    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: locationPrecision === 'high', timeout: 6000 });
                });
                if (pos) {
                    const adjusted = applyLocationPrecision(pos.coords.latitude, pos.coords.longitude);
                    loc = { lat: adjusted.lat, lng: adjusted.lng, label: await fetchLocationNameFromCoords(adjusted.lat, adjusted.lng) };
                    setUserGpsLocation(loc);
                }
            }
            if (!loc) {
                showToast('Lokasi diperlukan untuk menghantar aduan. Benarkan akses lokasi dan cuba lagi.', true);
                return;
            }

            // AI triage is best-effort: a failed or slow call still files the report via the keyword fallback
            const postJson = async (url: string, body: object) => {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(15000),
                });
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
                return json;
            };
            const [parsed, vision] = await Promise.allSettled([
                textToProcess ? postJson('/api/suara/parse', { inputText: textToProcess, targetLanguage: 'ms' }) : null,
                photoToProcess ? postJson('/api/infra/vision', { imageBase64: photoToProcess.split(',')[1] || photoToProcess }) : null,
            ]);
            if (parsed.status === 'rejected') console.warn('Aduan AI parse notice:', parsed.reason);
            if (vision.status === 'rejected') console.warn('Aduan AI vision notice:', vision.reason);
            const resData: ParseResult | null = parsed.status === 'fulfilled' ? parsed.value?.data ?? null : null;
            const visionAnalysis: VisionResult | null = vision.status === 'fulfilled' ? vision.value?.analysis ?? null : null;

            const reportCategory: CivicCategory = hasManuallySelectedCategory
                ? selectedCategory
                : (resData?.category || detectCategoryFromText(textToProcess));
            const catConfig = CIVIC_CATEGORIES.find(c => c.id === reportCategory);
            const intent = resData?.intent || visionAnalysis?.damageType || `Aduan ${catConfig?.label || 'Sivik'}`;
            const locName = loc.label;
            const translation = resData?.simplifiedTranslation || textToProcess || visionAnalysis?.damageType || `Aduan ${catConfig?.label || 'Sivik'}`;

            // Public health, vector threats, & dengue are ALWAYS High urgency!
            const isVectorOrHealth = /(denggi|dengue|aedes|wabak|rabies|vektor|fogging)/i.test(textToProcess);
            const urgency: 'Low' | 'Medium' | 'High' = isVectorOrHealth
                ? 'High'
                : (resData?.urgency || ((visionAnalysis?.visualSeverity ?? 0) >= 4 ? 'High' : detectUrgencyFromText(textToProcess)));

            const effectiveAgency = resData?.suggestedAgency || (isVectorOrHealth ? 'Pejabat Kesihatan Daerah (PKD) / KKM' : catConfig?.suggestedAgency || 'PBT');

            const aiAnalysis: StoredAiAnalysis = {
                severityScore: visionAnalysis?.visualSeverity || (urgency === 'High' ? 4 : urgency === 'Medium' ? 3 : 2),
                severityLabel: visionAnalysis?.damageType || `Aduan ${catConfig?.label}`,
                damageType: visionAnalysis?.damageType || intent,
                estimatedWidth: '—',
                estimatedDepth: '—',
                repairMethod: visionAnalysis?.repairRecommendation || (isVectorOrHealth ? 'Pemeriksaan Tapak & Semburan Fogging' : 'Penilaian & Tindakan PBT'),
                repairCostMYR: 'Mengikut Skop Kerosakan',
                priorityScore: isVectorOrHealth ? 95 : urgency === 'High' ? 88 : urgency === 'Medium' ? 68 : 48,
                riskAssessment: visionAnalysis?.description || resData?.userIntendedMeaning || '',
                nearestRoadType: locName,
                recommendedAction: visionAnalysis?.repairRecommendation || (isVectorOrHealth ? 'Kawalan Vektor & Hapus Tempat Pembiakan' : 'Penugasan Skuad Tindakan Tapak'),
                routingAgency: effectiveAgency,
                originalText: textToProcess || `Aduan bergambar (${catConfig?.label})`,
                translatedText: translation,
                // Only what the AI actually returned; undefined keys are dropped from the JSON
                userIntendedMeaning: resData?.userIntendedMeaning || undefined,
                detectedDialect: resData?.detectedDialect || undefined,
                urgency,
                category: reportCategory,
                locationName: locName,
                hasPhoto: !!photoToProcess,
            };

            // Insert first, show after: the report appears only once the DB has it
            const { data, error } = await supabase.from('nadi_infra_reports').insert({
                user_id: user.id,
                lat: String(loc.lat),
                lng: String(loc.lng),
                z_dropped: 0,
                confidence_score: typeof resData?.confidenceScore === 'number' ? resData.confidenceScore : 0,
                device_fingerprint: getDeviceFingerprint(),
                status: 'pending',
                title: `${intent} @ ${locName}`,
                ai_analysis: aiAnalysis,
                photo_url: photoToProcess ?? null,
            }).select(INFRA_FEED_COLUMNS).single();
            if (error || !data) {
                console.error('[AduanView] report insert failed:', error?.message);
                showToast(SUBMIT_FAILED, true);
                return;
            }

            const row = data as InfraReportRow;
            setAnomalies(prev => [rowToAnomaly(row), ...prev.filter(x => x.id !== row.id)]);
            if (photoToProcess) setPhotos(prev => ({ ...prev, [row.id]: photoToProcess }));
            setManualDescription('');
            setAttachedPhotoBase64(null);
            setHasManuallySelectedCategory(false);
            showToast('Aduan dihantar.');
        } catch (err) {
            console.error('[AduanView] report submit failed:', err);
            showToast(SUBMIT_FAILED, true);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredAnomalies = useMemo(() => {
        return anomalies.filter(a => {
            if (filter === 'verified') return isConfirmed(a.status);
            if (filter === 'mine') return a.userId === userId;
            if (filter === 'all') return true;
            return a.category === filter;
        });
    }, [anomalies, filter, userId]);

    const totalReports = anomalies.length;
    const totalVerified = anomalies.filter(a => isConfirmed(a.status)).length;
    const totalResolved = anomalies.filter(a => a.status === 'resolved').length;

    const loadReports = useCallback(async () => {
        if (!userId) return;
        // Everyone's open reports, plus the signed-in user's own rejected ones
        const { data, error } = await supabase.from('nadi_infra_reports')
            .select(INFRA_FEED_COLUMNS)
            .or(`status.neq.rejected,user_id.eq.${userId}`)
            .order('created_at', { ascending: false })
            .limit(100);
        if (error) {
            console.error('[AduanView] feed load failed:', error.message);
            showToast('Gagal memuatkan senarai aduan.', true);
            return;
        }
        setAnomalies((data as InfraReportRow[]).map(rowToAnomaly));
    }, [supabase, userId, showToast]);

    // Per-user record of which reports this user already rated; nothing else about feedback is kept locally
    const markFeedback = (reportId: string, value: 'up' | 'down') => {
        const next = { ...feedback, [reportId]: value };
        setFeedback(next);
        try { localStorage.setItem(`nadi_aduan_feedback_${userId}`, JSON.stringify(next)); } catch {}
    };

    const handleSendFeedback = async (skipCorrection = false) => {
        const a = feedbackModalAnomaly;
        if (!a || isSubmittingFeedback) return;
        const closeModal = () => {
            setFeedbackModalAnomaly(null);
            setFeedbackCorrectText('');
        };

        if (skipCorrection) {
            markFeedback(a.id, 'down');
            closeModal();
            return;
        }

        const correction = feedbackCorrectText.trim();
        setIsSubmittingFeedback(true);
        try {
            // Owners may write ai_analysis on their own rows; anyone else's correction only goes to the officer review queue
            if (a.userId === userId) {
                // RLS rejections return no error, just 0 rows, so confirm via the returned rows.
                const { data, error } = await supabase.from('nadi_infra_reports')
                    .update({ ai_analysis: { ...a.aiAnalysis, userCorrection: correction, riskAssessment: `Dikemaskini Warga: "${correction}"` } })
                    .eq('id', a.id)
                    .select('id');
                if (error || !data?.length) {
                    console.error('[AduanView] correction update failed:', error ?? 'ditolak oleh RLS');
                    showToast('Gagal menyimpan pembetulan. Cuba lagi.', true);
                    return;
                }
                loadReports();
            }

            // Owners already saved the correction above; for anyone else this POST is the only record, so its failure must show
            let feedbackError: string | null = null;
            try {
                const res = await fetch('/api/dialect/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}) },
                    body: JSON.stringify({
                        dialectText: a.originalText || a.title || '',
                        correctMeaning: correction,
                        region: a.detectedDialect,
                        rawVoice: a.originalText || '',
                        reportId: a.id,
                        isPositive: false
                    })
                });
                if (!res.ok) {
                    const json = await res.json().catch(() => ({}));
                    feedbackError = json.error || 'Gagal menghantar pembetulan. Cuba lagi.';
                }
            } catch (err) {
                console.warn('Feedback submit error:', err);
                feedbackError = 'Gagal menghantar pembetulan. Cuba lagi.';
            }
            if (feedbackError && a.userId !== userId) {
                showToast(feedbackError, true);
                return;
            }

            markFeedback(a.id, 'down');
            closeModal();
            showToast('Terima kasih. Pembetulan akan disemak pegawai.');
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    useEffect(() => {
        // One-time cleanup: reports used to be cached in the browser; the DB is now the only source
        try {
            Object.keys(localStorage)
                .filter(k => k.startsWith('nadi_local_potholes') || k === 'nadi_aduan_feedback_map')
                .forEach(k => localStorage.removeItem(k));
        } catch {}
    }, []);

    useEffect(() => {
        loadReports();
        // Any insert, officer status change or delete: refetch (same pattern as CivicHeatMap)
        const channel = supabase.channel('infra_reports')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'nadi_infra_reports' }, () => { loadReports(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [supabase, loadReports]);

    // The background detector attaches a dashcam frame to each pothole it files while the dashcam is on
    useEffect(() => {
        const providerRef = detector.snapshotProviderRef;
        providerRef.current = dashcam.isDashcamEnabled ? dashcam.captureFrame : null;
        return () => { providerRef.current = null; };
    }, [detector.snapshotProviderRef, dashcam.isDashcamEnabled, dashcam.captureFrame]);

    const toggleExpanded = async (a: Anomaly) => {
        const opening = expandedId !== a.id;
        setExpandedId(opening ? a.id : null);
        if (!opening || !a.hasPhoto || a.id in photos) return;
        const { data, error } = await supabase.from('nadi_infra_reports').select('photo_url').eq('id', a.id).single();
        if (error) {
            console.warn('[AduanView] photo load failed:', error.message);
            return;
        }
        setPhotos(prev => ({ ...prev, [a.id]: (data as { photo_url: string | null }).photo_url ?? '' }));
    };

    const handleToggleDashcam = async () => {
        detector.startDriving();
        if (dashcam.isDashcamEnabled) {
            dashcam.disableDashcam();
        } else {
            await dashcam.enableDashcam();
        }
    };

    const reportSummary = (a: Anomaly) => {
        const issueTitle = a.title || a.aiAnalysis?.damageType || 'Aduan Warga';
        const coords = `${a.lat.toFixed(5)}°, ${a.lng.toFixed(5)}°`;
        const loc = a.locationName ? `${a.locationName} (${coords})` : coords;
        const quote = a.originalText ? `"${a.originalText}"` : (a.translatedText ? `"${a.translatedText}"` : '');
        return `🚨 Aduan NADI: ${issueTitle}\n📍 Lokasi: ${loc}\n💬 Keterangan: ${quote}\n⚠️ Status: ${STATUS_LABEL[a.status]}`;
    };

    const handleCopyReport = async (a: Anomaly, text = reportSummary(a)) => {
        try {
            await navigator.clipboard.writeText(text);
            showToast('Butiran aduan berjaya disalin ke papan keratan!');
        } catch {}
    };

    const handleShareReport = async (a: Anomaly) => {
        const shareText = `${reportSummary(a)} (ID: #${a.id.slice(-6)})\n\nLayari NADI Civic OS untuk tindakan lanjut.`;

        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({
                    title: `Aduan: ${a.title || a.aiAnalysis?.damageType || 'Aduan Warga'}`,
                    text: shareText,
                    url: `${window.location.origin}/verify/${a.id}?hash=${generatePayloadHash({ id: a.id, createdAt: a.createdAt })}`
                });
                return;
            } catch {
                // User cancelled or aborted native share sheet
            }
        }

        handleCopyReport(a, shareText);
    };

    const handleDeleteReport = async (a: Anomaly) => {
        // RLS rejections return no error, just 0 rows, so confirm via the returned rows.
        const { data, error } = await supabase.from('nadi_infra_reports').delete().eq('id', a.id).select('id');
        if (error || !data?.length) {
            console.error('Gagal memadam aduan:', error ?? 'ditolak oleh RLS');
            showToast('Gagal memadam aduan — tiada kebenaran atau ralat rangkaian.', true);
            return;
        }
        setAnomalies(prev => prev.filter(item => item.id !== a.id));
        showToast('Rekod aduan telah berjaya dipadam!');
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
                                        aria-label="Tutup Mod Pemanduan"
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
                                    alt=""
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
                            aria-label="Padam Foto"
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
                        aria-label="Keterangan aduan"
                        maxLength={500}
                        className="w-full min-h-[96px] text-xs sm:text-sm rounded-2xl p-3.5 sm:p-4 bg-[#060608]/90 border border-zinc-800/70 text-zinc-100 placeholder-zinc-500 outline-none focus:border-[#C5A367]/60 focus:ring-1 focus:ring-[#C5A367]/20 transition-all resize-none leading-relaxed shadow-inner"
                        disabled={isSubmitting}
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
                                        aria-label="Tutup amaran"
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
                                aria-label={isMediaMenuOpen ? "Tutup Pilihan Foto" : "Tambah Foto (Kamera / Galeri)"}
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
                            disabled={(!manualDescription.trim() && !attachedPhotoBase64) || isSubmitting}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#D4AF37] to-[#AA820A] hover:brightness-110 flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-[0_4px_16px_rgba(212,175,55,0.25)] active:scale-95 shrink-0"
                        >
                            {isSubmitting ? (
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
                                    alt=""
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
                        <button
                            onClick={() => setFilter('mine')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] border transition-all ${
                                filter === 'mine'
                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold shadow-md'
                                    : 'bg-zinc-950/80 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            ADUAN SAYA
                        </button>
                    </div>
                </motion.div>

                {/* ================================================================= */}
                {/* 5. ANOMALY CARDS FEED                                             */}
                {/* ================================================================= */}
                <div className="space-y-4">
                    <AnimatePresence>
                        {filteredAnomalies.map((a, i) => {
                            const catConfig = CIVIC_CATEGORIES.find(c => c.id === a.category) || CIVIC_CATEGORIES[0];
                            const expanded = expandedId === a.id;
                            const feedbackGiven = feedback[a.id] ?? a.feedbackGiven;

                            return (
                                <motion.div
                                    key={a.id}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: Math.min(i, 8) * 0.04 }}
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
                                                : a.status === 'rejected'
                                                ? 'bg-red-500/20 border-red-500/30 text-red-400'
                                                : 'bg-zinc-800/80 text-zinc-400 border-zinc-700'
                                        }`}>
                                            {isConfirmed(a.status) ? `✓ ${STATUS_LABEL[a.status]}` : STATUS_LABEL[a.status]}
                                        </span>
                                    </div>

                                    {/* Metadata Badges */}
                                    <div className="flex flex-wrap gap-2">
                                        {a.hasPhoto ? (
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

                                        {a.detectedDialect && a.detectedDialect !== 'standard' && a.detectedDialect !== 'unknown' && (
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
                                                    &quot;{a.originalText}&quot;
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
                                                    {feedbackGiven === 'up' ? (
                                                        <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                                                            <Check className="w-3 h-3 text-emerald-400" /> Disahkan Tepat
                                                        </span>
                                                    ) : feedbackGiven === 'down' ? (
                                                        <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
                                                            ⚠️ Maklum Balas Dihantar
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={async () => {
                                                                    markFeedback(a.id, 'up');
                                                                    try {
                                                                        await fetch('/api/dialect/feedback', {
                                                                            method: 'POST',
                                                                            headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}) },
                                                                            body: JSON.stringify({
                                                                                dialectText: a.originalText || a.title || '',
                                                                                correctMeaning: a.translatedText || '',
                                                                                region: a.detectedDialect,
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
                                                    aria-label="Tindakan Tambahan"
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
                                                            {a.userId === userId && (
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
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {a.aiAnalysis && (
                                            <button
                                                onClick={() => toggleExpanded(a)}
                                                className="p-2 text-zinc-400 hover:text-white transition-colors"
                                                title={expanded ? 'Tutup Perincian' : 'Buka Perincian'}
                                                aria-label={expanded ? 'Tutup Perincian' : 'Buka Perincian'}
                                            >
                                                {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                            </button>
                                        )}
                                    </div>

                                    {/* AI Analysis Dropdown */}
                                    <AnimatePresence>
                                        {a.aiAnalysis && expanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-5 pb-5 pt-2 border-t border-zinc-800/50 space-y-3">
                                                    {photos[a.id] && (
                                                        <div className="rounded-2xl overflow-hidden border border-zinc-800 h-32">
                                                            <img src={photos[a.id]} alt="Bukti" className="w-full h-full object-cover" />
                                                        </div>
                                                    )}
                                                    <div className="flex flex-wrap gap-2">
                                                        {(a.aiAnalysis.severityScore ?? 0) > 0 && (
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
            {/* 7. TOAST NOTIFICATION                                             */}
            {/* ================================================================= */}
            {mounted && typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {toast && (
                        <motion.div
                            role={toast.error ? 'alert' : 'status'}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            className={toast.error
                                ? 'fixed bottom-20 left-1/2 -translate-x-1/2 z-[999999] bg-zinc-900 text-rose-300 px-5 py-2.5 rounded-2xl font-bold text-xs shadow-2xl flex items-center gap-2 border border-rose-500/50 backdrop-blur-md'
                                : 'fixed bottom-20 left-1/2 -translate-x-1/2 z-[999999] bg-emerald-500 text-black px-5 py-2.5 rounded-2xl font-bold text-xs shadow-2xl flex items-center gap-2 border border-emerald-400/50 backdrop-blur-md'}
                        >
                            {toast.error ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <Check className="w-4 h-4 text-black" />} {toast.text}
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
                                        aria-label="Tutup"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <p className="text-xs text-zinc-400 mb-3">
                                    Adakah terjemahan AI kurang tepat? Masukkan maksud sebenar untuk melatih enjin dialek NADI:
                                </p>

                                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 mb-3 space-y-1">
                                    <span className="text-[9px] text-zinc-500 font-bold uppercase block">Ayat Asal Warga ({feedbackModalAnomaly.detectedDialect || 'Kelantan'}):</span>
                                    <span className="text-xs text-emerald-400 font-medium">&quot;{feedbackModalAnomaly.originalText || feedbackModalAnomaly.title}&quot;</span>
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
                                        aria-label="Tutup Kamera"
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
