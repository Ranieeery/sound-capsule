import { NextResponse } from 'next/server';

/**
 * Same-origin image proxy for Deezer's CDN. Serving the hero image from our
 * origin keeps the html-to-image export free of "tainted canvas" errors, while
 * the strict host whitelist prevents this route from becoming an SSRF vector.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=60';
const DEEZER_HOST_PATTERN = /(^|\.)dzcdn\.net$/i;
const UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function fail(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: code, message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isAllowedImageUrl(value: URL): boolean {
  return value.protocol === 'https:' && DEEZER_HOST_PATTERN.test(value.hostname);
}

export async function GET(request: Request): Promise<NextResponse> {
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return fail('invalid_request', 'Malformed request URL.', 400);
  }

  const rawUrl = requestUrl.searchParams.get('url');
  if (!rawUrl) {
    return fail('invalid_request', 'Parameter "url" is required.', 400);
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return fail('invalid_request', 'Parameter "url" must be a valid URL.', 400);
  }

  if (!isAllowedImageUrl(target)) {
    return fail('invalid_request', 'Only https://*.dzcdn.net images are allowed.', 400);
  }

  try {
    const upstream = await fetch(target, {
      headers: { Accept: 'image/*' },
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      redirect: 'follow',
    });

    // Re-check after redirects so a CDN redirect cannot escape the whitelist.
    if (!isAllowedImageUrl(new URL(upstream.url))) {
      return fail('invalid_request', 'Image redirect left the allowed host.', 400);
    }

    if (!upstream.ok) {
      return fail('upstream_error', `Image host responded with ${upstream.status}.`, 502);
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      return fail('upstream_error', 'The upstream resource is not an image.', 502);
    }

    const declaredLength = Number(upstream.headers.get('content-length') ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
      return fail('payload_too_large', 'The image is too large.', 413);
    }

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return fail('payload_too_large', 'The image is too large.', 413);
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Cache-Control': CACHE_CONTROL,
        'Content-Type': contentType,
        'Content-Length': String(buffer.byteLength),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const isTimeout =
      error instanceof DOMException &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');
    return fail(
      isTimeout ? 'upstream_timeout' : 'upstream_error',
      isTimeout ? 'Image host timed out.' : 'Could not download the image.',
      isTimeout ? 504 : 502,
    );
  }
}
