/**
 * Fuzzy matching between a Last.fm artist name and the artist results from
 * Deezer's search API. Comparison is normalized (diacritics, case, punctuation
 * and whitespace) so "Björk" matches "Bjork" and "坂本龍一" keeps matching
 * exactly without transliteration.
 */

export interface DeezerArtistLike {
  name?: string;
  picture_xl?: string;
  picture_big?: string;
  picture_medium?: string;
  link?: string;
}

export function normalizeArtistName(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  const current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous = [...current];
  }

  return previous[b.length];
}

function similarity(query: string, candidate: string): number {
  if (!query || !candidate) return 0;
  if (query === candidate) return 1;

  const shorter = query.length <= candidate.length ? query : candidate;
  const longer = query.length <= candidate.length ? candidate : query;
  const lengthRatio = shorter.length / longer.length;

  const atWordBoundary =
    longer.startsWith(`${shorter} `) ||
    longer.endsWith(` ${shorter}`) ||
    longer.includes(` ${shorter} `);
  const atBoundary = longer.startsWith(shorter) || atWordBoundary;

  // "radio" vs "radiohead" should not score as a match, while
  // "radiohead live" vs "radiohead" can.
  if (atBoundary && lengthRatio >= 0.6) {
    return 0.9;
  }

  const queryTokens = new Set(query.split(' ').filter(Boolean));
  const candidateTokens = new Set(candidate.split(' ').filter(Boolean));
  const intersection = [...queryTokens].filter((token) => candidateTokens.has(token)).length;
  const union = new Set([...queryTokens, ...candidateTokens]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  const levenshteinRatio = 1 - levenshtein(shorter, longer) / longer.length;
  const containsBonus =
    lengthRatio >= 0.6 && (longer.includes(shorter) || shorter.includes(longer)) ? 0.15 : 0;

  return Math.min(0.88, jaccard * 0.45 + levenshteinRatio * 0.4 + containsBonus);
}

/** Returns the best matching artist that actually has an image, or null. */
export function pickBestArtistMatch<T extends DeezerArtistLike>(
  query: string,
  candidates: readonly T[],
  minimumScore = 0.6,
): { artist: T; score: number } | null {
  const normalizedQuery = normalizeArtistName(query);
  if (!normalizedQuery) return null;

  let best: { artist: T; score: number } | null = null;

  for (const candidate of candidates) {
    const image = candidate.picture_xl ?? candidate.picture_big ?? candidate.picture_medium;
    if (!image) continue;

    const normalizedCandidate = normalizeArtistName(candidate.name);
    if (!normalizedCandidate) continue;

    const score = similarity(normalizedQuery, normalizedCandidate);
    // Strictly greater keeps the first (most relevant) Deezer result on ties.
    if (!best || score > best.score) {
      best = { artist: candidate, score };
    }
  }

  return best && best.score >= minimumScore ? best : null;
}
