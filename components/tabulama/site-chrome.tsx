'use client'

import { usePathname } from 'next/navigation'
import { StudentWorkspaceChrome } from '@/components/portal/student-workspace-chrome'
import { CookieConsent } from '@/components/tabulama/cookie-consent'
import { TabuLamaFooter } from '@/components/tabulama/tabulama-footer'
import { TabuLamaHeader } from '@/components/tabulama/tabulama-header'

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const studentWorkspace = pathname === '/portal'
    || (pathname.startsWith('/portal/') && !pathname.startsWith('/portal/aktivalas'))

  if (pathname.startsWith('/admin')) {
    return <div className="min-h-dvh bg-[#f5f5f5] text-[#242424]">{children}</div>
  }

  if (studentWorkspace) {
    return <StudentWorkspaceChrome>{children}</StudentWorkspaceChrome>
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
