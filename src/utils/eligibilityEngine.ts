/**
 * NADI Bantuan — Deterministic Eligibility Matching Engine
 * 
 * Sub-millisecond, zero-token deterministic rule engine for checking Malaysian
 * citizen eligibility for government, NGO, zakat, and community aid programs.
 */

export interface UserProfile {
    age?: number | string;
    income?: number | string;
    status?: string; // 'Bekerja' | 'Penganggur' | 'Pelajar' | 'Pesara' | 'Suri Rumah' | 'OKU' | string
    dependents?: number | string;
    state?: string;
}

export interface AidProgram {
    id: string;
    name: string;
    provider: string;
    type: 'government' | 'ngo' | 'community' | 'zakat';
    description: string;
    eligibility: string;
    status: 'active' | 'upcoming' | 'closed';
    deadline?: string;
    location: string;
    url?: string;
}

export interface EligibilityResult {
    id: string;
    isEligible: boolean | 'maybe';
    matchScore: number; // 0 to 100
    reason: string;
    matchedCriteria: string[];
    missingCriteria: string[];
}

// Income Bracket Boundaries (MYR)
const B40_MAX = 5250;
const MISKIN_TEGAR_MAX = 2208;
const M40_MAX = 11819;

/**
 * Evaluates a user profile against a single aid program's rules.
 */
