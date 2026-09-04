/**
 * Civic Fuzzy Search Engine
 * 
 * Provides typo-tolerant search and acronym normalization for Malaysian civic places,
 * schools, mosques, emergency facilities, and districts. Includes Levenshtein distance matching,
 * token overlap scoring, and Fuse.js integration helpers.
 */
import Fuse from 'fuse.js';

// In-memory memoization cache for normalized text strings
const normCache = new Map<string, string>();
const MAX_CACHE_SIZE = 2000;

/**
 * Standardizes search text, acronyms, and geographical prefixes into a uniform search key.
 * Cached to avoid re-running regexes on identical terms.
 */
export function normalizeCivicSearch(text: string | null | undefined): string {
    if (!text) return '';

    const cached = normCache.get(text);
    if (cached !== undefined) return cached;

    let s = text.toLowerCase();

    // 1. Dotted and spaced acronyms (before punctuation removal)
    s = s.replace(/\bs\s*\.\s*m\s*\.\s*k\s*\.?/gi, 'smk ');
    s = s.replace(/\bs\s*\.\s*j\s*\.\s*k\s*\.?/gi, 'sjk ');
    s = s.replace(/\bs\s*\.\s*m\s*\.\s*a\s*\.?/gi, 'sma ');
    s = s.replace(/\bs\s*\.\s*m\s*\.\s*u\s*(?:\(?\s*a\s*\)?)?/gi, 'sma ');
    s = s.replace(/\bs\s*\.\s*m\s*\.\s*agama\b/gi, 'sma ');
    s = s.replace(/\bs\s*\.\s*k\s*\.?/gi, 'sk ');

    // 2. Punctuation and special characters
    s = s.replace(/['"’`]/g, '');
    s = s.replace(/[^a-z0-9\s]/g, ' ');

    // 3. Spaced letters (e.g. "s k" -> "sk")
    s = s.replace(/\b(?:s\s+m\s+k)\b/g, 'smk');
    s = s.replace(/\b(?:s\s+j\s+k)\b/g, 'sjk');
    s = s.replace(/\b(?:s\s+m\s+a)\b/g, 'sma');
    s = s.replace(/\b(?:s\s+m\s+u)\b/g, 'sma');
    s = s.replace(/\b(?:s\s+m\s+agama)\b/g, 'sma');
    s = s.replace(/\b(?:s\s+k)\b/g, 'sk');

    // 4. Educational & School Synonyms
    // SJK(C) / SJK(T)
    s = s.replace(/\b(?:sekolah\s*jenis\s*kebangsaan\s*cina|sekolah\s*jenis\s*kebangsaan|sek\s*jenis\s*keb|srjk\s*c|sjk\s*c|srjkc|sjkc|srjk|sjk)\b/g, 'sjk');
    s = s.replace(/\b(?:sekolah\s*jenis\s*kebangsaan\s*tamil|srjk\s*t|sjk\s*t|srjkt|sjkt)\b/g, 'sjkt');
    
    // SMA / SMU(A)
    s = s.replace(/\b(?:sekolah\s*menengah\s*ugama\s*arab|sekolah\s*menengah\s*ugama|sekolah\s*menengah\s*agama|sek\s*men\s*agama|sek\s*men\s*ugama|smu\s*a|smua|sma|smu|sek\s*arab|sekolah\s*arab)\b/g, 'sma');

    // SMK
    s = s.replace(/\b(?:sekolah\s*menengah\s*kebangsaan|sekolah\s*menengah|sek\s*men\s*keb|sek\s*men|smk|sm)\b/g, 'smk');
    
    // SK (Sekolah Kebangsaan)
    s = s.replace(/\b(?:sekolah\s*kebangsaan|sek\s*keb|sk)\b/g, 'sk');

    // Religious / Madrasah / Pondok
    s = s.replace(/\b(?:maahad|mahad|pondok|madrasah|balaisah)\b/g, 'madrasah');

    // Tadika / Tabika / KEMAS / Taska / PASTI
    s = s.replace(/\b(?:tabika\s*kemas|tadika\s*kemas|tabika|tadika|taska|pasti)\b/g, 'tadika');

    // Maktab / MRSM / Kolej
    s = s.replace(/\b(?:maktab\s*rendah\s*sains\s*mara|mrsm)\b/g, 'mrsm');
    s = s.replace(/\b(?:maktab|kolej)\b/g, 'kolej');

    // 5. Emergency, Health & Civic Facilities
    // Evacuation shelter synonyms
    s = s.replace(/\b(?:pusat\s*pemindahan(?:\s*sementara)?|tempat\s*pindah|evacuation\s*centre|evacuation\s*center|shelter|tempat\s*perlindungan|pusat\s*perlindungan|pps)\b/g, 'pps');

    // Hospitals & Clinics
    s = s.replace(/\b(?:hospital|hosp|klinik\s*kesihatan|klinik|poliklinik|kk|kkm)\b/g, 'klinik');
    // Police stations
    s = s.replace(/\b(?:ibu\s*pejabat\s*polis\s*daerah|ibu\s*pejabat\s*polis\s*kontinjen|balai\s*polis|pondok\s*polis|ipd|ipk|pdrm|polis)\b/g, 'polis');
    // Fire & Rescue
    s = s.replace(/\b(?:balai\s*bomba\s*dan\s*penyelamat|balai\s*bomba|jbpm|bomba)\b/g, 'bomba');
    // Civil Defence & RELA
    s = s.replace(/\b(?:angkatan\s*pertahanan\s*awam|pertahanan\s*awam|apm|rela)\b/g, 'apm');
    // Land & District Offices
    s = s.replace(/\b(?:pejabat\s*tanah\s*dan\s*jajahan|pejabat\s*tanah|pejabat\s*daerah|majlis\s*daerah|ptd|pbt)\b/g, 'pejabat');
    // Bus terminals
    s = s.replace(/\b(?:terminal\s*bas|stesen\s*bas|hentian\s*bas|terminal)\b/g, 'terminal');

    // Community halls & KRT
    s = s.replace(/\b(?:balairaya|balai\s*raya|balai\s*komuniti)\b/g, 'balairaya');
    s = s.replace(/\b(?:kawasan\s*rukun\s*tetangga|rukun\s*tetangga|krt)\b/g, 'krt');
    s = s.replace(/\b(?:balai\s*penghulu|balai\s*penggawa|pejabat\s*penggawa|penggawa)\b/g, 'penggawa');

    // Multi-purpose halls & sports complexes
    s = s.replace(/\b(?:dewan\s*orang\s*ramai|dewan\s*serbaguna|dewan\s*masyarakat|dewan\s*sivik|dewan)\b/g, 'dewan');
    s = s.replace(/\b(?:kompleks\s*sukan|kompleks\s*komuniti|kompleks)\b/g, 'kompleks');

    // Mosques & Surau
    s = s.replace(/\b(?:masjid\s*mukim|masjid\s*kariah|masjid\s*jamek|masjid\s*bandar|masjid)\b/g, 'masjid');
    s = s.replace(/\b(?:surau\s*diri\s*jumaat|musolla|musalla|surau)\b/g, 'surau');

    // Capacity & status keywords
    s = s.replace(/\b(?:kapasiti|capacity|muat|boleh\s*tampung)\b/g, 'kapasiti');
    s = s.replace(/\b(?:aktif|active|buka|open)\b/g, 'aktif');
    s = s.replace(/\b(?:ditutup|closed|tutup|inactive)\b/g, 'ditutup');

    // Accessibility & facility filters
    s = s.replace(/\b(?:oku|disabled|kerusi\s*roda|wheelchair|accessible)\b/g, 'oku');
    s = s.replace(/\b(?:dapur|kitchen|masak)\b/g, 'dapur');
    s = s.replace(/\b(?:bilik\s*air|toilet|tandas|wc)\b/g, 'tandas');
    s = s.replace(/\b(?:parking|tempat\s*letak)\b/g, 'parking');

    // 6. Kelantan 10 Administrative Districts (Jajahan)
    s = s.replace(/\b(?:kota\s*bharu|kb|kota\s*bahru)\b/g, 'kota bharu');
    s = s.replace(/\b(?:pasir\s*mas|psr\s*mas)\b/g, 'pasir mas');
    s = s.replace(/\b(?:tumpat|tpt)\b/g, 'tumpat');
    s = s.replace(/\b(?:bachok|bck)\b/g, 'bachok');
    s = s.replace(/\b(?:machang|mch)\b/g, 'machang');
    s = s.replace(/\b(?:tanah\s*merah|tmh)\b/g, 'tanah merah');
    s = s.replace(/\b(?:gua\s*musang|gmg|g\s*musang)\b/g, 'gua musang');
    s = s.replace(/\b(?:kuala\s*krai|k\s*kra|k\s*krai)\b/g, 'kuala krai');
    s = s.replace(/\b(?:jeli|jli)\b/g, 'jeli');
    s = s.replace(/\b(?:pasir\s*puteh|pph|p\s*puteh)\b/g, 'pasir puteh');

    // 7. Geographical & Toponym Prefixes
    s = s.replace(/\b(?:kampung|kampong|kg|kpg)\b/g, 'kg');
    s = s.replace(/\b(?:mukim|mkm)\b/g, 'mukim');
    s = s.replace(/\b(?:taman\s*perumahan|tmn|taman)\b/g, 'taman');
    s = s.replace(/\b(?:bandar|bdr)\b/g, 'bandar');
    s = s.replace(/\b(?:pekan|pkn)\b/g, 'pekan');
    s = s.replace(/\b(?:jalan|jln|lorong|lrg)\b/g, 'jalan');
    s = s.replace(/\b(?:simpang|spg)\b/g, 'simpang');
    s = s.replace(/\b(?:sungai|sg)\b/g, 'sungai');
    s = s.replace(/\b(?:tanjung|tanjong|tj|tjg)\b/g, 'tanjung');
    s = s.replace(/\b(?:kuala|kla)\b/g, 'kuala');
    s = s.replace(/\b(?:bukit|bkt)\b/g, 'bukit');
    s = s.replace(/\b(?:padang|pdg)\b/g, 'padang');
    s = s.replace(/\b(?:teluk|telok)\b/g, 'teluk');
    s = s.replace(/\b(?:hulu|ulu)\b/g, 'hulu');
    s = s.replace(/\b(?:pengkalan|pangkalan|pgk)\b/g, 'pengkalan');
    s = s.replace(/\b(?:wakaf|waqaf|wkf)\b/g, 'wakaf');
    s = s.replace(/\b(?:lubok|lubuk)\b/g, 'lubuk');
    s = s.replace(/\b(?:pasir|psr)\b/g, 'pasir');
    s = s.replace(/\b(?:kubang|kbg)\b/g, 'kubang');
    s = s.replace(/\b(?:panchor|pancur)\b/g, 'pancur');
    s = s.replace(/\b(?:kubor|kubur)\b/g, 'kubur');
    s = s.replace(/\b(?:tumboh|tumbuh)\b/g, 'tumbuh');
    s = s.replace(/\b(?:stesen\s*keretapi|stesen\s*ktmb|ktmb)\b/g, 'ktmb');

    // 8. Collapse extra whitespace and trim
    const result = s.replace(/\s+/g, ' ').trim();

    // Cache management
    if (normCache.size >= MAX_CACHE_SIZE) {
        normCache.clear();
    }
    normCache.set(text, result);

    return result;
}

/**
 * Computes Levenshtein distance between two strings for typo tolerance.
 */
export function levenshteinDistance(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Checks if query is a consonant shorthand or subsequence of target (e.g. "isml" in "ismail").
 */
function isSubsequence(sub: string, target: string): boolean {
    if (sub.length < 3 || target.length < sub.length) return false;
    let i = 0;
    for (let j = 0; j < target.length && i < sub.length; j++) {
        if (sub[i] === target[j]) i++;
    }
    return i === sub.length;
}

/**
 * Checks if a token matches via exact prefix, consonant shorthand, or Levenshtein distance.
 */
function isTokenFuzzyMatched(token: string, targetTokens: string[]): boolean {
    if (token.length <= 2) {
        return targetTokens.some(t => t === token || t.startsWith(token));
    }

    const maxAllowedDistance = token.length >= 7 ? 2 : 1;

    return targetTokens.some(t => {
        // Exact match or prefix match
        if (t === token || t.startsWith(token)) return true;

        // Consonant shorthand match (e.g. "isml" -> "ismail", "sultn" -> "sultan")
        if (token.length >= 4 && isSubsequence(token, t)) return true;

        // Target contains query token
        if (t.length >= token.length + 2 && t.includes(token)) return true;

        // Levenshtein typo distance for words of similar length
        if (Math.abs(t.length - token.length) <= maxAllowedDistance) {
            return levenshteinDistance(token, t) <= maxAllowedDistance;
        }

        return false;
    });
}

/**
 * Checks if a search query matches target fields using token overlap and typo tolerance.
 * 
 * @param query User search input (e.g. "sekolah kta")
 * @param targetFields Array of target strings (e.g. [name, district, type])
 * @param threshold Minimum fraction of matched tokens required (default: 0.65)
 */
export function matchCivicSearch(
    query: string | null | undefined, 
    targetFields: (string | number | undefined | null)[],
    threshold: number = 0.65
): boolean {
    if (!query || !query.trim()) return true;

    const normalizedQuery = normalizeCivicSearch(query);
    if (!normalizedQuery) return true;

    const queryTokens = normalizedQuery.split(' ').filter(Boolean);
    if (queryTokens.length === 0) return true;

    const combinedTarget = targetFields
        .filter((f): f is string | number => f !== undefined && f !== null && f !== '')
        .map(f => String(f))
        .join(' ');

    const normalizedTarget = normalizeCivicSearch(combinedTarget);

    // Fast path: Exact substring match
    if (normalizedTarget.includes(normalizedQuery)) {
        return true;
    }

    const targetTokens = normalizedTarget.split(' ').filter(Boolean);

    // Count matched tokens (exact, substring, or typo distance)
    let matchedCount = 0;
    for (const qToken of queryTokens) {
        if (isTokenFuzzyMatched(qToken, targetTokens)) {
            matchedCount++;
        }
    }

    // Single-token queries require at least one match
    if (queryTokens.length === 1) {
        return matchedCount > 0;
    }

    // Multi-token queries evaluate against match ratio threshold
    return (matchedCount / queryTokens.length) >= threshold;
}

/**
 * Calculates search relevance score (higher values indicate closer matches).
 * Combines exact hits, prefixes, and token coverage.
 */
export function scoreCivicSearch(
    query: string | null | undefined,
    primaryField: string,
    secondaryFields: (string | number | undefined | null)[] = []
): number {
    if (!query || !query.trim()) return 0;

    const normalizedQuery = normalizeCivicSearch(query);
    if (!normalizedQuery) return 0;

    const normPrimary = normalizeCivicSearch(primaryField);
    const combinedSecondary = secondaryFields.map(f => String(f || '')).join(' ');
    const normSecondary = normalizeCivicSearch(combinedSecondary);

    let score = 0;

    // Exact full match on primary name
    if (normPrimary === normalizedQuery) {
        return 100;
    }
    if (normPrimary.startsWith(normalizedQuery)) {
        score += 60;
    } else if (normPrimary.includes(normalizedQuery)) {
        score += 40;
    }

    const queryTokens = normalizedQuery.split(' ').filter(Boolean);
    const primaryTokens = normPrimary.split(' ').filter(Boolean);
    const secondaryTokens = normSecondary.split(' ').filter(Boolean);

    queryTokens.forEach(token => {
        if (primaryTokens.some(t => t === token)) {
            score += 20;
        } else if (primaryTokens.some(t => t.startsWith(token))) {
            score += 15;
        } else if (isTokenFuzzyMatched(token, primaryTokens)) {
            score += 10;
        } else if (secondaryTokens.some(t => t === token)) {
            score += 8;
        } else if (isTokenFuzzyMatched(token, secondaryTokens)) {
            score += 5;
        }
    });

    return score;
}
