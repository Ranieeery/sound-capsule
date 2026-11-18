import { defineRouting } from 'next-intl/routing';
import { defaultLocale, locales } from '@/lib/locales';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: true,
  // Persist only the chosen language. No user or listening data is stored.
  localeCookie: {
    name: 'NEXT_LOCALE',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  },
});