export function evaluateEligibility(profile: UserProfile, program: AidProgram): EligibilityResult {
    const income = typeof profile.income === 'number' ? profile.income : parseFloat(String(profile.income || '0')) || 0;
    const age = typeof profile.age === 'number' ? profile.age : parseInt(String(profile.age || '0'), 10) || 0;
    const dependents = typeof profile.dependents === 'number' ? profile.dependents : parseInt(String(profile.dependents || '0'), 10) || 0;
    const status = (profile.status || '').toLowerCase();
    const userState = (profile.state || '').toLowerCase();

    const progName = program.name.toLowerCase();
    const progElig = program.eligibility.toLowerCase();
    const progDesc = program.description.toLowerCase();
    const progType = program.type;

    let score = 50; // base starting score
    const matchedCriteria: string[] = [];
    const missingCriteria: string[] = [];

    // --- RULE 1: Income Bracket Check ---
    let incomeChecked = false;
    
    // Check specific income caps mentioned in program text or known programs
    if (progName.includes('str') || progName.includes('sumbangan tunai') || progElig.includes('rm5,000') || progElig.includes('rm5000')) {
        incomeChecked = true;
        if (income <= B40_MAX) {
            score += 25;
            matchedCriteria.push('Pendapatan B40 (≤ RM5,250)');
        } else {
            score -= 40;
            missingCriteria.push('Pendapatan melebihi had RM5,250');
        }
    } else if (progName.includes('ekasih') || progElig.includes('miskin tegar') || progName.includes('jkm') || progElig.includes('rm2,200') || progElig.includes('rm2200')) {
        incomeChecked = true;
        if (income <= MISKIN_TEGAR_MAX) {
            score += 30;
            matchedCriteria.push('Pendapatan bawah Garis Kemiskinan (≤ RM2,208)');
        } else if (income <= B40_MAX) {
            score += 10;
            matchedCriteria.push('Golongan B40');
        } else {
            score -= 35;
            missingCriteria.push('Khas untuk golongan B40 / Miskin Tegar');
        }
    } else if (progType === 'zakat') {
        incomeChecked = true;
        if (income <= MISKIN_TEGAR_MAX) {
            score += 35;
            matchedCriteria.push('Golongan Asnaf / Miskin Tegar');
        } else if (income <= B40_MAX) {
            score += 15;
            matchedCriteria.push('Memerlukan Bantuan Zakat');
        } else {
            score -= 30;
            missingCriteria.push('Keutamaan kepada Asnaf dan B40');
        }
    } else if (progElig.includes('b40') || progDesc.includes('b40')) {
        incomeChecked = true;
        if (income <= B40_MAX) {
            score += 20;
            matchedCriteria.push('Pendapatan isi rumah B40');
        } else {
            score -= 25;
            missingCriteria.push('Terhad untuk pendapatan B40');
        }
    }

    if (!incomeChecked && income > 0) {
        if (income <= B40_MAX) {
            score += 10;
            matchedCriteria.push('Golongan B40 (Keutamaan Bantuan)');
        }
    }

    // --- RULE 2: Age Requirements ---
    if (progName.includes('warga emas') || progElig.includes('60') || progElig.includes('warga emas')) {
        if (age >= 60) {
            score += 30;
            matchedCriteria.push('Umur Warga Emas (≥ 60 tahun)');
        } else if (age > 0) {
            score -= 45;
            missingCriteria.push('Khusus untuk Warga Emas berumur 60 tahun ke atas');
        }
    } else if (progName.includes('bap') || progName.includes('sekolah') || progElig.includes('murid') || progElig.includes('sekolah')) {
        if (dependents > 0 || (age >= 6 && age <= 18)) {
            score += 25;
            matchedCriteria.push('Mempunyai anak bersekolah');
        } else {
            score -= 30;
            missingCriteria.push('Mempunyai anak yang masih bersekolah');
        }
    } else if (progName.includes('mystep') || progName.includes('belia') || progElig.includes('belia') || progElig.includes('graduan')) {
        if (age >= 18 && age <= 35) {
            score += 25;
            matchedCriteria.push('Kategori Belia / Graduan (18-35 tahun)');
        } else if (age > 35) {
            score -= 15;
            missingCriteria.push('Keutamaan golongan belia / graduan baharu');
        }
    }

    // --- RULE 3: Employment & Special Status ---
    if (status.includes('oku') || progName.includes('oku') || progElig.includes('oku')) {
        if (status.includes('oku')) {
            score += 35;
            matchedCriteria.push('Pemegang Kad OKU');
        } else if (progName.includes('oku')) {
            score -= 40;
            missingCriteria.push('Khusus untuk Orang Kurang Upaya (OKU)');
        }
    }

    if (status.includes('pelajar') || progName.includes('ptptn') || progElig.includes('pelajar')) {
        if (status.includes('pelajar')) {
            score += 30;
            matchedCriteria.push('Status Pelajar IPT / IPTS');
        } else if (progName.includes('ptptn')) {
            score -= 30;
            missingCriteria.push('Terbuka untuk Pelajar sahaja');
        }
    }

    if (status.includes('penganggur') || status.includes('tiada kerja')) {
        if (progName.includes('mystep') || progElig.includes('pencari kerja') || progType === 'government') {
            score += 20;
            matchedCriteria.push('Pencari Kerja / Penganggur');
        }
    }

    if (status.includes('suri') || status.includes('i-saraan') || progName.includes('kasih ibu') || progName.includes('wanita')) {
        if (status.includes('suri')) {
            score += 25;
            matchedCriteria.push('Golongan Suri Rumah / Ibu Tunggal');
        }
    }

    // --- RULE 4: Dependents Check ---
    if (dependents >= 3) {
        score += 15;
        matchedCriteria.push(`Tanggungan Ramai (${dependents} orang)`);
    } else if (dependents > 0) {
        score += 10;
        matchedCriteria.push(`Mempunyai Tanggungan (${dependents} orang)`);
    }

    // --- RULE 5: State / Regional Matching ---
    const progLoc = program.location.toLowerCase();
    if (userState && progLoc && !progLoc.includes('seluruh') && !progLoc.includes('malaysia') && !progLoc.includes('nasional')) {
        if (userState.includes(progLoc) || progLoc.includes(userState)) {
            score += 15;
            matchedCriteria.push(`Lokasi Layak (${program.location})`);
        } else {
            score -= 20;
            missingCriteria.push(`Khas untuk penduduk ${program.location}`);
        }
    }

    // --- Final Scoring & Determination ---
    const clampedScore = Math.max(0, Math.min(100, score));

    let isEligible: boolean | 'maybe' = false;
    let reason = '';

    if (clampedScore >= 65) {
        isEligible = true;
        if (matchedCriteria.length > 0) {
            reason = `Anda layak berdasarkan: ${matchedCriteria.slice(0, 2).join(', ')}.`;
        } else {
            reason = 'Profil anda memenuhi kriteria utama program ini.';
        }
    } else if (clampedScore >= 45) {
        isEligible = 'maybe';
        if (missingCriteria.length > 0) {
            reason = `Perlu semakan lanjut. ${missingCriteria[0]}.`;
        } else {
            reason = 'Syarat permohonan bergantung kepada dokumen sokongan dan semakan agensi.';
        }
    } else {
        isEligible = false;
        if (missingCriteria.length > 0) {
            reason = `Tidak layak: ${missingCriteria.join('. ')}.`;
        } else {
            reason = 'Profil anda tidak memenuhi kriteria kelayakan program ini.';
        }
    }

    return {
        id: program.id,
        isEligible,
        matchScore: clampedScore,
        reason,
        matchedCriteria,
        missingCriteria,
    };
}

/**
 * Evaluates multiple programs in parallel instantly.
 */
export function evaluateAllEligibility(profile: UserProfile, programs: AidProgram[]): Record<string, EligibilityResult> {
    const results: Record<string, EligibilityResult> = {};
    for (const prog of programs) {
        results[prog.id] = evaluateEligibility(profile, prog);
    }
    return results;
}
