import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, LayoutDashboard, LogOut, Users } from 'lucide-react'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const navItems = [
  { href: '/admin', label: 'Áttekintés', icon: LayoutDashboard },
  { href: '/admin/jelentkezok', label: 'Jelentkezők', icon: Users },
  { href: '/admin/kurzusok', label: 'Kurzusok', icon: BookOpen },
]

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin('/admin')

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-slate-200 bg-[#1b2430] px-4 py-4 text-white lg:min-h-dvh lg:border-b-0 lg:px-5 lg:py-6">
        <div className="flex items-center justify-between lg:block">
          <Link href="/admin" className="flex items-center gap-3">
            <Image src="/tabulama/tabulama-mark.webp" alt="" width={42} height={42} priority />
            <span className="font-bold">TabuLama Admin</span>
          </Link>
          <form action="/api/admin/session/logout" method="post" className="lg:hidden">
            <button type="submit" aria-label="Kilépés" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white">
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </div>

        <nav className="mt-4 flex gap-2 overflow-x-auto lg:mt-8 lg:flex-col" aria-label="Admin navigáció">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 hidden border-t border-white/10 pt-5 lg:block">
          <p className="truncate text-xs text-slate-400">{session.email}</p>
          <form action="/api/admin/session/logout" method="post" className="mt-3">
            <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4" />
              Kilépés
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-7 sm:px-6 lg:px-10 lg:py-9">{children}</main>
    </div>
  )
}
