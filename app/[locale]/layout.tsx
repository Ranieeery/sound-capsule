import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Geist, Geist_Mono, Noto_Sans_JP, Noto_Sans_KR, Noto_Sans_SC } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { locales, type Locale } from '@/lib/locales';
import { SITE_URL } from '@/lib/site';
import '../globals.css';

const geistSans = Geist({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  display: 'swap',
  variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  display: 'swap',
  variable: '--font-geist-mono',
});

// CJK names must render on any OS, not only where a local Japanese/Korean/
// Chinese font happens to be installed. The fonts are split into unicode-range
// slices by Google, so browsers only download the slices a card actually uses.
const notoSansJp = Noto_Sans_JP({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-noto-jp',
});

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-noto-kr',
});

const notoSansSc = Noto_Sans_SC({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-noto-sc',
});

const htmlLang: Record<Locale, string> = {
  pt: 'pt-BR',
  en: 'en',
  es: 'es',
  fr: 'fr',
  de: 'de',
  it: 'it',
  ja: 'ja',
  ko: 'ko',
  zh: 'zh-CN',
  ru: 'ru',
  pl: 'pl',
};

const openGraphLocales: Record<Locale, string> = {
  pt: 'pt_BR',
  en: 'en_US',
  es: 'es_ES',
  fr: 'fr_FR',
  de: 'de_DE',
  it: 'it_IT',
  ja: 'ja_JP',
  ko: 'ko_KR',
  zh: 'zh_CN',
  ru: 'ru_RU',
  pl: 'pl_PL',
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const ogImage = {
    url: `/og/${locale}.png`,
    width: 1200,
    height: 630,
    alt: t('ogTitle'),
  };

  return {
    metadataBase: new URL(SITE_URL),
    title: t('title'),
    description: t('description'),
    applicationName: 'Sound Capsule',
    openGraph: {
      title: t('ogTitle'),
      description: t('ogDescription'),
      type: 'website',
      locale: openGraphLocales[locale as Locale],
      siteName: 'Sound Capsule',
      url: `${SITE_URL}/${locale}`,
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('ogTitle'),
      description: t('ogDescription'),
      images: [ogImage.url],
    },
    alternates: {
      canonical: `/${locale}`,
      languages: {
        'pt-BR': '/pt',
        en: '/en',
        es: '/es',
        fr: '/fr',
        de: '/de',
        it: '/it',
        ja: '/ja',
        ko: '/ko',
        'zh-CN': '/zh',
        ru: '/ru',
        pl: '/pl',
        'x-default': '/pt',
      },
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#0f0f10',
  colorScheme: 'dark',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  // The /_vercel/* endpoints only exist on Vercel; keep local dev free of 404s.
  const observabilityEnabled = process.env.VERCEL === '1';

  return (
    <html
      lang={htmlLang[locale as Locale]}
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansJp.variable} ${notoSansKr.variable} ${notoSansSc.variable}`}
    >
      <body className="min-h-dvh bg-ink font-sans text-fg antialiased">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        {observabilityEnabled && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </html>
  );
}
