'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogIn, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { TabuLamaLogo } from '@/components/tabulama/tabulama-logo'

const navItems = [
  { href: '/', label: 'Főoldal' },
  { href: '/kurzusok', label: 'Kurzusok' },
]

export function TabuLamaHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) =>
    href === '/' ? pathname === href : pathname.startsWith(href)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" aria-label="TabuLama Programozó Akadémia">
          <TabuLamaLogo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
          >
            <LogIn className="mr-2 h-4 w-4" />
            Bejelentkezés
          </Link>
          <Link
            href="/jelentkezes"
            className={buttonVariants({ size: 'lg' })}
          >
            Jelentkezés
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground md:hidden"
          aria-label={open ? 'Menü bezárása' : 'Menü megnyitása'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-lg px-4 py-3 text-base font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'mt-2')}
            >
              Bejelentkezés
            </Link>
            <Link
              href="/jelentkezes"
              onClick={() => setOpen(false)}
              className={buttonVariants({ size: 'lg' })}
            >
              Jelentkezés
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  )
}
