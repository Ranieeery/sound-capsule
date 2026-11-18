/**
 * Cache headers that keep user data out of the browser cache while allowing the
 * Vercel CDN (and other CDNs) to cache the response. Cache hits do not invoke
 * the serverless function.
 */
export function cdnCacheHeaders(
  sMaxAgeSeconds: number,
  staleWhileRevalidateSeconds = 60,
): Record<string, string> {
  const shared = `public, s-maxage=${sMaxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`;

  return {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'CDN-Cache-Control': shared,
    'Vercel-CDN-Cache-Control': shared,
  };
}

export const NO_STORE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
};
