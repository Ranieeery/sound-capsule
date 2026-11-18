import { getTranslations } from 'next-intl/server';

export async function SiteFooter() {
  const t = await getTranslations('Footer');

  return (
    <footer className="mt-4 border-t border-line/80">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-5 py-6 text-xs leading-relaxed text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>{t('note')}</p>
        <p>{t('disclaimer')}</p>
      </div>
    </footer>
  );
}
