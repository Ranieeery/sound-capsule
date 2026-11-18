import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearUserInfoCache,
  fetchCapsule,
  fetchUserInfo,
  type FetchProgress,
} from '@/lib/lastfmClient';

type Handler = (url: URL) => Response | Promise<Response>;

function makeFetcher(handler: Handler): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const raw =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const url = new URL(raw, 'http://localhost');
    return handler(url);
  }) as typeof fetch;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const USER_PAYLOAD = {
  user: {
    name: 'ranieri',
    realname: 'Ranieri',
    playcount: '12345',
    registered: { uts: '1552601400' },
  },
};

function rawTrack(name: string, artist: string, nowPlaying = false) {
  return nowPlaying
    ? { name, artist: { '#text': artist }, '@attr': { nowplaying: 'true' } }
    : { name, artist: { '#text': artist }, date: { uts: '1700000000' } };
}

function recentPage(options: {
  page: number;
  totalPages: number;
  total: number;
  tracks: unknown[];
}) {
  return {
    recenttracks: {
      '@attr': {
        page: String(options.page),
        totalPages: String(options.totalPages),
        total: String(options.total),
      },
      track: options.tracks,
    },
  };
}

const FROM = 1_700_000_000;
const TO = 1_700_604_800;

function baseOptions(fetcher: typeof fetch, extra: Record<string, unknown> = {}) {
  return {
    username: 'ranieri',
    from: FROM,
    to: TO,
    fetcher,
    retryBaseDelayMs: 1,
    ...extra,
  };
}

beforeEach(() => {
  clearUserInfoCache();
});

