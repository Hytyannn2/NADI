/**
 * Malay Dialect Phonetic Normalizer
 *
 * Converts dialect spellings into normalized phonetic forms to help match variants.
 * Example: "ghaso" -> "raso" -> "rasa"
 */

// Phonetic transformation rules applied in sequential order
const RULES: [string, string][] = [
  // Kelantanese aspirated 'r' variants
  ['gh', 'r'], ['^rh', 'r'],
  // Initial doubled consonants
  ['^bb', 'b'], ['^cc', 'c'], ['^dd', 'd'], ['^gg', 'g'], ['^jj', 'j'],
  ['^kk', 'k'], ['^ll', 'l'], ['^mm', 'm'], ['^nn', 'n'], ['^pp', 'p'],
  ['^ss', 's'], ['^tt', 't'],
  // Final vowel and nasal endings
  ['o$', 'a'], ['e$', 'a'], ['ang$', 'an'], ['eng$', 'en'],
  // Final consonants
  ['q$', 'k'], ['ih$', 'ir'], ['^si(?=k\\b)', 'ti'],
];

const COMPILED = RULES.map(([p, r]) => [new RegExp(p, 'g'), r] as const);

/**
 * Normalizes a dialect word closer to its standard Malay root.
 */
export function normalizePhonetic(word: string): string {
  let out = word.toLowerCase().trim();
  for (const [re, rep] of COMPILED) out = out.replace(re, rep);
  return out;
}

/**
 * Extracts consonants by stripping vowels and spaces.
 * In Malay dialects, vowels shift frequently while consonants tend to stay consistent.
 * Example: "gocoh" -> "gch", "kecek" -> "kck"
 */
export function extractConsonantSkeleton(word: string): string {
  return word.toLowerCase().trim().replace(/[aeiou\s]/g, '');
}

/**
 * Calculates Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  if (s1.length < s2.length) return levenshteinDistance(s2, s1);
  if (s2.length === 0) return s1.length;
  let prev = Array.from({ length: s2.length + 1 }, (_, i) => i);
  for (let i = 0; i < s1.length; i++) {
    const curr = [i + 1];
    for (let j = 0; j < s2.length; j++)
      curr.push(Math.min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (s1[i] === s2[j] ? 0 : 1)));
    prev = curr;
  }
  return prev[prev.length - 1];
}

/**
 * Calculates similarity (0.0 to 1.0) using 50% consonant skeleton match and 50% Levenshtein ratio.
 */
export function computeSimilarity(w1: string, w2: string): number {
  const n1 = normalizePhonetic(w1), n2 = normalizePhonetic(w2);
  if (n1 === n2) return 1.0;
  const skel = extractConsonantSkeleton(n1) === extractConsonantSkeleton(n2) ? 1.0 : 0.0;
  const lev = 1 - levenshteinDistance(n1, n2) / Math.max(n1.length, n2.length, 1);
  return Math.round((skel * 0.5 + lev * 0.5) * 1000) / 1000;
}

