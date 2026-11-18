import type { MetadataRoute } from 'next';
import { intlLocales, locales } from '@/lib/locales';
import { SITE_URL } from '@/lib/site';

const languageAlternates = Object.fromEntries([
  ...locales.map((locale) => [intlLocales[locale], `${SITE_URL}/${locale}`]),
  ['x-default', `${SITE_URL}/pt`],
]);

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return locales.map((locale) => ({
    url: `${SITE_URL}/${locale}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: locale === 'pt' ? 1 : 0.8,
    alternates: { languages: languageAlternates },
  }));
}