describe('fetchCapsule', () => {
  it('reads the registered.unixtime shape returned by the REST API', async () => {
    const fetcher = makeFetcher((url) => {
      if (url.searchParams.get('method') === 'user.getInfo') {
        return json({
          user: {
            name: 'ranieri',
            playcount: '1',
            registered: { unixtime: '1552601400', '#text': 1552601400 },
          },
        });
      }
      return json({ error: 6, message: 'Not used' });
    });

    const user = await fetchUserInfo('ranieri', { fetcher });
    expect(user.registered.getTime()).toBe(1_552_601_400_000);
  });

  it('paginates every page, ignores now-playing and aggregates locally', async () => {
    const calls: string[] = [];
    const progress: FetchProgress[] = [];

    const fetcher = makeFetcher((url) => {
      const method = url.searchParams.get('method');
      calls.push(`${method}:${url.searchParams.get('page') ?? ''}`);

      if (method === 'user.getInfo') return json(USER_PAYLOAD);
      if (method === 'user.getRecentTracks') {
        const page = Number(url.searchParams.get('page'));
        if (page === 1) {
          return json(
            recentPage({
              page: 1,
              totalPages: 2,
              total: 4,
              tracks: [
                rawTrack('Weird Fishes/Arpeggi', 'Radiohead'),
                rawTrack('Live at Glastonbury', 'Radiohead', true),
                rawTrack('Merry Christmas Mr. Lawrence', '坂本龍一'),
              ],
            }),
          );
        }
        return json(
          recentPage({
            page: 2,
            totalPages: 2,
            total: 4,
            tracks: [
              rawTrack('Weird Fishes/Arpeggi', 'Radiohead'),
              rawTrack('Creep', 'Radiohead'),
            ],
          }),
        );
      }
      if (method === 'track.getInfo') return json({ track: { duration: '200000' } });
      throw new Error(`Unexpected method ${method}`);
    });

    const result = await fetchCapsule({
      ...baseOptions(fetcher),
      onProgress: (event) => progress.push(event),
    });

    expect(result.totalScrobbles).toBe(4);
    expect(result.topArtists[0]).toMatchObject({ name: 'Radiohead', count: 3 });
    expect(result.topArtists[1]).toMatchObject({ name: '坂本龍一', count: 1 });
    expect(result.topTracks[0]).toMatchObject({
      name: 'Weird Fishes/Arpeggi',
      count: 2,
    });
    expect(result.estimate.minutes).toBe(13);
    expect(result.coverArtist).toBe('Radiohead');

    expect(calls.filter((call) => call.startsWith('user.getRecentTracks'))).toHaveLength(2);
    expect(calls.filter((call) => call.startsWith('track.getInfo'))).toHaveLength(3);

    const finalPages = progress.filter((event) => event.phase === 'pages').at(-1);
    expect(finalPages).toMatchObject({ completed: 2, totalPages: 2 });
    const finalDurations = progress.filter((event) => event.phase === 'durations').at(-1);
    expect(finalDurations).toMatchObject({ completed: 3, total: 3 });
  });

  it('caches user.getInfo for five minutes', async () => {
    let userInfoCalls = 0;

    const fetcher = makeFetcher((url) => {
      const method = url.searchParams.get('method');
      if (method === 'user.getInfo') {
        userInfoCalls += 1;
        return json(USER_PAYLOAD);
      }
      if (method === 'user.getRecentTracks') {
        return json(
          recentPage({
            page: 1,
            totalPages: 1,
            total: 1,
            tracks: [rawTrack('Creep', 'Radiohead')],
          }),
        );
      }
      return json({ track: { duration: '200000' } });
    });

    await fetchCapsule(baseOptions(fetcher));
    await fetchCapsule(baseOptions(fetcher));

    expect(userInfoCalls).toBe(1);
  });

  it('maps error 6 to invalid_user', async () => {
    const fetcher = makeFetcher(() => json({ error: 6, message: 'User not found' }));

    await expect(fetchCapsule(baseOptions(fetcher))).rejects.toMatchObject({
      code: 'invalid_user',
    });
  });

  it('maps error 17 to private scrobbles', async () => {
    const fetcher = makeFetcher((url) => {
      if (url.searchParams.get('method') === 'user.getInfo') return json(USER_PAYLOAD);
      return json({ error: 17, message: 'Login: User required to be logged in' });
    });

    await expect(fetchCapsule(baseOptions(fetcher))).rejects.toMatchObject({
      code: 'private',
    });
  });

  it('reports no_scrobbles for an empty period', async () => {
    const fetcher = makeFetcher((url) => {
      if (url.searchParams.get('method') === 'user.getInfo') return json(USER_PAYLOAD);
      return json(
        recentPage({ page: 1, totalPages: 0, total: 0, tracks: [] }),
      );
    });

    await expect(fetchCapsule(baseOptions(fetcher))).rejects.toMatchObject({
      code: 'no_scrobbles',
    });
  });

  it('retries error 29 with backoff before failing or succeeding', async () => {
    let pageAttempts = 0;

    const fetcher = makeFetcher((url) => {
      const method = url.searchParams.get('method');
      if (method === 'user.getInfo') return json(USER_PAYLOAD);
      if (method === 'user.getRecentTracks') {
        pageAttempts += 1;
        if (pageAttempts === 1) return json({ error: 29, message: 'Rate limit exceeded' });
        return json(
          recentPage({
            page: 1,
            totalPages: 1,
            total: 1,
            tracks: [rawTrack('Creep', 'Radiohead')],
          }),
        );
      }
      return json({ track: { duration: '200000' } });
    });

    const result = await fetchCapsule(baseOptions(fetcher));
    expect(result.totalScrobbles).toBe(1);
    expect(pageAttempts).toBe(2);
  });

  it('retries transient network failures', async () => {
    let pageAttempts = 0;

    const fetcher = makeFetcher((url) => {
      const method = url.searchParams.get('method');
      if (method === 'user.getInfo') return json(USER_PAYLOAD);
      if (method === 'user.getRecentTracks') {
        pageAttempts += 1;
        if (pageAttempts === 1) throw new TypeError('fetch failed');
        return json(
          recentPage({
            page: 1,
            totalPages: 1,
            total: 1,
            tracks: [rawTrack('Creep', 'Radiohead')],
          }),
        );
      }
      return json({ track: { duration: '200000' } });
    });

    const result = await fetchCapsule(baseOptions(fetcher));
    expect(result.totalScrobbles).toBe(1);
    expect(pageAttempts).toBe(2);
  });

  it('gives up with a network error after all retries', async () => {
    const fetcher = makeFetcher((url) => {
      if (url.searchParams.get('method') === 'user.getInfo') return json(USER_PAYLOAD);
      throw new TypeError('fetch failed');
    });

    await expect(fetchCapsule(baseOptions(fetcher))).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('respects abort signals', async () => {
    const fetcher = makeFetcher((url) => {
      if (url.searchParams.get('method') === 'user.getInfo') return json(USER_PAYLOAD);
      return json(recentPage({ page: 1, totalPages: 1, total: 0, tracks: [] }));
    });

    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchCapsule(baseOptions(fetcher, { signal: controller.signal })),
    ).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('fetches real durations for at most the 50 most played tracks', async () => {
    let durationCalls = 0;
    const tracks = Array.from({ length: 60 }, (_, index) =>
      rawTrack(`Track ${index}`, 'Artist'),
    );

    const fetcher = makeFetcher((url) => {
      const method = url.searchParams.get('method');
      if (method === 'user.getInfo') return json(USER_PAYLOAD);
      if (method === 'user.getRecentTracks') {
        return json(recentPage({ page: 1, totalPages: 1, total: 60, tracks }));
      }
      durationCalls += 1;
      return json({ track: { duration: '120000' } });
    });

    const result = await fetchCapsule(baseOptions(fetcher));

    expect(durationCalls).toBe(50);
    expect(result.estimate.knownTracks).toBe(50);
    expect(result.estimate.fallbackTracks).toBe(10);
    // 50 × 120s + 10 × 210s = 8100s = 135min
    expect(result.estimate.minutes).toBe(135);
  });

  it('falls back when track.getInfo fails for a track', async () => {
    const fetcher = makeFetcher((url) => {
      const method = url.searchParams.get('method');
      if (method === 'user.getInfo') return json(USER_PAYLOAD);
      if (method === 'user.getRecentTracks') {
        return json(
          recentPage({
            page: 1,
            totalPages: 1,
            total: 2,
            tracks: [rawTrack('Known', 'Artist'), rawTrack('Unknown', 'Artist')],
          }),
        );
      }
      if (url.searchParams.get('track') === 'Known') {
        return json({ track: { duration: '300000' } });
      }
      return json({ error: 6, message: 'Track not found' }, 200);
    });

    const result = await fetchCapsule(baseOptions(fetcher));

    expect(result.estimate.knownTracks).toBe(1);
    expect(result.estimate.fallbackTracks).toBe(1);
    expect(result.estimate.totalSeconds).toBe(300 + 210);
  });
});
