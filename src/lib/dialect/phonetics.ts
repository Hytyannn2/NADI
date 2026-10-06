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
