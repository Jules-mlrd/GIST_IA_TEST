// lib/fuzzyMatch.ts
// Simple fuzzy matching utility for document name detection

/**
 * Returns a similarity score between two strings (0 to 1).
 * Uses a basic normalized Levenshtein distance.
 */
export function similarity(a: string, b: string): number {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  const distance = matrix[a.length][b.length];
  return 1 - distance / Math.max(a.length, b.length);
}

/**
 * Finds the best fuzzy match for a query in a list of candidates.
 * Returns the best match and its score.
 */
export function findBestFuzzyMatch(query: string, candidates: string[]): { match: string, score: number } {
  let best = { match: '', score: 0 };
  for (const candidate of candidates) {
    const score = similarity(query, candidate);
    if (score > best.score) {
      best = { match: candidate, score };
    }
  }
  return best;
}
