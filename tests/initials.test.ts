import { describe, expect, it } from 'vitest';
import { getArtistInitials } from '@/lib/initials';

describe('getArtistInitials', () => {
  it('takes the first and last initials of Latin names', () => {
    expect(getArtistInitials('Tame Impala')).toBe('TI');
    expect(getArtistInitials('Beach House')).toBe('BH');
    expect(getArtistInitials('The Beach House')).toBe('TH');
  });

  it('takes two letters for a single word', () => {
    expect(getArtistInitials('Radiohead')).toBe('RA');
  });

  it('keeps the first two characters for CJK names', () => {
    expect(getArtistInitials('坂本龍一')).toBe('坂本');
    expect(getArtistInitials('宇多田ヒカル')).toBe('宇多');
    expect(getArtistInitials('아이유')).toBe('아이');
  });

  it('handles empty input', () => {
    expect(getArtistInitials('')).toBe('?');
    expect(getArtistInitials('   ')).toBe('?');
  });
});
