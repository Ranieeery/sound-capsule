/**
 * Single source of truth for the locale list.
 *
 * The default locale is represented as `pt` in the URL (e.g. `/pt`) but the
 * content is Brazilian Portuguese. `intlLocales` maps each app locale to the
 * BCP-47 tag used with `Intl` so dates and numbers are formatted with the
 * regional conventions the product promises (e.g. "4.231" in pt-BR vs
 * "4,231" in en-US).
 */
export const locales = ['pt', 'en', 'es', 'fr', 'de', 'it', 'ja'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'pt';

export const localeLabels: Record<Locale, string> = {
  pt: 'Português (BR)',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  ja: '日本語',
};

export const localeShorts: Record<Locale, string> = {
  pt: 'PT',
  en: 'EN',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
  it: 'IT',
  ja: 'JA',
};

export const intlLocales: Record<Locale, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  ja: 'ja-JP',
};

export function getIntlLocale(locale: string): string {
  return intlLocales[locale as Locale] ?? intlLocales[defaultLocale];
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
