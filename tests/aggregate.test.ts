import { describe, expect, it } from 'vitest';
import {
  aggregateScrobbles,
  estimateListeningTime,
  normalizeName,
  topArtists,
  topTracks,
  type Scrobble,
  type TrackCount,
} from '@/lib/aggregate';

function scrobble(artist: string, name: string): Scrobble {
  return { artist, name };
}

function track(key: string, count: number): TrackCount {
  return { key, name: key, artist: 'artist', count };
}

describe('normalizeName', () => {
  it('trims, collapses whitespace and case-folds', () => {
    expect(normalizeName('  Tame   Impala ')).toBe('tame impala');
    expect(normalizeName('RADIOHEAD')).toBe('radiohead');
  });

  it('keeps CJK names intact', () => {
    expect(normalizeName('坂本龍一')).toBe('坂本龍一');
    expect(normalizeName('宇多田ヒカル')).toBe('宇多田ヒカル');
  });

  it('handles missing values', () => {
    expect(normalizeName(undefined)).toBe('');
    expect(normalizeName(null)).toBe('');
  });
});

describe('aggregateScrobbles', () => {
  it('counts artists and tracks, ignoring case and extra spaces', () => {
    const result = aggregateScrobbles([
      scrobble('Radiohead', 'Weird Fishes'),
      scrobble(' radiohead ', ' weird  fishes '),
      scrobble('RADIOHEAD', 'Creep'),
      scrobble('Beach House', 'Space Song'),
    ]);

    expect(result.totalScrobbles).toBe(4);
    expect(result.artists[0]).toMatchObject({ name: 'Radiohead', count: 3 });
    expect(result.artists[1]).toMatchObject({ name: 'Beach House', count: 1 });
    expect(result.tracks[0]).toMatchObject({ name: 'Weird Fishes', count: 2 });
    expect(result.tracks[1]).toMatchObject({ name: 'Creep', count: 1 });
  });

  it('sorts by count and keeps recency order for ties', () => {
    const result = aggregateScrobbles([
      scrobble('A', 'one'),
      scrobble('B', 'two'),
      scrobble('B', 'two'),
      scrobble('C', 'three'),
      scrobble('C', 'three'),
    ]);

    expect(result.artists.map((artist) => artist.name)).toEqual(['B', 'C', 'A']);
  });

  it('returns only the top 5 with topArtists/topTracks', () => {
    const scrobbles: Scrobble[] = [];
    for (let index = 0; index < 8; index += 1) {
      for (let play = 0; play < index + 1; play += 1) {
        scrobbles.push(scrobble(`Artist ${index}`, `Track ${index}`));
      }
    }

    const result = aggregateScrobbles(scrobbles);
    expect(topArtists(result.artists)).toHaveLength(5);
    expect(topTracks(result.tracks)).toHaveLength(5);
    expect(result.artists[0].name).toBe('Artist 7');
  });

  it('supports CJK artist and track names', () => {
    const result = aggregateScrobbles([
      scrobble('坂本龍一', 'Merry Christmas Mr. Lawrence'),
      scrobble('坂本龍一', 'Merry Christmas Mr. Lawrence'),
      scrobble('宇多田ヒカル', 'Automatic'),
    ]);

    expect(result.artists[0].name).toBe('坂本龍一');
    expect(result.tracks[0]).toMatchObject({
      name: 'Merry Christmas Mr. Lawrence',
      artist: '坂本龍一',
      count: 2,
    });
  });

  it('drops empty entries instead of counting them', () => {
    const result = aggregateScrobbles([
      scrobble('', 'Song'),
      scrobble('Artist', ''),
      scrobble('Artist', 'Song'),
    ]);

    expect(result.totalScrobbles).toBe(1);
  });
});

describe('estimateListeningTime', () => {
  it('uses real durations for known tracks and the fallback for the rest', () => {
    const estimate = estimateListeningTime(
      [track('a', 3), track('b', 2), track('c', 1)],
      new Map([
        ['a', 200_000],
        ['b', 0],
      ]),
      6,
    );

    // 3×200s + 2×210s + 1×210s = 1230s = 20.5min → 21
    expect(estimate.totalSeconds).toBe(1230);
    expect(estimate.minutes).toBe(21);
    expect(estimate.knownTracks).toBe(1);
    expect(estimate.fallbackTracks).toBe(2);
    expect(estimate.knownScrobbles).toBe(3);
    expect(estimate.fallbackScrobbles).toBe(3);
  });

  it('ignores durations beyond the lookup window', () => {
    const estimate = estimateListeningTime(
      [track('a', 1), track('b', 1), track('c', 1)],
      new Map([
        ['a', 180_000],
        ['b', 180_000],
        ['c', 180_000],
      ]),
      3,
      { maxDurationLookups: 2 },
    );

    expect(estimate.knownTracks).toBe(2);
    expect(estimate.totalSeconds).toBe(180 + 180 + 210);
  });

  it('is configurable and safe with no durations', () => {
    const estimate = estimateListeningTime([track('a', 2)], new Map(), 2, {
      fallbackSeconds: 60,
    });
    expect(estimate.totalSeconds).toBe(120);
    expect(estimate.minutes).toBe(2);
  });

  it('adds fallback time for scrobbles not present in the aggregation', () => {
    const estimate = estimateListeningTime([track('a', 2)], new Map(), 5);
    expect(estimate.fallbackScrobbles).toBe(5);
    expect(estimate.totalSeconds).toBe(5 * 210);
  });

  it('rounds to the nearest minute', () => {
    const estimate = estimateListeningTime([track('a', 1)], new Map([['a', 90_000]]), 1);
    expect(estimate.rawMinutes).toBe(1.5);
    expect(estimate.minutes).toBe(2);
  });
});
