/**
 * Resolves the hero image for an artist:
 * 1. `/api/artist-image` finds a Deezer artist with a picture;
 * 2. the picture is preloaded through `/api/image-proxy` so the PNG export can
 *    read it from the same origin (no tainted canvas).
 *
 * Any failure resolves to `null`, which makes the card use the procedural
 * canvas fallback instead of showing a broken image.
 */
const IMAGE_TIMEOUT_MS = 8_000;

export async function resolveArtistImage(
  artist: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  if (!artist.trim() || signal?.aborted) return null;

  try {
    const response = await fetcher(`/api/artist-image?name=${encodeURIComponent(artist)}`, {
      signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as { imageUrl?: unknown };
    if (typeof payload.imageUrl !== 'string' || !payload.imageUrl) return null;

    const proxiedUrl = `/api/image-proxy?url=${encodeURIComponent(payload.imageUrl)}`;
    await preloadImage(proxiedUrl, signal);
    return proxiedUrl;
  } catch {
    return null;
  }
}

function preloadImage(src: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve();
    };

    const timer = setTimeout(() => finish(new Error('Image load timed out.')), IMAGE_TIMEOUT_MS);

    const onAbort = () => {
      image.src = '';
      finish(Object.assign(new Error('Image loading was cancelled.'), { name: 'AbortError' }));
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }

    signal?.addEventListener('abort', onAbort, { once: true });
    image.onload = () => finish();
    image.onerror = () => finish(new Error('Could not load the artist image.'));
    image.src = src;
  });
}
