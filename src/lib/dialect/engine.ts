/**
 * Dialect Translation Engine
 *
 * Maps regional dialect words (e.g., Kelantanese Malay) to standard Malay using:
 * 1. seed_lexicon.json - Predefined dictionary in the repository
 * 2. nadi_dialect_feedback - Community corrections stored in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { normalizePhonetic, computeSimilarity } from './phonetics';
import seedData from '@/src/data/seed_lexicon.json';

const THRESHOLD = 0.65;

// Initializes the Supabase client only when database access is first needed
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

// In-memory cache for static seed dictionary
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

// In-memory cache for learned community mappings (refreshed every 60 seconds)
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
    learnedCache = { at: Date.now(), rows: [] }; // DB is optional; fallback to seed lexicon
  }
  return learnedCache.rows;
}

/**
 * Combines seed lexicon and learned corrections into a single mapping object.
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
 * Groups dialect variations under their respective standard word.
 */
function clustersOf(m: Record<string, string>): Record<string, string[]> {
  const c: Record<string, Set<string>> = {};
  for (const [d, s] of Object.entries(m)) {
    (c[s] ??= new Set()).add(d);
    c[s].add(s);
  }
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, [...v].sort()]));
}

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
 * Looks up a single dialect word using three tiers:
 * 1. Exact dictionary match
 * 2. Phonetic normalized match
 * 3. Fuzzy Levenshtein match
 */
export async function lookup(wordRaw: string): Promise<LookupResult | null> {
  const word = wordRaw.toLowerCase().trim();
  const m = await allMappings();
  const clusters = clustersOf(m);

  // Tier 1: Exact dictionary match
  if (m[word]) {
    return {
      input: word, standard: m[word], normalized: normalizePhonetic(word),
      variants: clusters[m[word]], confidence: 'high',
    };
  }

  // Tier 2: Phonetic normalized match
  const normalized = normalizePhonetic(word);
  if (m[normalized]) {
    return {
      input: word, standard: m[normalized], normalized,
      variants: clusters[m[normalized]], confidence: 'medium',
    };
  }

  // Tier 3: Fuzzy similarity matching
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
 * Translates a sentence word-by-word and returns translation coverage stats.
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
 * Serializes all dialect mappings into a key=value string to enrich LLM prompts.
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
 * Records a community translation correction to Supabase and clears the local cache.
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

  // If word counts match, also record individual word pairings
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

  learnedCache = null; // Clear cache so subsequent lookups include the new correction
  return { status: 'learned', new_mappings };
}

