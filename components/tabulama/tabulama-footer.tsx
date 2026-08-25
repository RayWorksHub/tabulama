import Link from 'next/link'
import { Mail, Clock, Users } from 'lucide-react'
import { TabuLamaLogo } from '@/components/tabulama/tabulama-logo'
import { provider } from '@/lib/tabulama-config'

const navItems = [
  { href: '/', label: 'Főoldal' },
  { href: '/tanfolyamok', label: 'Tanfolyamok' },
  { href: '/jelentkezes', label: 'Jelentkezés' },
]

export function TabuLamaFooter() {
  return (
    <footer className="border-t border-border bg-secondary/50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <TabuLamaLogo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Python programozás középiskolásoknak – programozói alapok,
              gyakorlati tudás és célzott vizsgafelkészítés egy képzésben.
            </p>
          </div>

          <div>
            <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-foreground">
              Navigáció
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-foreground">
              Képzés
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-primary" />
                12 hét · heti 3 alkalom
              </li>
              <li className="flex items-center gap-2">
                <Users className="h-4 w-4 shrink-0 text-primary" />
                10–15 fős kiscsoport
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                <a
                  href={`mailto:${provider.email}`}
                  className="transition-colors hover:text-primary"
                >
                  {provider.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} TabuLama Programozó Akadémia. Minden jog
          fenntartva.
        </div>
      </div>
    </footer>
  )
}
