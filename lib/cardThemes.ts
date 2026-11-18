/**
 * Fixed card accent palettes (Option A). Only the accent changes; the card
 * keeps its solid #212121 body and neutral typography. All accents were chosen
 * to keep the large minutes text readable against #212121.
 */
export const CARD_THEMES = [
  { id: 'ember', name: 'Ember', accent: '#F06848' },
  { id: 'tide', name: 'Tide', accent: '#5B9DFF' },
  { id: 'moss', name: 'Moss', accent: '#7ED08A' },
  { id: 'plum', name: 'Plum', accent: '#C084FC' },
  { id: 'sand', name: 'Sand', accent: '#E7C27A' },
] as const;

export type CardTheme = (typeof CARD_THEMES)[number];
export type CardThemeId = CardTheme['id'];

export const DEFAULT_CARD_THEME_ID: CardThemeId = 'ember';
export const CARD_THEME_STORAGE_KEY = 'sound-capsule:theme';

export function isCardThemeId(value: string | null | undefined): value is CardThemeId {
  return CARD_THEMES.some((theme) => theme.id === value);
}

export function getCardTheme(id: string | null | undefined): CardTheme {
  return CARD_THEMES.find((theme) => theme.id === id) ?? CARD_THEMES[0];
}

/** Reads the persisted accent id. This is the only card setting we store. */
export function readStoredCardTheme(): CardThemeId {
  if (typeof window === 'undefined') return DEFAULT_CARD_THEME_ID;
  try {
    const stored = window.localStorage.getItem(CARD_THEME_STORAGE_KEY);
    return isCardThemeId(stored) ? stored : DEFAULT_CARD_THEME_ID;
  } catch {
    return DEFAULT_CARD_THEME_ID;
  }
}

export function storeCardTheme(id: CardThemeId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CARD_THEME_STORAGE_KEY, id);
  } catch {
    // Storage can be unavailable (private mode, quota); the session still works.
  }
}
