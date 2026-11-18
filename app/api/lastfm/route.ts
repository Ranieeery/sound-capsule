import { NextResponse } from 'next/server';

/**
 * Thin, stateless proxy for a strict whitelist of Last.fm API methods.
 * The API key never leaves the server and every parameter is validated before
 * it is forwarded, so the browser cannot use this route as an open proxy.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LASTFM_ENDPOINT = 'https://ws.audioscrobbler.com/2.0/';
const CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=60';
const NO_STORE = 'no-store';
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const UPSTREAM_TIMEOUT_MS = 10_000;

const ALLOWED_PARAMS: Record<string, readonly string[]> = {
  'user.getInfo': ['user'],
  'user.getRecentTracks': ['user', 'from', 'to', 'page', 'limit'],
  'track.getInfo': ['artist', 'track', 'username', 'autocorrect'],
};

const INTEGER_BOUNDS: Record<string, readonly [number, number]> = {
  from: [0, 4_102_444_800],
  to: [0, 4_102_444_800],
  page: [1, 100_000],
  limit: [1, 200],
};

function fail(code: string, message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: code, message },
    { status, headers: { 'Cache-Control': NO_STORE } },
  );
}

function sanitizeText(value: string, maxLength: number): string | null {
  if (value.length === 0 || value.length > maxLength) return null;
  // Control characters could break logs/upstream requests.
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

export async function GET(request: Request): Promise<NextResponse> {
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return fail('invalid_request', 'Malformed request URL.', 400);
  }

  const method = requestUrl.searchParams.get('method') ?? '';
  const allowedParams = ALLOWED_PARAMS[method];
  if (!allowedParams) {
    return fail('invalid_request', 'Unsupported Last.fm method.', 400);
  }

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    return fail('missing_api_key', 'LASTFM_API_KEY is not configured on the server.', 500);
  }

  const params = new URLSearchParams();

  for (const [key, value] of requestUrl.searchParams.entries()) {
    if (key === 'method') continue;

    // Never let callers override the key or the response format.
    if (key === 'api_key' || key === 'format') {
      return fail('invalid_request', `Parameter "${key}" is not allowed.`, 400);
    }

    if (!allowedParams.includes(key)) {
      return fail('invalid_request', `Unexpected parameter "${key}".`, 400);
    }

    const bounds = INTEGER_BOUNDS[key];
    if (bounds) {
      if (!/^\d+$/.test(value)) {
        return fail('invalid_request', `Parameter "${key}" must be an integer.`, 400);
      }
      const numeric = Number(value);
      if (numeric < bounds[0] || numeric > bounds[1]) {
        return fail('invalid_request', `Parameter "${key}" is out of range.`, 400);
      }
      params.set(key, String(numeric));
      continue;
    }

    if (key === 'autocorrect') {
      if (value !== '0' && value !== '1') {
        return fail('invalid_request', 'Parameter "autocorrect" must be 0 or 1.', 400);
      }
      params.set(key, value);
      continue;
    }

    const sanitized = sanitizeText(value, key === 'user' || key === 'username' ? 64 : 512);
    if (!sanitized) {
      return fail('invalid_request', `Parameter "${key}" is invalid.`, 400);
    }

    if ((key === 'user' || key === 'username') && !USERNAME_PATTERN.test(sanitized)) {
      return fail('invalid_request', `Parameter "${key}" is not a valid Last.fm username.`, 400);
    }

    params.set(key, sanitized);
  }

  if (method !== 'track.getInfo' && !params.has('user')) {
    return fail('invalid_request', 'Parameter "user" is required.', 400);
  }

  if (method === 'track.getInfo' && (!params.has('artist') || !params.has('track'))) {
    return fail('invalid_request', 'Parameters "artist" and "track" are required.', 400);
  }

  if (params.has('from') && params.has('to')) {
    if (Number(params.get('from')) > Number(params.get('to'))) {
      return fail('invalid_request', 'Parameter "from" must not be after "to".', 400);
    }
  }

  const upstreamUrl = new URL(LASTFM_ENDPOINT);
  upstreamUrl.searchParams.set('method', method);
  upstreamUrl.searchParams.set('api_key', apiKey);
  upstreamUrl.searchParams.set('format', 'json');
  params.forEach((value, key) => upstreamUrl.searchParams.set(key, value));

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const text = await upstream.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      return fail('upstream_error', 'Last.fm returned an invalid response.', 502);
    }

    const isErrorPayload =
      typeof payload === 'object' && payload !== null && Object.hasOwn(payload, 'error');

    if (isErrorPayload) {
      // Pass API errors through (the client maps error codes 6/17/29/...),
      // but never cache them on the CDN.
      return NextResponse.json(payload, {
        status: upstream.ok ? 400 : upstream.status,
        headers: { 'Cache-Control': NO_STORE },
      });
    }

    if (!upstream.ok) {
      return fail('upstream_error', `Last.fm responded with ${upstream.status}.`, 502);
    }

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': CACHE_CONTROL },
    });
  } catch (error) {
    const isTimeout =
      error instanceof DOMException &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');
    return fail(
      isTimeout ? 'upstream_timeout' : 'upstream_error',
      isTimeout ? 'Last.fm timed out.' : 'Could not reach Last.fm.',
      isTimeout ? 504 : 502,
    );
  }
}
