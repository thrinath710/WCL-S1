import type { Metadata, Viewport } from 'next';
import { Bebas_Neue, Source_Sans_3 } from 'next/font/google';
import './globals.css';
import { getSnapshot } from '@/lib/queries';
import { siteUrl } from '@/lib/env';

/**
 * Bebas Neue for anything that shouts -- scores, headlines, team names in a
 * bracket. Source Sans 3 carries the reading text. The pairing is the one the
 * design system recommends for sport: condensed impact over a neutral,
 * highly legible body face.
 */
const bebas = Bebas_Neue({
  variable: '--font-bebas',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  variable: '--font-source-sans',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#070b09',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * Titles and share previews come from the live tournament name, so renaming
 * the tournament in the admin area renames it everywhere including the
 * WhatsApp link preview.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSnapshot();
  const url = siteUrl();
  const description =
    settings.tagline ?? 'Live scores, fixtures, standings and stats.';

  return {
    metadataBase: new URL(url),
    title: { default: settings.name, template: `%s · ${settings.name}` },
    description,
    applicationName: settings.name,
    keywords: ['Woxsen', 'football', 'tournament', '6-a-side', 'fixtures', 'league table'],
    openGraph: {
      type: 'website',
      siteName: settings.name,
      title: settings.name,
      description,
      url,
      images: [{ url: '/api/og', width: 1200, height: 630, alt: settings.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: settings.name,
      description,
      images: ['/api/og'],
    },
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${bebas.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="min-h-full text-chalk">{children}</body>
    </html>
  );
}
