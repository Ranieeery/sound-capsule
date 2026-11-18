import {
  aggregateScrobbles,
  estimateListeningTime,
  topArtists,
  topTracks,
  type ArtistCount,
  type ListeningEstimate,
  type Scrobble,
  type TrackCount,
} from '@/lib/aggregate';
import {
  DEFAULT_TRACK_DURATION_SECONDS,
  MAX_DURATION_LOOKUPS,
} from '@/lib/periods';

const API_PROXY = '/api/lastfm';
export const PAGE_SIZE = 200;
export const PAGE_CONCURRENCY = 4;
export const DURATION_CONCURRENCY = 4;
const MAX_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 700;
const USER_INFO_TTL_MS = 5 * 60 * 1000;

export type LastfmErrorCode =
  | 'invalid_user'
  | 'private'
  | 'no_scrobbles'
  | 'rate_limit'
  | 'network'
  | 'cancelled'
  | 'missing_api_key'
  | 'server_error'
  | 'unknown';

export class LastfmError extends Error {
  readonly code: LastfmErrorCode;
  readonly upstreamCode?: number;

  constructor(code: LastfmErrorCode, message: string, upstreamCode?: number) {
    super(message);
    this.name = 'LastfmError';
    this.code = code;
    this.upstreamCode = upstreamCode;
  }
}

export function isLastfmError(error: unknown): error is LastfmError {
  return error instanceof LastfmError;
}

export interface LastfmUser {
  username: string;
  realname?: string;
  registered: Date;
  playcount: number;
}

export type FetchProgress =
  | { phase: 'user' }
  | { phase: 'pages'; completed: number; totalPages: number; tracksFetched: number }
  | { phase: 'durations'; completed: number; total: number };

export interface CapsuleData {
  user: LastfmUser;
  totalScrobbles: number;
  topArtists: ArtistCount[];
  topTracks: TrackCount[];
  estimate: ListeningEstimate;
  /** Artist used for the hero image (top artist, or the username as a fallback). */
  coverArtist: string;
}

export interface FetchCapsuleOptions {
  username: string;
  /** Unix seconds. */
  from: number;
  /** Unix seconds. */
  to: number;
  signal?: AbortSignal;
  onProgress?: (progress: FetchProgress) => void;
  fetcher?: typeof fetch;
  retryBaseDelayMs?: number;
  pageConcurrency?: number;
  durationConcurrency?: number;
  fallbackDurationSeconds?: number;
  maxDurationLookups?: number;
}

interface UserInfoOptions {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  retryBaseDelayMs?: number;
}

interface RawRecentTrack {
  name?: unknown;
  artist?: unknown;
  '@attr'?: { nowplaying?: string | boolean };
  date?: { uts?: string | number };
}

interface RecentTracksPayload {
  recenttracks?: {
    '@attr'?: {
      page?: string | number;
      totalPages?: string | number;
      total?: string | number;
    };
    track?: RawRecentTrack | RawRecentTrack[];
  };
  error?: number | string;
  message?: string;
}

interface UserInfoPayload {
  user?: {
    name?: string;
    realname?: string;
    playcount?: string | number;
    registered?: { uts?: string | number };
  };
  error?: number | string;
  message?: string;
}

interface TrackInfoPayload {
  track?: { duration?: string | number };
  error?: number | string;
  message?: string;
}

const userInfoCache = new Map<string, { value: LastfmUser; expiresAt: number }>();

/** Test helper: the cache is intentionally module-level (per browser session). */
export function clearUserInfoCache(): void {
  userInfoCache.clear();
}

export function isValidLastfmUsername(username: string): boolean {
  return /^[A-Za-z0-9_.-]{1,64}$/.test(username.trim());
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name?: string }).name === 'AbortError')
  );
}

function cancelledError(): LastfmError {
  return new LastfmError('cancelled', 'The request was cancelled.');
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && '#text' in value) {
    const text = (value as { '#text'?: unknown })['#text'];
    return typeof text === 'string' ? text : '';
  }
  return '';
}

function asNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function lastfmErrorFromCode(code: number, message?: string): LastfmError {
  const fallback = message || `Last.fm error ${code}`;
  switch (code) {
    case 6:
      return new LastfmError('invalid_user', fallback, code);
    case 17:
      return new LastfmError('private', fallback, code);
    case 29:
      return new LastfmError('rate_limit', fallback, code);
    case 10:
    case 13:
      return new LastfmError('missing_api_key', fallback, code);
    case 26:
      return new LastfmError('server_error', fallback, code);
    default:
      return new LastfmError('unknown', fallback, code);
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof LastfmError) {
    return error.code === 'rate_limit' || error.code === 'server_error';
  }
  // `fetch` rejects with a TypeError on network failures.
  return error instanceof TypeError;
}

function normalizeError(error: unknown): LastfmError {
  if (error instanceof LastfmError) return error;
  if (isAbortError(error)) return cancelledError();
  if (error instanceof TypeError) {
    return new LastfmError('network', error.message || 'Network request failed.');
  }
  return new LastfmError('unknown', error instanceof Error ? error.message : String(error));
}

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(cancelledError());
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(cancelledError());
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function withRetries<T>(
  task: () => Promise<T>,
  options: { signal?: AbortSignal; baseDelayMs?: number; attempts?: number },
): Promise<T> {
  const attempts = options.attempts ?? MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? RETRY_BASE_DELAY_MS;

  for (let attempt = 0; ; attempt += 1) {
    if (options.signal?.aborted) throw cancelledError();

    try {
      return await task();
    } catch (error) {
      if (isAbortError(error) || options.signal?.aborted) throw cancelledError();
      if (!isRetryable(error) || attempt >= attempts - 1) throw normalizeError(error);

      const delay = Math.min(baseDelayMs * 2 ** attempt, 8_000);
      await abortableDelay(delay, options.signal);
    }
  }
}

async function callProxy<T>(
  params: Record<string, string | number>,
  options: { signal?: AbortSignal; fetcher?: typeof fetch },
): Promise<T> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.set(key, String(value));
  }

  const fetcher = options.fetcher ?? fetch;
  let response: Response;

  try {
    response = await fetcher(`${API_PROXY}?${search.toString()}`, {
      signal: options.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (isAbortError(error) || options.signal?.aborted) throw cancelledError();
    throw error;
  }

  if (response.status === 429) {
    throw new LastfmError('rate_limit', 'Last.fm rate limit reached.', 29);
  }

  if (response.status >= 500) {
    throw new LastfmError('server_error', `Upstream responded with ${response.status}.`);
  }

  let payload: { error?: unknown; message?: string } & Record<string, unknown>;

  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new LastfmError('server_error', 'Upstream returned invalid JSON.');
  }

  if (payload.error === 'missing_api_key') {
    throw new LastfmError('missing_api_key', payload.message ?? 'LASTFM_API_KEY is not configured.');
  }

  if (payload.error === 'invalid_request') {
    throw new LastfmError('unknown', payload.message ?? 'Invalid API request.');
  }

  if (typeof payload.error === 'number') {
    throw lastfmErrorFromCode(payload.error, payload.message);
  }

  if (!response.ok) {
    throw new LastfmError('server_error', `Upstream responded with ${response.status}.`);
  }

  return payload as T;
}

export async function fetchUserInfo(
  username: string,
  options: UserInfoOptions = {},
): Promise<LastfmUser> {
  const trimmed = username.trim();
  const cacheKey = trimmed.toLowerCase();
  const cached = userInfoCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const payload = await withRetries(
    () =>
      callProxy<UserInfoPayload>(
        { method: 'user.getInfo', user: trimmed },
        { signal: options.signal, fetcher: options.fetcher },
      ),
    {
      signal: options.signal,
      baseDelayMs: options.retryBaseDelayMs,
      attempts: options.signal ? MAX_ATTEMPTS : MAX_ATTEMPTS,
    },
  );

  const user = payload.user;
  if (!user) {
    throw new LastfmError('invalid_user', 'Last.fm did not return a user.');
  }

  const registeredUnix = asNumber(user.registered?.uts);
  const result: LastfmUser = {
    username: asText(user.name) || trimmed,
    realname: asText(user.realname) || undefined,
    registered: registeredUnix > 0 ? new Date(registeredUnix * 1000) : new Date(0),
    playcount: asNumber(user.playcount),
  };

  userInfoCache.set(cacheKey, { value: result, expiresAt: Date.now() + USER_INFO_TTL_MS });
  return result;
}

