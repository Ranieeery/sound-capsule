import { describe, expect, it } from 'vitest';
import {
  normalizeArtistName,
  pickBestArtistMatch,
  type DeezerArtistLike,
} from '@/lib/artistMatch';

function artist(name: string, picture_xl = 'https://cdn-images.dzcdn.net/cover.jpg'): DeezerArtistLike {
  return { name, picture_xl };
}

describe('normalizeArtistName', () => {
  it('strips diacritics, punctuation and case', () => {
    expect(normalizeArtistName('Björk')).toBe('bjork');
    expect(normalizeArtistName('AC/DC')).toBe('ac dc');
    expect(normalizeArtistName('  Simon & Garfunkel ')).toBe('simon and garfunkel');
  });

  it('keeps CJK characters', () => {
    expect(normalizeArtistName('坂本龍一')).toBe('坂本龍一');
  });
});

describe('pickBestArtistMatch', () => {
  it('prefers an exact normalized match', () => {
    const match = pickBestArtistMatch('Radiohead', [
      artist('Radiohead Tribute Band'),
      artist('Radiohead'),
      artist('Radio Dept.'),
    ]);

    expect(match?.artist.name).toBe('Radiohead');
    expect(match?.score).toBe(1);
  });

  it('matches diacritics-insensitively', () => {
    const match = pickBestArtistMatch('Bjork', [artist('Björk')]);
    expect(match?.artist.name).toBe('Björk');
  });

  it('does not match a short prefix to a longer artist name', () => {
    expect(pickBestArtistMatch('Radio', [artist('Radiohead')])).toBeNull();
  });

  it('skips candidates without an image', () => {
    const match = pickBestArtistMatch('Björk', [
      { name: 'Björk', picture_xl: '' },
      { name: 'Björk', picture_xl: undefined, picture_big: 'https://cdn-images.dzcdn.net/big.jpg' },
    ]);

    expect(match?.artist.picture_big).toContain('big.jpg');
  });

  it('matches CJK names exactly', () => {
    const match = pickBestArtistMatch('坂本龍一', [
      artist('坂本龍一'),
      artist('坂本龍一 & 細野晴臣'),
    ]);
    expect(match?.artist.name).toBe('坂本龍一');
  });

  it('returns null when nothing is close enough', () => {
    expect(pickBestArtistMatch('Completely Different', [artist('Radiohead')])).toBeNull();
    expect(pickBestArtistMatch('', [artist('Radiohead')])).toBeNull();
  });
});
