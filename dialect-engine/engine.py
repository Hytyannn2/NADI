"""
NADI Dialect Engine — Core Engine
==================================
Manages the dialect knowledge base:
- Loads seed lexicon
- Ingests user corrections (crowdsourced learning)
- Clusters variant spellings
- Exports lookup tables for the AI prompt enrichment

This is the brain that learns from user feedback.
"""

import json
import os
import time
from collections import defaultdict
from typing import Dict, List, Optional, Set, Tuple

from phonetics import (
    normalize_phonetic,
    extract_consonant_skeleton,
    compute_similarity,
    normalize_phrase,
)

# ===== Paths =====
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SEED_PATH = os.path.join(BASE_DIR, 'seed_lexicon.json')
LEARNED_PATH = os.path.join(BASE_DIR, 'learned_mappings.json')
CLUSTERS_PATH = os.path.join(BASE_DIR, 'clusters.json')
FEEDBACK_LOG_PATH = os.path.join(BASE_DIR, 'feedback_log.jsonl')

# Similarity threshold for auto-clustering
CLUSTER_THRESHOLD = 0.65


class DialectEngine:
    """
    The core dialect processing engine.
    
    Responsibilities:
    1. Maintain a dialect→standard mapping
    2. Cluster variant spellings together
    3. Learn from user corrections
    4. Provide lookup for AI prompt enrichment
    """
    
    def __init__(self):
        # dialect_word → standard_malay
        self.mappings: Dict[str, str] = {}
        
        # standard_word → set of dialect variants
        self.clusters: Dict[str, Set[str]] = defaultdict(set)
        
        # region → {dialect_word → standard}
        self.regional: Dict[str, Dict[str, str]] = {}
        
        # Track corrections for analysis
        self.correction_count = 0
        
        # Load data
        self._load_seed()
        self._load_learned()
        self._rebuild_clusters()
    
    def _load_seed(self):
        """Load the initial seed lexicon."""
        if not os.path.exists(SEED_PATH):
            print("[engine] No seed lexicon found, starting empty.")
            return
        
        with open(SEED_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        dialect_map = data.get('dialect_map', {})
        for region, words in dialect_map.items():
            self.regional[region] = {}
            for dialect_word, standard in words.items():
                self.mappings[dialect_word.lower()] = standard.lower()
                self.regional[region][dialect_word.lower()] = standard.lower()
        
        print(f"[engine] Loaded {len(self.mappings)} seed mappings across {len(self.regional)} regions.")
    
    def _load_learned(self):
        """Load user-contributed mappings."""
        if not os.path.exists(LEARNED_PATH):
            return
        
        with open(LEARNED_PATH, 'r', encoding='utf-8') as f:
            learned = json.load(f)
        
        count = 0
        for entry in learned:
            dialect = entry.get('dialect', '').lower().strip()
            standard = entry.get('standard', '').lower().strip()
            region = entry.get('region', 'unknown')
            
            if dialect and standard:
                self.mappings[dialect] = standard
                if region not in self.regional:
                    self.regional[region] = {}
                self.regional[region][dialect] = standard
                count += 1
        
        print(f"[engine] Loaded {count} learned mappings.")
    
    def _rebuild_clusters(self):
        """
        Rebuild variant clusters from all known mappings.
        Groups all dialect words that map to the same standard word.
        """
        self.clusters = defaultdict(set)
        
        for dialect, standard in self.mappings.items():
            self.clusters[standard].add(dialect)
            # Also add the standard word itself
            self.clusters[standard].add(standard)
        
        # Now try to merge clusters using phonetic similarity
        # Words that aren't in mappings but are phonetically close
        # to a known cluster get absorbed
        standards = list(self.clusters.keys())
        for i, s1 in enumerate(standards):
            for s2 in standards[i+1:]:
                if compute_similarity(s1, s2) > CLUSTER_THRESHOLD:
                    # Merge: keep the longer one as the canonical form
                    canonical = s1 if len(s1) >= len(s2) else s2
                    absorbed = s2 if canonical == s1 else s1
                    self.clusters[canonical] |= self.clusters[absorbed]
                    if absorbed in self.clusters:
                        del self.clusters[absorbed]
        
        print(f"[engine] Built {len(self.clusters)} dialect clusters.")
    
    def lookup(self, word: str) -> Optional[Dict]:
        """
        Look up a dialect word. Returns:
        - The standard Malay equivalent
        - All known variants in the same cluster
        - The phonetic normalized form
        """
        word = word.lower().strip()
        
        # Direct lookup
        if word in self.mappings:
            standard = self.mappings[word]
            variants = list(self.clusters.get(standard, {word}))
            return {
                'input': word,
                'standard': standard,
                'normalized': normalize_phonetic(word),
                'variants': sorted(variants),
                'confidence': 'high',
            }
        
        # Try phonetic normalization
        normalized = normalize_phonetic(word)
        if normalized in self.mappings:
            standard = self.mappings[normalized]
            variants = list(self.clusters.get(standard, {normalized}))
            return {
                'input': word,
                'standard': standard,
                'normalized': normalized,
                'variants': sorted(variants),
                'confidence': 'medium',
            }
        
        # Try fuzzy matching against known words
        best_match = None
        best_score = 0.0
        
        for known_word, standard in self.mappings.items():
            score = compute_similarity(word, known_word)
            if score > best_score and score > CLUSTER_THRESHOLD:
                best_score = score
                best_match = {
                    'input': word,
                    'standard': standard,
                    'normalized': normalized,
                    'matched_via': known_word,
                    'variants': sorted(list(self.clusters.get(standard, set()))),
                    'confidence': 'fuzzy',
                    'score': best_score,
                }
        
        return best_match
    
    def translate_phrase(self, text: str) -> Dict:
        """
        Attempt to translate a full dialect phrase to Standard Malay.
        Returns per-word translations and the full translated phrase.
        """
        words = text.lower().strip().split()
        translations = []
        translated_words = []
        unknown_words = []
        
        for word in words:
            result = self.lookup(word)
            if result:
                translations.append(result)
                translated_words.append(result['standard'])
            else:
                translations.append({
                    'input': word,
                    'standard': word,  # keep as-is
                    'confidence': 'unknown',
                })
                translated_words.append(word)
                unknown_words.append(word)
        
        return {
            'original': text,
            'translated': ' '.join(translated_words),
            'per_word': translations,
            'unknown_words': unknown_words,
            'coverage': round(1 - len(unknown_words) / max(len(words), 1), 2),
        }
    
    def add_correction(self, dialect_text: str, correct_meaning: str,
                       region: str = 'unknown', raw_voice: str = '') -> Dict:
        """
        Process a user correction:
        1. Add the new dialect→standard mapping
        2. Try to cluster with existing variants
        3. Log the feedback
        4. Persist the learned mapping
        """
        dialect = dialect_text.lower().strip()
        standard = correct_meaning.lower().strip()
        
        # Handle multi-word corrections
        dialect_words = dialect.split()
        standard_words = standard.split()
        
        new_mappings = []
        
        if len(dialect_words) == 1 and len(standard_words) == 1:
            # Single word correction — add directly
            self.mappings[dialect] = standard
            self.clusters[standard].add(dialect)
            self.clusters[standard].add(standard)
            new_mappings.append({'dialect': dialect, 'standard': standard})
            
            # Try to find and absorb phonetically similar unknowns
            self._try_absorb_similar(dialect, standard)
        else:
            # Multi-word: add the full phrase mapping
            self.mappings[dialect] = standard
            new_mappings.append({'dialect': dialect, 'standard': standard})
            
            # Also try word-level alignment if counts match
            if len(dialect_words) == len(standard_words):
                for dw, sw in zip(dialect_words, standard_words):
                    if dw != sw:
                        self.mappings[dw] = sw
                        self.clusters[sw].add(dw)
                        new_mappings.append({'dialect': dw, 'standard': sw})
        
        # Add to regional map
        if region not in self.regional:
            self.regional[region] = {}
        self.regional[region][dialect] = standard
        
        # Log feedback
        self._log_feedback(dialect_text, correct_meaning, region, raw_voice)
        
        # Persist
        self._save_learned(new_mappings)
        self.correction_count += 1
        
        # Rebuild clusters periodically (every 10 corrections)
        if self.correction_count % 10 == 0:
            self._rebuild_clusters()
        
        return {
            'status': 'learned',
            'new_mappings': new_mappings,
            'total_mappings': len(self.mappings),
            'total_clusters': len(self.clusters),
        }
    
    def _try_absorb_similar(self, new_word: str, standard: str):
        """
        When a new word is added, check if any existing words
        in other clusters are phonetically similar. If so, suggest
        a merge (but don't auto-merge to avoid errors).
        """
        normalized = normalize_phonetic(new_word)
        for existing_word, existing_standard in list(self.mappings.items()):
            if existing_word == new_word:
                continue
            
            existing_norm = normalize_phonetic(existing_word)
            if existing_norm == normalized and existing_standard != standard:
                # These normalize to the same form but map to different standards
                # Log for review rather than auto-merging
                print(f"[engine] CONFLICT: '{new_word}'->'{standard}' vs "
                      f"'{existing_word}'->'{existing_standard}' "
                      f"(both normalize to '{normalized}')")
    
    def _log_feedback(self, dialect: str, standard: str,
                      region: str, raw_voice: str):
        """Append to the feedback log (JSONL format)."""
        entry = {
            'dialect': dialect,
            'standard': standard,
            'region': region,
            'raw_voice': raw_voice,
            'timestamp': time.time(),
        }
        with open(FEEDBACK_LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    
    def _save_learned(self, new_mappings: List[Dict]):
        """Persist learned mappings to disk."""
        existing = []
        if os.path.exists(LEARNED_PATH):
            with open(LEARNED_PATH, 'r', encoding='utf-8') as f:
                existing = json.load(f)
        
        existing.extend(new_mappings)
        
        with open(LEARNED_PATH, 'w', encoding='utf-8') as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)
    
    def export_for_prompt(self, region: str = None) -> str:
        """
        Export the dialect knowledge as a compact string
        suitable for injecting into an AI prompt.
        
        Format: "ghaso=rasa, raso=rasa, make=makan, ..."
        """
        if region and region in self.regional:
            mappings = self.regional[region]
        else:
            mappings = self.mappings
        
        # Sort by standard word for readability
        pairs = sorted(mappings.items(), key=lambda x: x[1])
        
        # Format compactly
        lines = [f"{d}={s}" for d, s in pairs if d != s]
        return ', '.join(lines)
    
    def export_clusters_json(self) -> Dict:
        """Export all clusters as a JSON-serializable dict."""
        return {
            standard: sorted(list(variants))
            for standard, variants in self.clusters.items()
        }
    
    def get_stats(self) -> Dict:
        """Return engine statistics."""
        return {
            'total_mappings': len(self.mappings),
            'total_clusters': len(self.clusters),
            'regions': list(self.regional.keys()),
            'corrections_this_session': self.correction_count,
            'largest_cluster': max(
                ((k, len(v)) for k, v in self.clusters.items()),
                key=lambda x: x[1],
                default=('none', 0)
            ),
        }


# ===== Testing =====
if __name__ == '__main__':
    engine = DialectEngine()
    
    print("\n" + "=" * 60)
    print("NADI Dialect Engine -- Test Run")
    print("=" * 60)
    
    # Stats
    stats = engine.get_stats()
    print(f"\n[stats] {stats['total_mappings']} mappings, "
          f"{stats['total_clusters']} clusters, "
          f"{len(stats['regions'])} regions")
    
    # Test lookups
    test_words = ['ghaso', 'raso', 'make', 'gapo', 'ambo', 'tubik', 'oghe',
                  'kitak', 'kamek', 'bekwoh', 'ggocoh', 'hungga', 'guano']
    print(f"\n[lookups]")
    for word in test_words:
        result = engine.lookup(word)
        if result:
            print(f"  {word:12} -> {result['standard']:12} "
                  f"(confidence: {result['confidence']}, "
                  f"variants: {len(result.get('variants', []))})")
        else:
            print(f"  {word:12} -> ???  (unknown)")
    
    # Test phrase translation
    phrases = [
        "ambo nok make ghaso pedah",
        "gapo demo kijo hari ni",
        "bakpo jjale beso tu rosak",
        "hungga tubik ghuma guano",
    ]
    print(f"\n[phrases]")
    for phrase in phrases:
        result = engine.translate_phrase(phrase)
        print(f"\n  Dialect:  {result['original']}")
        print(f"  Standard: {result['translated']}")
        print(f"  Coverage: {result['coverage']*100:.0f}%")
    
    # Test adding a correction
    print(f"\n[correction] Simulating user correction:")
    correction = engine.add_correction(
        dialect_text='nok ghoyak gapo',
        correct_meaning='hendak cakap apa',
        region='kelantan',
        raw_voice='nok royak gapo',
    )
    print(f"  Result: {correction['status']}")
    print(f"  New mappings: {correction['new_mappings']}")
    print(f"  Total: {correction['total_mappings']} mappings")
    
    # Export for prompt
    print(f"\n[prompt] Kelantan context (first 200 chars):")
    prompt_ctx = engine.export_for_prompt('kelantan')
    print(f"  {prompt_ctx[:200]}...")