function parseScrobbles(tracks: readonly RawRecentTrack[]): Scrobble[] {
  const scrobbles: Scrobble[] = [];

  for (const track of tracks) {
    const nowPlaying =
      track['@attr']?.nowplaying === 'true' || track['@attr']?.nowplaying === true;
    // The "now playing" track has no scrobble date yet and must not count.
    if (nowPlaying) continue;

    const name = asText(track.name).trim();
    const artist = asText(track.artist).trim();
    if (!name || !artist) continue;

    scrobbles.push({ name, artist });
  }

  return scrobbles;
}

interface RecentTracksPage {
  scrobbles: Scrobble[];
  totalPages: number;
  totalScrobbles: number;
}

async function fetchRecentTracksPage(
  username: string,
  page: number,
  from: number,
  to: number,
  options: { signal?: AbortSignal; fetcher?: typeof fetch; retryBaseDelayMs?: number },
): Promise<RecentTracksPage> {
  const payload = await withRetries(
    () =>
      callProxy<RecentTracksPayload>(
        {
          method: 'user.getRecentTracks',
          user: username,
          from,
          to,
          page,
          limit: PAGE_SIZE,
        },
        { signal: options.signal, fetcher: options.fetcher },
      ),
    { signal: options.signal, baseDelayMs: options.retryBaseDelayMs },
  );

  const recent = payload.recenttracks;
  if (!recent) {
    throw new LastfmError('no_scrobbles', 'Last.fm returned no recent tracks.');
  }

  const rawTracks = asArray(recent.track);
  const attr = recent['@attr'] ?? {};
  const totalPages = Math.max(1, asNumber(attr.totalPages));
  const totalScrobbles = asNumber(attr.total);

  return {
    scrobbles: parseScrobbles(rawTracks),
    totalPages,
    totalScrobbles,
  };
}

async function fetchAllScrobbles(
  username: string,
  from: number,
  to: number,
  options: {
    signal?: AbortSignal;
    fetcher?: typeof fetch;
    onProgress?: (progress: FetchProgress) => void;
    retryBaseDelayMs?: number;
    concurrency?: number;
  },
): Promise<Scrobble[]> {
  const concurrency = options.concurrency ?? PAGE_CONCURRENCY;
  const firstPage = await fetchRecentTracksPage(username, 1, from, to, options);

  const allScrobbles: Scrobble[] = [...firstPage.scrobbles];
  const totalPages = firstPage.totalPages;
  let completed = 1;
  let tracksFetched = firstPage.scrobbles.length;

  options.onProgress?.({ phase: 'pages', completed, totalPages, tracksFetched });

  if (totalPages > 1) {
    const pageNumbers: number[] = [];
    for (let page = 2; page <= totalPages; page += 1) pageNumbers.push(page);

    const tasks = pageNumbers.map((page) => async () => {
      const result = await fetchRecentTracksPage(username, page, from, to, options);
      completed += 1;
      tracksFetched += result.scrobbles.length;
      options.onProgress?.({ phase: 'pages', completed, totalPages, tracksFetched });
      return result.scrobbles;
    });

    const pages = await runPool(tasks, concurrency, options.signal);
    for (const scrobbles of pages) allScrobbles.push(...scrobbles);
  }

  return allScrobbles;
}

