import { describe, expect, it } from 'vitest';
import {
  CARD_THEMES,
  DEFAULT_CARD_THEME_ID,
  getCardTheme,
  isCardThemeId,
} from '@/lib/cardThemes';

describe('card themes', () => {
  it('exposes five fixed accent palettes', () => {
    expect(CARD_THEMES).toHaveLength(5);
    expect(new Set(CARD_THEMES.map((theme) => theme.id)).size).toBe(5);
    expect(new Set(CARD_THEMES.map((theme) => theme.accent)).size).toBe(5);
    expect(CARD_THEMES.map((theme) => theme.id)).toEqual([
      'ember',
      'tide',
      'moss',
      'plum',
      'sand',
    ]);
  });

  it('defaults to Ember', () => {
    expect(DEFAULT_CARD_THEME_ID).toBe('ember');
    expect(getCardTheme(DEFAULT_CARD_THEME_ID).accent).toBe('#F06848');
  });

  it('falls back to the default for unknown ids', () => {
    expect(getCardTheme('nope').id).toBe('ember');
    expect(getCardTheme(null).id).toBe('ember');
    expect(isCardThemeId('tide')).toBe(true);
    expect(isCardThemeId('nope')).toBe(false);
  });
});
