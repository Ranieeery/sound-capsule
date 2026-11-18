/**
 * Last.fm usernames are often shared as profile URLs
 * (https://www.last.fm/user/Raniery_). The username field shows a static
 * `last.fm/user/` prefix, so pasted URLs must be reduced to the username
 * before validation or the request would fail.
 */
const LASTFM_PROFILE_URL = /\blast\.fm\/user\/([^/?#\s]+)/i;

/** Extracts the username from a Last.fm profile URL, if the text contains one. */
export function extractLastfmUsername(value: string): string | null {
  const match = LASTFM_PROFILE_URL.exec(value ?? '');
  if (!match) return null;

  let username = match[1];
  try {
    username = decodeURIComponent(username);
  } catch {
    // Keep the raw value when it contains malformed percent-encoding.
  }

  return username.trim().replace(/^@+/, '');
}

/**
 * Normalizes whatever the visitor typed or pasted into a bare username:
 * profile URLs, values with a leading `@`, and accidental trailing slashes.
 */
export function normalizeLastfmUsernameInput(value: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';

  const fromUrl = extractLastfmUsername(trimmed);
  if (fromUrl !== null) return fromUrl;

  return trimmed.replace(/^@+/, '').replace(/\/+$/, '');
}
