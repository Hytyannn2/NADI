/**
 * Aduan (civic complaint) pure logic: categories, agency routing, keyword triage
 * and emergency detection. No React, no path aliases: `node scripts/aduan.check.mjs`
 * imports this file directly.
 *
 * All keyword matching is anchored at a leading word boundary, so "lubangnya" still
 * matches "lubang" but "hantar", "sekitar", "selain" and "tapi" do not trigger
 * "tar", "lain" or "api".
 */

// Named columns only: device_fingerprint, speed_kmh, gyro_max_rotation and waveform_duration_ms
// are not client-readable (migration 019).
// ponytail: photos are data URLs in photo_url, so the feed leaves them out and loads one per
// expanded card; move photos to Supabase Storage when report volume grows.
export const INFRA_FEED_COLUMNS = 'id, user_id, lat, lng, z_dropped, verifications, status, created_at, title, ai_analysis, confidence_score';

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
        keywords: ['jalan', 'lubang', 'berlubang', 'pothole', 'pecah', 'lerek', 'kelebok', 'perok', 'retak', 'bonggol', 'mendap', 'lekuk', 'lopak', 'turap'],
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

// Keywords are plain words (letters, spaces, hyphens), so no regex escaping is needed.
const CATEGORY_PATTERNS = CIVIC_CATEGORIES.map(c => ({ id: c.id, re: new RegExp(`\\b(?:${c.keywords.join('|')})`, 'i') }));

// First matching category wins, in CIVIC_CATEGORIES order.
export function detectCategoryFromText(text: string): CivicCategory {
    return CATEGORY_PATTERNS.find(p => p.re.test(text))?.id ?? 'lain';
}

export function detectUrgencyFromText(text: string): 'Low' | 'Medium' | 'High' {
    // Critical public health, epidemic, or life-threatening hazards
    if (/\b(?:denggi|dengue|aedes|wabak|rabies|bangkai|keracunan|gas bocor|lemas|tanah runtuh|kebakaran|api\b|renjatan)/i.test(text)) {
        return 'High';
    }
    // Severe infrastructure or safety risks
    if (/\b(?:lubang besar|pothole besar|terputus|hancur|banjir|melimpah|tiang tumbang|pokok tumbang)/i.test(text)) {
        return 'High';
    }
    // Standard civic defect
    if (/\b(?:lubang|rosak|lampu padam|tersumbat|longkang|sampah|busuk)/i.test(text)) {
        return 'Medium';
    }
    return 'Low';
}

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
    if (/\b(?:sakit jantung|serangan jantung|heart attack|strok|stroke|pengsan|tak sedar|koma|lemas|drowning|sesak nafas teruk|pendarahan teruk|kemalangan parah)/i.test(lower)) {
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
        (/\b(?:pokok|dahan)/i.test(lower) && /\b(?:tumbang|hempap|patah|jatuh)/i.test(lower) && /\b(?:tiang|wayar|kabel|elektrik|api)/i.test(lower)) ||
        (/\b(?:tiang api|tiang elektrik|wayar elektrik|kabel elektrik|pencawang|renjatan)/i.test(lower) && /\b(?:tumbang|hempap|putus|terbakar|meletup|jatuh|bawah)/i.test(lower))
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
    if (/\b(?:denggi|dengue|aedes|wabak denggi|demam berdarah|pembiakan aedes|anjing gila|rabies)/i.test(lower)) {
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
    if (/\b(?:banjir besar|banjir kilat teruk|air naik mendadak|terperangkap banjir|arus deras|pindah banjir|tanah runtuh besar|rumah tenggelam|paras bahaya|bencana alam|gas bocor)/i.test(lower)) {
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
