import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as artistImageRoute } from '@/app/api/artist-image/route';
import { GET as imageProxyRoute } from '@/app/api/image-proxy/route';
import { GET as lastfmRoute } from '@/app/api/lastfm/route';

const originalFetch = globalThis.fetch;

function request(path: string): Request {
  return new Request(`http://localhost${path}`);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubEnv('LASTFM_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe('GET /api/lastfm', () => {
  it('rejects methods outside the whitelist', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await lastfmRoute(
      request('/api/lastfm?method=user.getTopArtists&user=ranieri'),
    );

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await response.json()).error).toBe('invalid_request');
  });

  it('fails clearly when the server key is missing', async () => {
    vi.stubEnv('LASTFM_API_KEY', '');

    const response = await lastfmRoute(
      request('/api/lastfm?method=user.getInfo&user=ranieri'),
    );

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).error).toBe('missing_api_key');
  });

  it('never lets callers override the api key or format', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    for (const path of [
      '/api/lastfm?method=user.getInfo&user=ranieri&api_key=hacked',
      '/api/lastfm?method=user.getInfo&user=ranieri&format=xml',
    ]) {
      const response = await lastfmRoute(request(path));
      expect(response.status).toBe(400);
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects unexpected parameters and invalid usernames', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const extra = await lastfmRoute(
      request('/api/lastfm?method=user.getInfo&user=ranieri&secret=1'),
    );
    expect(extra.status).toBe(400);

    const badUser = await lastfmRoute(
      request('/api/lastfm?method=user.getInfo&user=not%20a%20user'),
    );
    expect(badUser.status).toBe(400);

    const badRange = await lastfmRoute(
      request('/api/lastfm?method=user.getRecentTracks&user=ranieri&from=20&to=10'),
    );
    expect(badRange.status).toBe(400);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('forwards valid requests with the server key and caches on the CDN', async () => {
    let upstreamUrl = '';
    let upstreamHeaders: HeadersInit | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        upstreamUrl = String(input);
        upstreamHeaders = init?.headers;
        return jsonResponse({ user: { name: 'ranieri' } });
      }),
    );

    const response = await lastfmRoute(
      request('/api/lastfm?method=user.getInfo&user=ranieri'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(response.headers.get('vercel-cdn-cache-control')).toContain('s-maxage=300');
    expect(response.headers.get('vercel-cdn-cache-control')).toContain('stale-while-revalidate');

    const url = new URL(upstreamUrl);
    expect(url.origin + url.pathname).toBe('https://ws.audioscrobbler.com/2.0/');
    expect(url.searchParams.get('method')).toBe('user.getInfo');
    expect(url.searchParams.get('user')).toBe('ranieri');
    expect(url.searchParams.get('api_key')).toBe('test-key');
    expect(url.searchParams.get('format')).toBe('json');
    expect(new Headers(upstreamHeaders).get('user-agent')).toContain('SoundCapsule/');
  });

  it('caches stable track metadata for 24 hours on the CDN', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ track: { duration: '200000' } })),
    );

    const response = await lastfmRoute(
      request('/api/lastfm?method=track.getInfo&artist=Radiohead&track=Creep'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('vercel-cdn-cache-control')).toContain('s-maxage=86400');
  });

  it('passes API errors through without caching them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 6, message: 'User not found' }, 200)),
    );

    const response = await lastfmRoute(
      request('/api/lastfm?method=user.getInfo&user=ghost'),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ error: 6 });
  });
});

describe('GET /api/artist-image', () => {
  it('returns the best normalized Deezer match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          data: [
            {
              id: 1,
              name: 'Radiohead Tribute Band',
              picture_xl: 'https://cdn-images.dzcdn.net/tribute.jpg',
            },
            {
              id: 2,
              name: 'Radiohead',
              picture_xl: 'https://cdn-images.dzcdn.net/radiohead.jpg',
            },
          ],
        }),
      ),
    );

    const response = await artistImageRoute(request('/api/artist-image?name=Radiohead'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.name).toBe('Radiohead');
    expect(payload.imageUrl).toBe('https://cdn-images.dzcdn.net/radiohead.jpg');
    expect(response.headers.get('vercel-cdn-cache-control')).toContain('s-maxage=86400');
  });

  it('returns 404 when no candidate matches', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          data: [{ id: 3, name: 'Completely Different', picture_xl: 'https://cdn-images.dzcdn.net/x.jpg' }],
        }),
      ),
    );

    const response = await artistImageRoute(request('/api/artist-image?name=Radiohead'));
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('validates the artist name', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await artistImageRoute(request('/api/artist-image?name='));
    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('GET /api/image-proxy', () => {
  it('rejects every host that is not *.dzcdn.net', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    for (const target of [
      'https://evil.example.com/image.png',
      'https://dzcdn.net.evil.com/image.png',
      'http://cdn-images.dzcdn.net/image.png',
    ]) {
      const response = await imageProxyRoute(
        request(`/api/image-proxy?url=${encodeURIComponent(target)}`),
      );
      expect(response.status).toBe(400);
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('proxies Deezer CDN images with a cache header', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const response = new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        });
        Object.defineProperty(response, 'url', {
          value: 'https://cdn-images.dzcdn.net/images/artist/x/1000x1000.jpg',
        });
        return response;
      }),
    );

    const response = await imageProxyRoute(
      request(
        `/api/image-proxy?url=${encodeURIComponent('https://cdn-images.dzcdn.net/images/artist/x/1000x1000.jpg')}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('vercel-cdn-cache-control')).toContain('s-maxage=86400');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect((await response.arrayBuffer()).byteLength).toBe(3);
  });

  it('rejects a redirect that leaves the allowed host', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const response = new Response(new Uint8Array([1]), {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        });
        Object.defineProperty(response, 'url', { value: 'https://evil.example.com/x.jpg' });
        return response;
      }),
    );

    const response = await imageProxyRoute(
      request(
        `/api/image-proxy?url=${encodeURIComponent('https://cdn-images.dzcdn.net/x.jpg')}`,
      ),
    );

    expect(response.status).toBe(400);
  });

  it('rejects non-image payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<html></html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          }),
      ),
    );

    const response = await imageProxyRoute(
      request(
        `/api/image-proxy?url=${encodeURIComponent('https://cdn-images.dzcdn.net/x.jpg')}`,
      ),
    );

    expect(response.status).toBe(502);
  });
});

