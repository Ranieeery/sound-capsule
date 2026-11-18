'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { localeLabels, locales, type Locale } from '@/lib/locales';
import { BrandMark } from './BrandMark';

export function SiteHeader() {
  const t = useTranslations('Header');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function onLocaleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value as Locale;
    // Persist only the language preference. next-intl also handles this via its
    // locale cookie, but setting it explicitly keeps the behavior independent
    // of navigation timing.
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <header className="border-b border-line/80">
      <a
        href="#capsule-form"
        className="sr-only rounded-md bg-surface px-3 py-2 text-sm text-fg focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        {t('skip')}
      </a>

      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark size={28} />
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold tracking-tight text-fg">
              {t('brand')}
            </span>
            <span className="hidden shrink-0 rounded border border-line bg-surface px-2 py-0.5 font-mono text-[11px] text-muted sm:inline">
              {t('forLastfm')}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label htmlFor="locale-select" className="sr-only">
            {t('language')}
          </label>
          <select
            id="locale-select"
            value={locale}
            onChange={onLocaleChange}
            className="cursor-pointer rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-fg transition-colors hover:border-line-strong focus:border-accent"
          >
            {locales.map((item) => (
              <option key={item} value={item}>
                {localeLabels[item]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
