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
    if (progName.includes('str') || progName.includes('sumbangan tunai rahmah') || progName.includes('bantuan tunai') || progElig.includes('rm5,000')) {
        incomeChecked = true;

        const isWargaEmas = age >= 60;
        const isOKU = status.includes('oku');
        const isPelajar = status.includes('pelajar');
        const isBujang = dependents === 0 && !status.includes('suri') && !status.includes('bekerja') ? false : (dependents === 0 && status !== 'Suri Rumah');

        if (isWargaEmas && dependents === 0) {
            // Category: Warga Emas Tiada Pasangan (60+ years, income <= RM5000)
            if (income <= 5000) {
                score += 45;
                matchedCriteria.push('Warga Emas Tiada Pasangan (RM600/tahun)');
            } else {
                score -= 40;
                missingCriteria.push('Pendapatan Warga Emas melebihi RM5,000');
            }
        } else if (dependents === 0 && !status.includes('suri')) {
            // Category: Bujang (21-59 yrs or OKU 19+, non-student, income <= RM2500)
            if (isPelajar) {
                score -= 50;
                missingCriteria.push('Bujang pelajar IPTA/IPTS sepenuh masa tidak layak');
            } else if ((age >= 21 && age <= 59) || (isOKU && age >= 19)) {
                if (income <= 2500) {
                    score += 45;
                    matchedCriteria.push('Kategori Bujang (RM600/tahun)');
                } else {
                    score -= 40;
                    missingCriteria.push('Pendapatan Bujang melebihi RM2,500');
                }
            } else if (age > 0 && age < 21 && !isOKU) {
                score -= 35;
                missingCriteria.push('Kategori Bujang terhad umur 21-59 tahun (19+ bagi OKU)');
            } else if (income <= 2500) {
                score += 35;
                matchedCriteria.push('Kategori Bujang');
            } else {
                score -= 35;
                missingCriteria.push('Pendapatan Bujang melebihi RM2,500');
            }
        } else {
            // Category: Isi Rumah (Household, income <= RM5000)
            if (income <= 5000) {
                score += 45;
                if (dependents > 0) {
                    matchedCriteria.push(`Isi Rumah (${dependents} anak: RM750 - RM2,500/tahun)`);
                } else {
                    matchedCriteria.push('Isi Rumah Tiada Anak (RM500 - RM1,000/tahun)');
                }
            } else {
                score -= 40;
                missingCriteria.push('Pendapatan Isi Rumah melebihi RM5,000');
            }
        }
    } else if (progName.includes('sara') || progName.includes('sumbangan asas rahmah') || progName.includes('bkm') || progName.includes('bantuan keluarga malaysia')) {
        incomeChecked = true;
        if (income <= 5000) {
            score += 40;
            matchedCriteria.push('Penerima STR / SARA (Kredit Barangan Asas MyKad RM1,200/tahun)');
        } else {
            score -= 40;
            missingCriteria.push('Terhad kepada penerima STR berpendapatan ≤ RM5,000');
        }
    } else if (progName.includes('bkk') || progName.includes('kanak-kanak')) {
        incomeChecked = true;
        if (dependents > 0 && income <= MISKIN_TEGAR_MAX) {
            score += 45;
            matchedCriteria.push(`Keluarga Miskin & Mempunyai Anak (${dependents} anak)`);
        } else if (dependents > 0) {
            score += 25;
            matchedCriteria.push('Mempunyai Anak di bawah 18 tahun');
        } else {
            score -= 40;
            missingCriteria.push('Khas untuk keluarga yang mempunyai anak di bawah 18 tahun');
        }
    } else if (progName.includes('bwe') || progName.includes('warga emas')) {
        incomeChecked = true;
        if (age >= 60 && income <= MISKIN_TEGAR_MAX) {
            score += 45;
            matchedCriteria.push('Warga Emas 60+ tanpa pendapatan (RM500/bulan)');
        } else if (age >= 60) {
            score += 25;
            matchedCriteria.push('Umur 60 tahun ke atas');
        } else {
            score -= 40;
            missingCriteria.push('Khas untuk warga emas berumur 60 tahun ke atas');
        }
    } else if (progName.includes('epoku')) {
        incomeChecked = true;
        if (status.includes('oku') && income >= 100 && income <= 1700) {
            score += 50;
            matchedCriteria.push('OKU Bekerja berpendapatan RM100 – RM1,700 (Elaun EPOKU RM450/bulan)');
        } else if (status.includes('oku')) {
            score += 25;
            matchedCriteria.push('Pemegang Kad OKU JKM Bekerja');
        } else {
            score -= 40;
            missingCriteria.push('Terhad untuk Pemegang Kad OKU yang bekerja (Pendapatan RM100-RM1,700)');
        }
    } else if (progName.includes('bpt') || progName.includes('penjagaan oku')) {
        incomeChecked = true;
        if (income <= 5000) {
            score += 45;
            matchedCriteria.push('Penjaga OKU / Pesakit Kronik Terlantar (Bantuan BPT RM500/bulan)');
        } else {
            score -= 40;
            missingCriteria.push('Pendapatan isi rumah melebihi had RM5,000');
        }
    } else if (progName.includes('btb')) {
        incomeChecked = true;
        if (status.includes('oku') && age >= 16 && age <= 59) {
            score += 50;
            matchedCriteria.push('OKU 16-59 thn Tidak Berupaya Kerja (Bantuan BTB RM300/bulan)');
        } else if (status.includes('oku')) {
            score += 30;
            matchedCriteria.push('Pemegang Kad OKU JKM');
        } else {
            score -= 40;
            missingCriteria.push('Terhad untuk Pemegang Kad OKU (16-59thn) yang tidak berupaya bekerja');
        }
    } else if (progName.includes('blp') || progName.includes('latihan perantis')) {
        incomeChecked = true;
        if (age >= 16 && age <= 35) {
            score += 45;
            matchedCriteria.push('Belia 16-35 thn menjalani latihan kemahiran (Elaun BLP RM200/bulan)');
        } else {
            score -= 30;
            missingCriteria.push('Terhad untuk belia berumur 16 hingga 35 tahun');
        }
    } else if (progName.includes('geran pelancaran') || progName.includes('gp')) {
        incomeChecked = true;
        if (income <= MISKIN_TEGAR_MAX) {
            score += 45;
            matchedCriteria.push('Kumpulan Sasar JKM B40/Miskin (Modal Perniagaan GP RM2,700)');
        } else if (income <= B40_MAX) {
            score += 25;
            matchedCriteria.push('Potensi Perniagaan Berdikari');
        } else {
            score -= 35;
            missingCriteria.push('Pendapatan melebihi had PGK Miskin');
        }
    } else if (progName.includes('alat tiruan') || progName.includes('bats')) {
        incomeChecked = true;
        if (status.includes('oku') || age >= 60 || income <= B40_MAX) {
            score += 45;
            matchedCriteria.push('Keperluan Alat Tiruan / Sokongan (Disyorkan Pakar)');
        } else {
            score -= 25;
            missingCriteria.push('Khas untuk OKU, Warga Emas & Kumpulan Sasar JKM');
        }
    } else if (progName.includes('tabung bantuan segera') || progName.includes('tbs')) {
        incomeChecked = true;
        if (income <= B40_MAX) {
            score += 45;
            matchedCriteria.push('Bantuan Kecemasan Serta-Merta / Terdampar (TBS RM300)');
        }
    } else if (progName.includes('maik') || progName.includes('dermasiswa') || progName.includes('biasiswa tengku anis') || progName.includes('rumah kediaman asnaf')) {
        incomeChecked = true;
        if (income <= B40_MAX) {
            score += 45;
            matchedCriteria.push('Anak Kelantan / Asnaf MAIK (Sistem eAgihan MAIK)');
        } else {
            score -= 30;
            missingCriteria.push('Khas untuk golongan Asnaf Kelantan mengikut Had Kifayah MAIK');
        }
    } else if (progName.includes('ekasih') || progElig.includes('miskin tegar') || progElig.includes('rm2,200') || progElig.includes('rm2200')) {
        incomeChecked = true;
        if (income <= MISKIN_TEGAR_MAX) {
            score += 40;
            matchedCriteria.push('Pendapatan bawah Garis Kemiskinan PGK DOSM 2024 (≤ RM2,208)');
        } else if (income <= B40_MAX) {
            score += 15;
            matchedCriteria.push('Golongan B40');
        } else {
            score -= 35;
            missingCriteria.push('Pendapatan melebihi Garis Kemiskinan PGK 2024');
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
        if (age >= 18) {
            score += 35;
            matchedCriteria.push('Warganegara 18+ thn (Gaji RM1,400 - RM2,000/bln)');
            if (status.includes('oku')) {
                score += 15;
                matchedCriteria.push('Kuota Khas 1% OKU MySTEP');
            }
        } else if (age > 0) {
            score -= 30;
            missingCriteria.push('Khas untuk warganegara berumur 18 tahun ke atas');
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
