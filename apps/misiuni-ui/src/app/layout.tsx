import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const sans = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono' });

export const metadata: Metadata = {
  metadataBase: new URL('https://misiuni.ro'),
  title: 'Misiuni.ro | In curand',
  description:
    'Misiuni.ro pregateste o platforma premium pentru audituri retail, activari, verificari locale si misiuni reale in teren in Romania.',
  applicationName: 'Misiuni.ro',
  keywords: [
    'misiuni romania',
    'audituri retail',
    'merchandising romania',
    'activari brand',
    'field marketing',
    'verificari in teren',
    'foto proof',
    'mystery shopping romania',
  ],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ro_RO',
    url: 'https://misiuni.ro/',
    siteName: 'Misiuni.ro',
    title: 'Misiuni.ro | In curand',
    description:
      'Platforma premium in curs de lansare pentru audituri retail, activari, verificari locale si misiuni reale in teren in Romania.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Misiuni.ro | In curand',
    description:
      'Audituri retail, activari, verificari locale si executie in teren. Misiuni.ro intra in lansare publica in curand.',
  },
  other: {
    'geo.region': 'RO',
    'geo.placename': 'Romania',
    language: 'ro-RO',
  },
};

export const viewport: Viewport = {
  themeColor: '#f6f0e8',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body className={`${sans.variable} ${mono.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}