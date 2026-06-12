"""
NADI Dialect Engine — Malay Phonetic Normalizer
================================================
Converts dialect-specific spellings to a normalized phonetic form
so that variant spellings can be clustered together.

Examples:
  ghaso → raso → rasa  (all normalize to "rasa")
  ambo → ambe          (both normalize to "amb_")
"""

import re
from typing import List, Tuple


# ===== Malay Dialect Phonetic Rules =====
# These rules transform dialect text toward Standard Malay.
# Applied in order — earlier rules take priority.

NORMALIZATION_RULES: List[Tuple[str, str, str]] = [
    # Kelantanese aspirated R variants
    (r'gh', 'r', 'Kelantanese gh→r'),
    (r'^rh', 'r', 'Kelantanese rh→r'),
    
    # Geminate (doubled) consonants at word start
    # Kelantanese dialect doubles initial consonants heavily
    (r'^bb', 'b', 'Geminate bb→b'),
    (r'^cc', 'c', 'Geminate cc→c'),
    (r'^dd', 'd', 'Geminate dd→d'),
    (r'^gg', 'g', 'Geminate gg→g'),
    (r'^jj', 'j', 'Geminate jj→j'),
    (r'^kk', 'k', 'Geminate kk→k'),
    (r'^ll', 'l', 'Geminate ll→l'),
    (r'^mm', 'm', 'Geminate mm→m'),
    (r'^nn', 'n', 'Geminate nn→n'),
    (r'^pp', 'p', 'Geminate pp→p'),
    (r'^ss', 's', 'Geminate ss→s'),
    (r'^tt', 't', 'Geminate tt→t'),
    
    # Terminal vowel shifts (dialect ending → standard)
    (r'o$', 'a', 'Terminal o→a'),
    (r'e$', 'a', 'Terminal e→a'),
    
    # Nasal shifts
    (r'ang$', 'an', 'Nasal -ang→-an'),
    (r'eng$', 'en', 'Nasal -eng→-en'),
    
    # Glottal stops written as q/k
    (r'q$', 'k', 'Glottal q→k'),
    
    # Common informal spellings
    (r'ih$', 'ir', 'Terminal -ih→-ir'),
    
    # Sabah/Sarawak specific
    (r'^si(?=k\b)', 'ti', 'Sarawak sik→tik negation'),
]


def normalize_phonetic(word: str) -> str:
    """
    Apply phonetic normalization rules to a single word.
    Returns the normalized form.
    """
    result = word.lower().strip()
    
    for pattern, replacement, _desc in NORMALIZATION_RULES:
        result = re.sub(pattern, replacement, result)
    
    return result


def extract_consonant_skeleton(word: str) -> str:
    """
    Extract the consonant skeleton of a word.
    This helps match words that differ only in vowels.
    
    Examples:
        rasa → rs
        ghaso → ghs  (before normalization)
        makan → mkn
        make → mk
    """
    return re.sub(r'[aeiou\s]', '', word.lower().strip())


def compute_similarity(word1: str, word2: str) -> float:
    """
    Compute similarity between two words using multiple signals:
    1. Normalized form match (highest weight)
    2. Consonant skeleton match
    3. Levenshtein ratio
    
    Returns a score between 0.0 and 1.0.
    """
    # Exact match after normalization
    norm1 = normalize_phonetic(word1)
    norm2 = normalize_phonetic(word2)
    
    if norm1 == norm2:
        return 1.0
    
    # Consonant skeleton match
    skel1 = extract_consonant_skeleton(norm1)
    skel2 = extract_consonant_skeleton(norm2)
    
    skeleton_match = 1.0 if skel1 == skel2 else 0.0
    
    # Levenshtein distance ratio
    lev_ratio = 1.0 - (levenshtein_distance(norm1, norm2) / max(len(norm1), len(norm2), 1))
    
    # Weighted combination
    # Skeleton match is very strong signal for Malay dialects
    # since dialects mostly differ in vowels
    score = (skeleton_match * 0.5) + (lev_ratio * 0.5)
    
    return round(score, 3)


def levenshtein_distance(s1: str, s2: str) -> int:
    """Classic Levenshtein edit distance."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    
    if len(s2) == 0:
        return len(s1)
    
    prev_row = list(range(len(s2) + 1))
    
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row
    
    return prev_row[-1]


def normalize_phrase(text: str) -> str:
    """
    Normalize an entire phrase/sentence by applying phonetic
    normalization to each word.
    """
    words = text.lower().strip().split()
    normalized = [normalize_phonetic(w) for w in words]
    return ' '.join(normalized)


# ===== Testing =====
if __name__ == '__main__':
    test_pairs = [
        ('ghaso', 'raso', 'rasa'),
        ('ghase', 'rase', 'rasa'),
        ('ambo', 'ambe', 'saya'),
        ('make', 'makan', 'makan'),
        ('gapo', 'ghapo', 'apa'),
        ('tubik', 'tubek', 'keluar'),
        ('oghe', 'ore', 'orang'),
        ('kijo', 'kije', 'kerja'),
        ('bakpo', 'bakpe', 'kenapa'),
        ('bbini', 'bini', 'berkahwin'),
        # New kamus entries — geminate + rh tests
        ('ggocoh', 'gocoh', 'bertumbuk'),
        ('nnawak', 'nawak', 'bohong'),
        ('ppala', 'pala', 'kepala'),
        ('rhoyat', 'royat', 'beritahu'),
        ('mmeda', 'meda', 'buang air'),
        ('ssong', 'song', 'sesuai'),
        ('kkecek', 'kecek', 'cakap'),
    ]
    
    print("=" * 60)
    print("NADI Dialect Phonetic Normalizer — Test Results")
    print("=" * 60)
    
    for w1, w2, standard in test_pairs:
        n1 = normalize_phonetic(w1)
        n2 = normalize_phonetic(w2)
        sim = compute_similarity(w1, w2)
        skel1 = extract_consonant_skeleton(w1)
        skel2 = extract_consonant_skeleton(w2)
        
        match = "OK" if n1 == n2 else "~"
        print(f"\n  {w1:12} -> {n1:12}  (skeleton: {skel1})")
        print(f"  {w2:12} -> {n2:12}  (skeleton: {skel2})")
        print(f"  Standard: {standard:12}  Similarity: {sim:.3f}  {match}")
    
    print("\n" + "=" * 60)
    
    # Test phrase normalization
    phrase = "ambo nok make ghaso pedah"
    print(f"\nPhrase: '{phrase}'")
    print(f"Normalized: '{normalize_phrase(phrase)}'")

    phrase2 = "ggocoh nnawak rhoyat ppala"
    print(f"\nPhrase: '{phrase2}'")
    print(f"Normalized: '{normalize_phrase(phrase2)}'")
