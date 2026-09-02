import Link from 'next/link'
import {
  ArrowRight,
  Banknote,
  BookOpen,
  Clock3,
  GraduationCap,
  Plus,
  UserCheck,
  Users,
} from 'lucide-react'
import { StatusBadge } from '@/components/admin/status-badge'
import { formatAdminDate } from '@/lib/admin-display'
import { getAdminDashboardStats, listApplications } from '@/lib/application-repository'
import { formatHUF } from '@/lib/tabulama-config'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const [stats, applications] = await Promise.all([
    getAdminDashboardStats(),
    listApplications(6),
  ])

  const cards = [
    { label: 'Aktív kurzusok', value: stats.activeCourses, icon: BookOpen },
    { label: 'Összes jelentkező', value: stats.applications, icon: Users },
    { label: 'Új jelentkezések', value: stats.newApplications, icon: Clock3 },
    { label: 'Aktív diákok', value: stats.activeStudents, icon: UserCheck },
    { label: 'Fizetésre vár', value: stats.awaitingPayment, icon: Banknote },
    { label: 'Közelgő kurzusok', value: stats.upcomingCourses, icon: GraduationCap },
  ]

  return (
    <div className="tl-page">
      <header className="tl-page-header">
        <div>
          <p className="tl-page-eyebrow">Admin Center</p>
          <h1>Áttekintés</h1>
          <p>A kurzusok, tanulók és jelentkezések aktuális állapota.</p>
        </div>
      </header>

      <nav className="tl-commandbar" aria-label="Gyors műveletek">
        <Link href="/admin/kurzusok/uj" className="tl-command tl-command-primary">
          <Plus className="h-4 w-4" />
          Új kurzus
        </Link>
        <Link href="/admin/jelentkezok" className="tl-command">
          <Users className="h-4 w-4" />
          Jelentkezők kezelése
        </Link>
        <Link href="/admin/diakok" className="tl-command">
          <GraduationCap className="h-4 w-4" />
          Diákok megnyitása
        </Link>
      </nav>

      <section className="tl-metric-grid" aria-label="Fő mutatók">
        {cards.map((card) => (
          <article key={card.label} className="tl-metric-card">
            <div className="tl-metric-icon" aria-hidden="true">
              <card.icon className="h-5 w-5" />
            </div>
            <div>
              <p>{card.label}</p>
              <strong>{card.value}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="tl-finance-strip" aria-label="Pénzügyi összesítés">
        <article>
          <div className="tl-finance-strip-icon is-positive" aria-hidden="true">
            <Banknote className="h-5 w-5" />
          </div>
          <div>
            <p>Beérkezett összeg</p>
            <strong className="is-positive">{formatHUF(stats.receivedAmountHuf)}</strong>
            <span>Valódi befizetési rekordokból, TESZT nélkül.</span>
          </div>
        </article>
        <article>
          <div className="tl-finance-strip-icon is-warning" aria-hidden="true">
            <Clock3 className="h-5 w-5" />
          </div>
          <div>
            <p>Nyilvántartott hátralék</p>
            <strong className="is-warning">{formatHUF(stats.outstandingAmountHuf)}</strong>
            <span>Fizetési tervekből és befizetésekből, TESZT nélkül.</span>
          </div>
        </article>
      </section>

      <section className="tl-data-panel">
        <div className="tl-data-panel-header">
          <div>
            <h2>Legújabb jelentkezések</h2>
            <p>A legutóbb beérkezett adatok.</p>
          </div>
          <Link href="/admin/jelentkezok" className="tl-panel-link">
            Összes megnyitása
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {applications.length === 0 ? (
          <p className="tl-empty-state">Még nincs jelentkezés.</p>
        ) : (
          <div className="tl-application-list">
            <div className="tl-application-list-head" aria-hidden="true">
              <span>Jelentkező és kurzus</span>
              <span>Állapot</span>
              <span>Beérkezett</span>
            </div>
            {applications.map((application) => (
              <Link
                key={application.id}
                href={`/admin/jelentkezok/${application.id}`}
                className="tl-application-row"
              >
                <div>
                  <p>
                    {application.participantName}
                    {application.isTest ? <span className="tl-test-badge">TESZT</span> : null}
                  </p>
                  <span>{application.courseTitle}</span>
                </div>
                <StatusBadge status={application.status} />
                <time>{formatAdminDate(application.createdAt)}</time>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