async function runPool<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  concurrency: number,
  signal?: AbortSignal,
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let nextIndex = 0;
  let failure: unknown = null;

  const workerCount = Math.max(1, Math.min(concurrency, tasks.length));

  async function worker(): Promise<void> {
    for (;;) {
      if (failure) return;
      if (signal?.aborted) {
        failure = cancelledError();
        return;
      }

      const index = nextIndex;
      nextIndex += 1;
      if (index >= tasks.length) return;

      try {
        results[index] = await tasks[index]();
      } catch (error) {
        if (!failure) failure = error;
        return;
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (failure) {
    if (isAbortError(failure) || signal?.aborted) throw cancelledError();
    throw normalizeError(failure);
  }

  return results;
}

async function fetchTrackDurations(
  tracks: readonly TrackCount[],
  options: {
    signal?: AbortSignal;
    fetcher?: typeof fetch;
    onProgress?: (progress: FetchProgress) => void;
    retryBaseDelayMs?: number;
    concurrency?: number;
    maxLookups: number;
  },
): Promise<Map<string, number | null>> {
  const candidates = tracks.slice(0, options.maxLookups);
  const durations = new Map<string, number | null>();
  const concurrency = options.concurrency ?? DURATION_CONCURRENCY;
  let completed = 0;

  options.onProgress?.({ phase: 'durations', completed, total: candidates.length });

  const tasks = candidates.map((track) => async () => {
    try {
      const payload = await withRetries(
        () =>
          callProxy<TrackInfoPayload>(
            {
              method: 'track.getInfo',
              artist: track.artist,
              track: track.name,
              autocorrect: 1,
            },
            { signal: options.signal, fetcher: options.fetcher },
          ),
        { signal: options.signal, baseDelayMs: options.retryBaseDelayMs, attempts: 3 },
      );

      const duration = asNumber(payload.track?.duration);
      durations.set(track.key, duration > 0 ? duration : null);
    } catch (error) {
      if (isLastfmError(error) && error.code === 'cancelled') throw error;
      if (isAbortError(error)) throw cancelledError();
      // A single missing/unavailable track must not fail the capsule; fall back
      // to the configured default duration for it.
      durations.set(track.key, null);
    } finally {
      completed += 1;
      options.onProgress?.({ phase: 'durations', completed, total: candidates.length });
    }
  });

  await runPool(tasks, concurrency, options.signal);
  return durations;
}

/**
 * Fetches every scrobble page for the window, aggregates locally and estimates
 * listening time. Everything happens client-side; only thin stateless proxy
 * calls leave the browser.
 */
export async function fetchCapsule(options: FetchCapsuleOptions): Promise<CapsuleData> {
  const { username, from, to, signal, onProgress, fetcher } = options;

  if (from > to) {
    throw new LastfmError('unknown', 'The period start is after its end.');
  }

  onProgress?.({ phase: 'user' });
  const user = await fetchUserInfo(username, {
    signal,
    fetcher,
    retryBaseDelayMs: options.retryBaseDelayMs,
  });

  const scrobbles = await fetchAllScrobbles(username, from, to, {
    signal,
    fetcher,
    onProgress,
    retryBaseDelayMs: options.retryBaseDelayMs,
    concurrency: options.pageConcurrency,
  });

  const aggregate = aggregateScrobbles(scrobbles);
  if (aggregate.totalScrobbles === 0) {
    throw new LastfmError('no_scrobbles', 'No scrobbles found for the selected period.');
  }

  const durations = await fetchTrackDurations(aggregate.tracks, {
    signal,
    fetcher,
    onProgress,
    retryBaseDelayMs: options.retryBaseDelayMs,
    concurrency: options.durationConcurrency,
    maxLookups: options.maxDurationLookups ?? MAX_DURATION_LOOKUPS,
  });

  const estimate = estimateListeningTime(
    aggregate.tracks,
    durations,
    aggregate.totalScrobbles,
    {
      fallbackSeconds: options.fallbackDurationSeconds ?? DEFAULT_TRACK_DURATION_SECONDS,
      maxDurationLookups: options.maxDurationLookups ?? MAX_DURATION_LOOKUPS,
    },
  );

  return {
    user,
    totalScrobbles: aggregate.totalScrobbles,
    topArtists: topArtists(aggregate.artists),
    topTracks: topTracks(aggregate.tracks),
    estimate,
    coverArtist: aggregate.artists[0]?.name ?? user.username,
  };
}
