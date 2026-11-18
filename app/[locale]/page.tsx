import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isLocale } from '@/lib/locales';
import { BackgroundCanvas } from '@/components/BackgroundCanvas';
import { CapsuleStudio } from '@/components/CapsuleStudio';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-ink">
      <BackgroundCanvas />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 lg:py-12">
          <CapsuleStudio />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
