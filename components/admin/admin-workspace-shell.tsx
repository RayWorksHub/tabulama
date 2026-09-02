'use client'

import Image from 'next/image'
import Link from 'next/link'
import { BookOpen, GraduationCap, Grid3X3, LayoutDashboard, LogOut, Users } from 'lucide-react'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/admin', label: 'Áttekintés', icon: LayoutDashboard },
  { href: '/admin/jelentkezok', label: 'Jelentkezők', icon: Users },
  { href: '/admin/diakok', label: 'Diákok', icon: GraduationCap },
  { href: '/admin/kurzusok', label: 'Kurzusok', icon: BookOpen },
]

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function initialsFromEmail(email: string): string {
  const localPart = email.split('@')[0]?.replace(/[^a-zA-Z0-9]+/g, ' ').trim() ?? ''
  const pieces = localPart.split(/\s+/).filter(Boolean)
  if (pieces.length >= 2) return `${pieces[0][0]}${pieces[1][0]}`.toUpperCase()
  return localPart.slice(0, 2).toUpperCase() || 'TL'
}

export function AdminWorkspaceShell({
  children,
  email,
}: {
  children: React.ReactNode
  email: string
}) {
  const pathname = usePathname()

  return (
    <div className="tl-workspace tl-admin-workspace">
      <header className="tl-workspace-appbar">
        <Link href="/admin" className="tl-workspace-brand" aria-label="TabuLama Admin kezdőlap">
          <span className="tl-workspace-launcher" aria-hidden="true">
            <Grid3X3 className="h-4 w-4" />
          </span>
          <Image
            src="/tabulama/tabulama-mark.webp"
            alt=""
            width={28}
            height={28}
            priority
            className="tl-workspace-logo"
          />
          <span className="tl-workspace-product">TabuLama</span>
          <span className="tl-workspace-divider" aria-hidden="true" />
          <span className="tl-workspace-area">Admin Center</span>
        </Link>

        <p className="tl-workspace-context">Kurzus- és tanulókezelés</p>

        <div className="tl-workspace-account" title={email}>
          <span className="tl-workspace-account-copy">
            <strong>Adminisztrátor</strong>
            <span>{email}</span>
          </span>
          <span className="tl-workspace-avatar" aria-hidden="true">{initialsFromEmail(email)}</span>
        </div>
      </header>

      <div className="tl-workspace-frame">
        <aside className="tl-workspace-sidebar">
          <p className="tl-workspace-sidebar-title">Munkaterület</p>
          <nav className="tl-workspace-navigation" aria-label="Admin navigáció">
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`tl-workspace-nav-item ${active ? 'is-active' : ''}`}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="tl-workspace-sidebar-footer">
            <form action="/api/session/logout" method="post">
              <button type="submit" className="tl-workspace-signout">
                <LogOut className="h-[18px] w-[18px]" />
                Kijelentkezés
              </button>
            </form>
          </div>
        </aside>

        <main className="tl-workspace-main">{children}</main>
      </div>
    </div>
  )
}
