import { DEFAULT_TRACK_DURATION_SECONDS, MAX_DURATION_LOOKUPS } from '@/lib/periods';

export interface Scrobble {
  name: string;
  artist: string;
}

export interface TrackCount {
  /** Stable normalized key (artist + title). */
  key: string;
  name: string;
  artist: string;
  count: number;
}

export interface ArtistCount {
  /** Stable normalized key. */
  key: string;
  name: string;
  count: number;
}

export interface AggregateResult {
  tracks: TrackCount[];
  artists: ArtistCount[];
  totalScrobbles: number;
}

export interface ListeningEstimate {
  /** Rounded minutes shown in the card. */
  minutes: number;
  /** Unrounded minutes, useful for tests and tooltips. */
  rawMinutes: number;
  totalSeconds: number;
  /** Distinct top tracks that had a real duration from track.getInfo. */
  knownTracks: number;
  /** Distinct tracks that used the fallback duration (missing/unknown/outside top N). */
  fallbackTracks: number;
  knownScrobbles: number;
  fallbackScrobbles: number;
  fallbackSeconds: number;
}

const SEPARATOR = '\u0000';

/** Trim, collapse whitespace and case-fold for comparisons and grouping. */
export function normalizeName(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function trackKey(artist: string, name: string): string {
  return `${normalizeName(artist)}${SEPARATOR}${normalizeName(name)}`;
}

/**
 * Groups scrobbles by track and artist. Ties keep the order in which the item
 * first appeared in the scrobble history (stable sort), which mirrors Last.fm
 * recency instead of inventing an alphabetical tie-breaker.
 */
export function aggregateScrobbles(scrobbles: readonly Scrobble[]): AggregateResult {
  const tracks = new Map<string, TrackCount>();
  const artists = new Map<string, ArtistCount>();
  let totalScrobbles = 0;

  for (const scrobble of scrobbles) {
    const name = scrobble.name?.normalize('NFKC').trim().replace(/\s+/g, ' ');
    const artist = scrobble.artist?.normalize('NFKC').trim().replace(/\s+/g, ' ');

    if (!name || !artist) continue;

    const tKey = trackKey(artist, name);
    const aKey = normalizeName(artist);

    const existingTrack = tracks.get(tKey);
    if (existingTrack) {
      existingTrack.count += 1;
    } else {
      tracks.set(tKey, { key: tKey, name, artist, count: 1 });
    }

    const existingArtist = artists.get(aKey);
    if (existingArtist) {
      existingArtist.count += 1;
    } else {
      artists.set(aKey, { key: aKey, name: artist, count: 1 });
    }

    totalScrobbles += 1;
  }

  return {
    tracks: [...tracks.values()].sort((a, b) => b.count - a.count),
    artists: [...artists.values()].sort((a, b) => b.count - a.count),
    totalScrobbles,
  };
}

export function topTracks(tracks: readonly TrackCount[], limit = 5): TrackCount[] {
  return tracks.slice(0, limit);
}

export function topArtists(artists: readonly ArtistCount[], limit = 5): ArtistCount[] {
  return artists.slice(0, limit);
}

/**
 * Estimates listening time: real durations for the most scrobbled tracks plus
 * a fallback for everything else (missing duration, duration 0, or beyond the
 * top N lookup window).
 */
export function estimateListeningTime(
  tracks: readonly TrackCount[],
  durationsMs: ReadonlyMap<string, number | null | undefined>,
  totalScrobbles: number,
  options: { fallbackSeconds?: number; maxDurationLookups?: number } = {},
): ListeningEstimate {
  const fallbackSeconds = options.fallbackSeconds ?? DEFAULT_TRACK_DURATION_SECONDS;
  const maxDurationLookups = options.maxDurationLookups ?? MAX_DURATION_LOOKUPS;

  let totalSeconds = 0;
  let knownScrobbles = 0;
  let fallbackScrobbles = 0;
  let knownTracks = 0;
  let fallbackTracks = 0;

  tracks.forEach((track, index) => {
    const durationMs = index < maxDurationLookups ? durationsMs.get(track.key) : null;
    const durationSeconds =
      typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0
        ? durationMs / 1000
        : null;

    if (durationSeconds !== null) {
      knownScrobbles += track.count;
      knownTracks += 1;
      totalSeconds += durationSeconds * track.count;
    } else {
      fallbackScrobbles += track.count;
      fallbackTracks += 1;
      totalSeconds += fallbackSeconds * track.count;
    }
  });

  // Defensive: if the caller passes a scrobble total that differs from the
  // aggregated tracks (e.g. malformed page), keep the estimate proportional to
  // the real total using the known/fallback split of the counted tracks.
  const countedScrobbles = knownScrobbles + fallbackScrobbles;
  if (countedScrobbles > 0 && totalScrobbles > countedScrobbles) {
    const missing = totalScrobbles - countedScrobbles;
    totalSeconds += missing * fallbackSeconds;
    fallbackScrobbles += missing;
  }

  const rawMinutes = totalSeconds / 60;

  return {
    minutes: Math.round(rawMinutes),
    rawMinutes,
    totalSeconds,
    knownTracks,
    fallbackTracks,
    knownScrobbles,
    fallbackScrobbles,
    fallbackSeconds,
  };
}
