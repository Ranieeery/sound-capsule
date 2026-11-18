'use client';

import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from './LocaleSwitcher';
import { BrandMark } from './BrandMark';

export function SiteHeader() {
  const t = useTranslations('Header');

  return (
    <header className="relative z-30 border-b border-line/80">
      <a
        href="#capsule-form"
        className="sr-only rounded-md bg-surface px-3 py-2 text-sm text-fg focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        {t('skip')}
      </a>

      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark size={28} />
          <span className="truncate text-sm font-semibold tracking-tight text-fg">
            {t('brand')}
          </span>
        </div>

        <LocaleSwitcher />
      </div>
    </header>
  );
}
