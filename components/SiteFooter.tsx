import { getTranslations } from 'next-intl/server';

export async function SiteFooter() {
  const t = await getTranslations('Footer');

  return (
    <footer className="mt-4 border-t border-line/80">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-6 text-xs leading-relaxed text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>{t('note')}</p>
        <div className="flex flex-col gap-1 sm:items-end">
          <a
            href="https://www.last.fm"
            target="_blank"
            rel="noreferrer"
            className="w-fit text-muted underline-offset-2 transition-colors hover:text-fg hover:underline"
          >
            {t('poweredBy')}
          </a>
          <p>{t('disclaimer')}</p>
        </div>
      </div>
    </footer>
  );
}
