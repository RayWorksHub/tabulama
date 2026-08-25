import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Poppins } from 'next/font/google'
import { TabuLamaHeader } from '@/components/tabulama/tabulama-header'
import { TabuLamaFooter } from '@/components/tabulama/tabulama-footer'
import { CookieConsent } from '@/components/tabulama/cookie-consent'
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
  title: 'TabuLama Programozó Akadémia – Python programozás középiskolásoknak',
  description:
    '12 hetes intenzív Python programozói képzés középiskolásoknak: programozói alapok, gyakorlati tudás és célzott vizsgafelkészítés egy képzésben.',
  icons: {
    icon: '/tabulama/tabulama-mark.webp',
    apple: '/apple-icon.png',
  },
  generator: 'v0.app',
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
        <div className="tabulama-theme flex min-h-dvh flex-col bg-background text-foreground">
          <TabuLamaHeader />
          <main className="flex-1">{children}</main>
          <TabuLamaFooter />
          <CookieConsent />
        </div>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
