/**
 * NADI Dialect Engine — TypeScript Port (Cloud-Native)
 * ====================================================
 * Replaces the Python microservice (localhost:8100) with a native Next.js
 * module that runs directly on Vercel. No Python runtime needed.
 *
 * Data Sources:
 *   1. seed_lexicon.json — Static dialect dictionary (committed in repo)
 *   2. nadi_dialect_feedback table — Crowdsourced citizen corrections (Supabase)
 *
 * Ported from dialect-engine/engine.py
 */

import { createClient } from '@supabase/supabase-js';
import { normalizePhonetic, computeSimilarity } from './phonetics';
import seedData from '@/src/data/seed_lexicon.json';

const THRESHOLD = 0.65;

// Lazy-init Supabase admin client (only created when first needed)
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

// ===== Seed Lexicon Cache =====
let seed: Record<string, string> | null = null;

function seedMappings(): Record<string, string> {
  if (seed) return seed;
  const m: Record<string, string> = {};
  const dialectMap = (seedData as { dialect_map?: Record<string, Record<string, string>> }).dialect_map ?? {};
  for (const words of Object.values(dialectMap)) {
    for (const [d, s] of Object.entries(words)) {
      m[d.toLowerCase()] = (s as string).toLowerCase();
    }
  }
  seed = m;
  return m;
}

// ===== Learned Mappings Cache (60-second TTL) =====
let learnedCache: {
  at: number;
  rows: { dialect_text: string; correct_meaning: string; region: string }[];
} | null = null;

async function getLearned() {
  if (learnedCache && Date.now() - learnedCache.at < 60_000) return learnedCache.rows;
  const supabase = getSupabase();
  if (!supabase) {
    learnedCache = { at: Date.now(), rows: [] };
    return learnedCache.rows;
  }
  try {
    const { data } = await supabase
      .from('nadi_dialect_feedback')
      .select('dialect_text, correct_meaning, region')
      .not('correct_meaning', 'is', null);
    learnedCache = { at: Date.now(), rows: data ?? [] };
  } catch {
    learnedCache = { at: Date.now(), rows: [] }; // DB optional — seed still works
  }
  return learnedCache.rows;
}

/**
 * Build complete dialect → standard mapping from seed + learned corrections.
 */
export async function allMappings(): Promise<Record<string, string>> {
  const m = { ...seedMappings() };
  for (const r of await getLearned()) {
    if (r.dialect_text && r.correct_meaning) {
      m[r.dialect_text.toLowerCase().trim()] = r.correct_meaning.toLowerCase().trim();
    }
  }
  return m;
}

/**
 * Build variant clusters: standard word → set of known dialect variants.
 */
function clustersOf(m: Record<string, string>): Record<string, string[]> {
  const c: Record<string, Set<string>> = {};
  for (const [d, s] of Object.entries(m)) {
    (c[s] ??= new Set()).add(d);
    c[s].add(s);
  }
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, [...v].sort()]));
}

// ===== Lookup Result Interface =====
export interface LookupResult {
  input: string;
  standard: string;
  normalized?: string;
  variants?: string[];
  confidence: string;
  matched_via?: string;
  score?: number;
}

/**
 * Look up a single dialect word and return its standard Malay equivalent.
 * Three-tier resolution: direct match → phonetic match → fuzzy match.
 */
export async function lookup(wordRaw: string): Promise<LookupResult | null> {
  const word = wordRaw.toLowerCase().trim();
  const m = await allMappings();
  const clusters = clustersOf(m);

  // Tier 1: Direct match (O(1))
  if (m[word]) {
    return {
      input: word, standard: m[word], normalized: normalizePhonetic(word),
      variants: clusters[m[word]], confidence: 'high',
    };
  }

  // Tier 2: Phonetic normalization match (O(1))
  const normalized = normalizePhonetic(word);
  if (m[normalized]) {
    return {
      input: word, standard: m[normalized], normalized,
      variants: clusters[m[normalized]], confidence: 'medium',
    };
  }

  // Tier 3: Fuzzy match with consonant skeleton pre-filtering
  let best: LookupResult | null = null;
  let bestScore = 0;
  for (const [known, standard] of Object.entries(m)) {
    const score = computeSimilarity(word, known);
    if (score > bestScore && score > THRESHOLD) {
      bestScore = score;
      best = {
        input: word, standard, normalized, matched_via: known,
        variants: clusters[standard], confidence: 'fuzzy', score,
      };
    }
  }
  return best;
}

/**
 * Translate an entire phrase word-by-word using the dialect engine.
 */
export async function translatePhrase(text: string) {
  const words = text.toLowerCase().trim().split(/\s+/);
  const per_word: LookupResult[] = [];
  const translated: string[] = [];
  const unknown_words: string[] = [];

  for (const w of words) {
    const r = await lookup(w);
    if (r) {
      per_word.push(r);
      translated.push(r.standard);
    } else {
      per_word.push({ input: w, standard: w, confidence: 'unknown' });
      translated.push(w);
      unknown_words.push(w);
    }
  }

  return {
    original: text,
    translated: translated.join(' '),
    per_word,
    unknown_words,
    coverage: Math.round((1 - unknown_words.length / Math.max(words.length, 1)) * 100) / 100,
  };
}

/**
 * Export all dialect→standard mappings as a compact string for AI prompt enrichment.
 * This is the function that powers SUARA and Chatbot dialect context injection.
 */
export async function exportForPrompt(): Promise<string> {
  const m = await allMappings();
  return Object.entries(m)
    .filter(([d, s]) => d !== s)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([d, s]) => `${d}=${s}`)
    .join(', ');
}

/**
 * Record a citizen correction (RLHF feedback loop).
 * Persists to Supabase and invalidates the learned cache.
 */
export async function addCorrection(
  dialectText: string,
  correctMeaning: string,
  region = 'kelantan'
) {
  const dialect = dialectText.toLowerCase().trim();
  const standard = correctMeaning.toLowerCase().trim();
  const dw = dialect.split(/\s+/);
  const sw = standard.split(/\s+/);
  const new_mappings: { dialect_text: string; correct_meaning: string; region: string }[] = [
    { dialect_text: dialect, correct_meaning: standard, region },
  ];

  // If word counts match, also learn individual word pairs
  if (dw.length === sw.length) {
    for (let i = 0; i < dw.length; i++) {
      if (dw[i] !== sw[i]) {
        new_mappings.push({ dialect_text: dw[i], correct_meaning: sw[i], region });
      }
    }
  }

  const supabase = getSupabase();
  if (supabase) {
    await supabase.from('nadi_dialect_feedback').insert(new_mappings);
  }

  learnedCache = null; // Invalidate cache so next lookup picks up new data
  return { status: 'learned', new_mappings };
}
