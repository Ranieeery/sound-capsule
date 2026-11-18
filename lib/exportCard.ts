import { toBlob } from 'html-to-image';
import { CARD_EXPORT_HEIGHT, CARD_EXPORT_WIDTH, CARD_HEIGHT, CARD_WIDTH } from '@/components/CapsuleCard';

/** 432 × 2.5 = 1080 and 768 × 2.5 = 1920. */
const PIXEL_RATIO = CARD_EXPORT_WIDTH / CARD_WIDTH;

/**
 * html-to-image embeds every @font-face it can find in the document. With CJK
 * fonts (self-hosted as many unicode-range slices) that would mean fetching
 * dozens of files for a caption like "坂本龍一". This builder keeps only the
 * @font-face rules whose unicode-range intersects the characters actually
 * rendered in the card, then inlines exactly those files as data URLs.
 */
async function buildFontEmbedCss(node: HTMLElement): Promise<string> {
  const text = `${node.innerText ?? ''}\n${node.textContent ?? ''}`;
  const codepoints = new Set<number>([32]);
  for (const character of Array.from(text)) {
    const codepoint = character.codePointAt(0);
    if (codepoint !== undefined) codepoints.add(codepoint);
  }

  const fontFaces: CSSFontFaceRule[] = [];

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // Cross-origin stylesheets cannot be inspected; skip them.
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule) fontFaces.push(rule);
    }
  }

  if (fontFaces.length === 0) return '';

  const used = fontFaces.filter((rule) =>
    unicodeRangeIntersects(rule.style.getPropertyValue('unicode-range'), codepoints),
  );

  const dataUrlCache = new Map<string, Promise<string | null>>();
  const parts: string[] = [];

  for (const rule of used) {
    let css = rule.cssText;

    for (const rawUrl of extractUrls(css)) {
      if (rawUrl.startsWith('data:')) continue;

      let absolute: string;
      try {
        absolute = new URL(rawUrl, document.baseURI).href;
      } catch {
        continue;
      }

      let pending = dataUrlCache.get(absolute);
      if (!pending) {
        pending = fetchAsDataUrl(absolute);
        dataUrlCache.set(absolute, pending);
      }

      const dataUrl = await pending;
      if (dataUrl) css = css.split(rawUrl).join(dataUrl);
    }

    parts.push(css);
  }

  return parts.join('\n');
}

function extractUrls(css: string): string[] {
  const urls: string[] = [];
  const pattern = /url\((['"]?)([^'")]+)\1\)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(css)) !== null) {
    urls.push(match[2]);
  }

  return urls;
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) return null;
    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function parseUnicodeRange(value: string): Array<[number, number]> {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap<[number, number]>((part) => {
      const match = /^U\+([0-9A-Fa-f?]+)(?:-([0-9A-Fa-f]+))?$/.exec(part);
      if (!match) return [];

      const startToken = match[1];
      if (startToken.includes('?')) {
        const start = Number.parseInt(startToken.replace(/\?/g, '0'), 16);
        const end = Number.parseInt(startToken.replace(/\?/g, 'F'), 16);
        return [[start, end]];
      }

      const start = Number.parseInt(startToken, 16);
      const end = match[2] ? Number.parseInt(match[2], 16) : start;
      return [[start, end]];
    });
}

function unicodeRangeIntersects(range: string, codepoints: Set<number>): boolean {
  if (!range) return true;

  const ranges = parseUnicodeRange(range);
  if (ranges.length === 0) return true;

  for (const codepoint of codepoints) {
    for (const [start, end] of ranges) {
      if (codepoint >= start && codepoint <= end) return true;
    }
  }

  return false;
}

async function waitForTwoFrames(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function waitForCardAssets(node: HTMLElement): Promise<void> {
  // Fonts may be requested only after layout, so give the browser a frame
  // before waiting on `document.fonts.ready`.
  await waitForTwoFrames();

  await Promise.all(
    Array.from(node.querySelectorAll('img')).map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          image.addEventListener('load', done, { once: true });
          image.addEventListener('error', done, { once: true });
        });
      }
      try {
        await image.decode();
      } catch {
        // Decoding can fail for broken images; the fallback is already visible.
      }
    }),
  );

  await document.fonts.ready;
  await waitForTwoFrames();
}

export async function renderCardToBlob(node: HTMLElement): Promise<Blob> {
  await waitForCardAssets(node);

  const fontEmbedCSS = await buildFontEmbedCss(node).catch(() => '');

  const blob = await toBlob(node, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    canvasWidth: CARD_WIDTH,
    canvasHeight: CARD_HEIGHT,
    pixelRatio: PIXEL_RATIO,
    backgroundColor: '#212121',
    cacheBust: false,
    // html-to-image caches fetched resources by URL without the query string by
    // default. Our image-proxy URLs differ only in ?url=..., so without this the
    // second capsule could reuse the previous artist photo.
    includeQueryParams: true,
    ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
  });

  if (!blob) {
    throw new Error('The capsule image could not be rendered.');
  }

  return blob;
}
