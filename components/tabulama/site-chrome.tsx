'use client'

import { usePathname } from 'next/navigation'
import { CookieConsent } from '@/components/tabulama/cookie-consent'
import { TabuLamaFooter } from '@/components/tabulama/tabulama-footer'
import { TabuLamaHeader } from '@/components/tabulama/tabulama-header'

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname.startsWith('/admin')) {
    return <div className="min-h-dvh bg-[#f4f6f8] text-[#1b2430]">{children}</div>
  }

  return (
    <div className="tabulama-theme flex min-h-dvh flex-col bg-background text-foreground">
      <TabuLamaHeader />
      <main className="flex-1">{children}</main>
      <TabuLamaFooter />
      <CookieConsent />
    </div>
  )
}
