import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Poppins } from 'next/font/google'
import { SiteChrome } from '@/components/tabulama/site-chrome'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})
const poppins = Poppins({
  variable: '--font-tabu',
  weight: ['500', '600', '700', '800'],
  subsets: ['latin', 'latin-ext'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://tabulama.com'),
  title: {
    default: 'TabuLama Programozó Akadémia',
    template: '%s | TabuLama',
  },
  description:
    '12 hetes intenzív Python programozói képzés középiskolásoknak: programozói alapok, gyakorlati tudás és célzott vizsgafelkészítés egy képzésben.',
  icons: {
    icon: '/tabulama/tabulama-mark.webp',
    apple: '/apple-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'hu_HU',
    title: 'TabuLama Programozó Akadémia',
    description:
      'Python programozás középiskolásoknak, gyakorlati tudással és célzott vizsgafelkészítéssel.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'TabuLama Programozó Akadémia – Python programozás középiskolásoknak',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TabuLama Programozó Akadémia',
    description: 'Python programozás középiskolásoknak.',
    images: ['/og.png'],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#1b2430',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="hu"
      className={`light ${geistSans.variable} ${geistMono.variable} ${poppins.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        <SiteChrome>{children}</SiteChrome>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
