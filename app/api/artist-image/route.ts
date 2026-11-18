import { NextResponse } from 'next/server';
import { pickBestArtistMatch, type DeezerArtistLike } from '@/lib/artistMatch';

/**
 * Resolves the best Deezer artist for a Last.fm artist name and returns its
 * `picture_xl`. Last.fm no longer returns usable artist photos, so this is the
 * only image source; the client proxies the returned URL to avoid tainted
 * canvases during PNG export.
 *
 * The API key is public Deezer data, no credentials are involved.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=60';
const DEEZER_TIMEOUT_MS = 8_000;
const MAX_NAME_LENGTH = 256;

interface DeezerArtist extends DeezerArtistLike {
  id?: number;
}

interface DeezerSearchResponse {
  data?: DeezerArtist[];
  error?: { message?: string; type?: string; code?: number } | string;
}

function fail(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: code, message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request): Promise<NextResponse> {
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return fail('invalid_request', 'Malformed request URL.', 400);
  }

  const name = (requestUrl.searchParams.get('name') ?? '').trim();
  if (
    !name ||
    name.length > MAX_NAME_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(name)
  ) {
    return fail('invalid_request', 'A valid artist name is required.', 400);
  }

  const searchUrl = new URL('https://api.deezer.com/search/artist');
  searchUrl.searchParams.set('q', name);
  // More candidates help disambiguate artists that share a name (e.g. "TWICE");
  // popularity is used as the tie-breaker in pickBestArtistMatch.
  searchUrl.searchParams.set('limit', '25');

  try {
    const upstream = await fetch(searchUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(DEEZER_TIMEOUT_MS),
    });

    if (!upstream.ok) {
      return fail('upstream_error', `Deezer responded with ${upstream.status}.`, 502);
    }

    let payload: DeezerSearchResponse;
    try {
      payload = (await upstream.json()) as DeezerSearchResponse;
    } catch {
      return fail('upstream_error', 'Deezer returned an invalid response.', 502);
    }

    if (payload.error) {
      return fail('upstream_error', 'Deezer search failed.', 502);
    }

    const best = pickBestArtistMatch(name, Array.isArray(payload.data) ? payload.data : []);
    if (!best) {
      return fail('not_found', 'No matching Deezer artist with an image.', 404);
    }

    const imageUrl =
      best.artist.picture_xl ?? best.artist.picture_big ?? best.artist.picture_medium;

    return NextResponse.json(
      {
        name: best.artist.name ?? name,
        imageUrl,
        deezerId: best.artist.id ?? null,
        matchScore: Number(best.score.toFixed(3)),
        source: 'deezer',
      },
      { headers: { 'Cache-Control': CACHE_CONTROL } },
    );
  } catch (error) {
    const isTimeout =
      error instanceof DOMException &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');
    return fail(
      isTimeout ? 'upstream_timeout' : 'upstream_error',
      isTimeout ? 'Deezer timed out.' : 'Could not reach Deezer.',
      isTimeout ? 504 : 502,
    );
  }
}
