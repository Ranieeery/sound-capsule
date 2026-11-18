/**
 * Initials used by the procedural hero fallback when no Deezer image is found.
 * CJK names get their first two characters, which is the conventional short
 * form; Latin names get one letter from the first and last word.
 */
export function getArtistInitials(name: string): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';

  const characters = Array.from(trimmed);
  const isCjk = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/u;

  if (isCjk.test(trimmed)) {
    return characters.slice(0, 2).join('');
  }

  const words = trimmed.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
  if (words.length === 0) return '?';

  const firstWord = Array.from(words[0]);
  const lastWord = Array.from(words[words.length - 1]);

  if (words.length === 1) {
    return firstWord.slice(0, 2).join('').toUpperCase();
  }

  return `${firstWord[0] ?? ''}${lastWord[0] ?? ''}`.toUpperCase();
}
