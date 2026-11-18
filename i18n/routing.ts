import { defineRouting } from 'next-intl/routing';
import { defaultLocale, locales } from '@/lib/locales';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: true,
  // The locale is part of the URL. Keeping the preference out of cookies means
  // the app stays stateless: nothing about the visitor is persisted.
  localeCookie: false,
});
