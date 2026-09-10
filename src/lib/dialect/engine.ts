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

// Validation guards against prompt injection and untrusted crowd data
const VALID_DIALECT_TOKEN = /^[\p{L}\s'-]+$/u;
const FORBIDDEN_KEYWORDS = /(\bignore\b|\bsystem\b|\binstruction\b|\bprompt\b|\bbypass\b|\bjailbreak\b|\bassistant\b|\buser\b|\brule\b|\boverride\b|\bjson\b|<script|<xml|```)/i;

/**
 * Safely exports vetted dialect mappings as a validated key-value dictionary.
 * Rejects any mapping with invalid characters, prompt-injection patterns, or excessive length.
 * Caps at maximum `limit` entries to prevent context stuffing.
 */
export async function exportSafeDictionary(limit = 50): Promise<Record<string, string>> {
  const m = await allMappings();
  const safeEntries: [string, string][] = [];

  for (const [d, s] of Object.entries(m)) {
    if (d === s || !d || !s) continue;
    if (d.length > 35 || s.length > 40) continue;
    if (!VALID_DIALECT_TOKEN.test(d) || !VALID_DIALECT_TOKEN.test(s)) continue;
    if (FORBIDDEN_KEYWORDS.test(d) || FORBIDDEN_KEYWORDS.test(s)) continue;

    safeEntries.push([d, s]);
  }

  safeEntries.sort((a, b) => a[0].localeCompare(b[0]));
  return Object.fromEntries(safeEntries.slice(0, limit));
}

/**
 * Serializes vetted dialect mappings into a secure JSON string to enrich LLM prompts.
 */
export async function exportForPrompt(limit = 50): Promise<string> {
  const dict = await exportSafeDictionary(limit);
  if (Object.keys(dict).length === 0) return '';
  return JSON.stringify(dict);
}

/**
 * Records a community translation correction to Supabase with strict validation.
 */
export async function addCorrection(
  dialectText: string,
  correctMeaning: string,
  region = 'kelantan'
) {
  const dialect = dialectText.toLowerCase().trim();
  const standard = correctMeaning.toLowerCase().trim();

  // Tier 2 Ingest Validation
  if (dialect.length > 35 || standard.length > 40) {
    return { status: 'rejected', error: 'Exceeded length bounds (max 35-40 chars).' };
  }
  if (!VALID_DIALECT_TOKEN.test(dialect) || !VALID_DIALECT_TOKEN.test(standard)) {
    return { status: 'rejected', error: 'Contains forbidden characters.' };
  }
  if (FORBIDDEN_KEYWORDS.test(dialect) || FORBIDDEN_KEYWORDS.test(standard)) {
    return { status: 'rejected', error: 'Contains forbidden instruction keywords.' };
  }

  const dw = dialect.split(/\s+/);
  const sw = standard.split(/\s+/);
  const new_mappings: { dialect_text: string; correct_meaning: string; region: string }[] = [
    { dialect_text: dialect, correct_meaning: standard, region },
  ];

  // If word counts match, also record individual word pairings if they pass validation
  if (dw.length === sw.length) {
    for (let i = 0; i < dw.length; i++) {
      if (dw[i] !== sw[i] && VALID_DIALECT_TOKEN.test(dw[i]) && VALID_DIALECT_TOKEN.test(sw[i])) {
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

