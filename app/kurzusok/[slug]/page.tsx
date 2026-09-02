import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Gift,
  GraduationCap,
  Star,
  TrendingDown,
  Users,
} from 'lucide-react'
import {
  buildCoursePaymentOptions,
  type CoursePaymentOption,
} from '@/lib/course-payment-options'
import {
  courseAcceptsApplications,
  getPublicCourseBySlug,
} from '@/lib/course-repository'
import {
  formatHUF,
  formatHuDate,
  formatHuDateTime,
} from '@/lib/tabulama-config'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const course = await getPublicCourseBySlug(slug)

  return course
    ? { title: `${course.shortTitle} | TabuLama`, description: course.summary }
    : { title: 'Kurzus nem található | TabuLama' }
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const course = await getPublicCourseBySlug(slug)
  if (!course) notFound()

  const accepting = courseAcceptsApplications(course)
  const options = buildCoursePaymentOptions(course)
  const standardOption = options.standard
  if (!standardOption) throw new Error('A kurzus normál ára hiányzik.')

  const featuredOption = options['early-bird'] ?? standardOption
  const alternativeOptions = [
    featuredOption.key === standardOption.key ? null : standardOption,
    options.installment,
  ].filter(isPaymentOption)
  const syllabus =
    course.syllabus
      ?.split('\n')
      .map((item) => item.trim())
      .filter(Boolean) ?? []

  return (
    <div>
      <section className="relative overflow-hidden bg-navy px-4 py-16 text-navy-foreground sm:px-6 sm:py-20">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(189,139,60,.22),transparent_45%)]"
        />
        <div className="relative mx-auto max-w-6xl">
          <span className="inline-flex rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
            {course.category}
          </span>
          <h1 className="font-heading mt-6 max-w-4xl break-words text-balance text-4xl font-extrabold sm:text-5xl">
            {course.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-navy-foreground/75">
            {course.summary}
          </p>
          {accepting ? (
            <Link
              href={`/jelentkezes?course=${encodeURIComponent(course.slug)}`}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground"
            >
              Jelentkezem
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <p className="mt-8 inline-flex rounded-full border border-navy-foreground/20 px-5 py-3 font-semibold">
              {course.status === 'full' || course.remainingCapacity === 0
                ? 'A kurzus betelt'
                : 'A jelentkezés jelenleg zárva'}
            </p>
          )}
        </div>
      </section>

      <section className="border-b border-border bg-muted/35 px-4 py-8 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact
            icon={CalendarDays}
            label="Időszak"
            value={
              course.startDate
                ? `${formatHuDate(course.startDate)}${
                    course.endDate ? ` – ${formatHuDate(course.endDate)}` : ''
                  }`
                : 'Egyeztetés alatt'
            }
          />
          <Fact
            icon={Clock}
            label="Heti időpontok"
            value={course.weeklySchedule ?? 'Egyeztetés alatt'}
          />
          <Fact
            icon={Users}
            label="Férőhely"
            value={
              course.maxCapacity === null
                ? `${course.currentHeadcount} fő`
                : `${course.remainingCapacity} szabad / ${course.maxCapacity}`
            }
          />
          <Fact
            icon={GraduationCap}
            label="Oktató"
            value={course.instructorName ?? 'Hamarosan'}
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,.75fr)] lg:px-8">
        <div className="min-w-0">
          <h2 className="font-heading text-3xl font-bold">A kurzusról</h2>
          <div className="mt-5 whitespace-pre-line leading-relaxed text-muted-foreground">
            {course.description}
          </div>
          {course.targetAudience ? (
            <>
              <h3 className="font-heading mt-9 text-xl font-bold">Kinek szól?</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {course.targetAudience}
              </p>
            </>
          ) : null}
          {course.prerequisites ? (
            <>
              <h3 className="font-heading mt-7 text-xl font-bold">Előfeltételek</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {course.prerequisites}
              </p>
            </>
          ) : null}
        </div>

        <aside className="self-start rounded-3xl border border-border bg-secondary/40 p-6">
          <h2 className="font-heading text-xl font-bold">Jelentkezési állapot</h2>
          <p className="mt-3 text-muted-foreground">
            {accepting
              ? 'A jelentkezés nyitva.'
              : 'A jelentkezés jelenleg nem elérhető.'}
          </p>
          {course.applicationDeadline ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Határidő: {formatHuDateTime(course.applicationDeadline)}
            </p>
          ) : null}
          <p className="mt-4 font-semibold">
            {course.remainingCapacity === null
              ? 'Nincs létszámkorlát megadva.'
              : `${course.remainingCapacity} szabad hely maradt.`}
          </p>
        </aside>
      </section>

      {syllabus.length ? (
        <section className="bg-muted/50 py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="font-heading text-center text-3xl font-bold">Tematika</h2>
            <ol className="mt-9 grid gap-4">
              {syllabus.map((item, index) => (
                <li
                  key={`${index}-${item}`}
                  className="flex gap-4 rounded-2xl border border-border bg-card p-5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                    {index + 1}
                  </span>
                  <span className="min-w-0 break-words pt-1.5 text-muted-foreground">
                    {item}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      <PricingSection
        courseSlug={course.slug}
        accepting={accepting}
        featuredOption={featuredOption}
        standardOption={standardOption}
        alternativeOptions={alternativeOptions}
      />
    </div>
  )
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-semibold">{value}</p>
      </div>
    </div>
  )
}

function PricingSection({
  courseSlug,
  accepting,
  featuredOption,
  standardOption,
  alternativeOptions,
}: {
  courseSlug: string
  accepting: boolean
  featuredOption: CoursePaymentOption
  standardOption: CoursePaymentOption
  alternativeOptions: CoursePaymentOption[]
}) {
  const discounted = featuredOption.key === 'early-bird'

  return (
    <section className="bg-navy py-20 text-navy-foreground">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-[0.15em] text-primary">
            Árak és fizetési lehetőségek
          </span>
          <h2 className="font-heading mt-4 text-balance text-3xl font-bold leading-tight sm:text-4xl">
            Választható fizetési konstrukciók
          </h2>
          <p className="mx-auto mt-4 text-pretty leading-relaxed text-navy-foreground/75">
            Az itt látható összegek és határidők ehhez a kurzushoz tartoznak.
          </p>
        </div>

        <div
          className={`mt-12 grid gap-6 ${
            alternativeOptions.length ? 'lg:grid-cols-5' : ''
          }`}
        >
          <article
            className={`relative flex h-full flex-col overflow-hidden rounded-3xl border-2 border-primary bg-secondary p-6 text-foreground shadow-xl sm:p-8 ${
              alternativeOptions.length ? 'lg:col-span-3' : 'mx-auto w-full max-w-3xl'
            }`}
          >
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">
              <Star className="h-3.5 w-3.5" />
              {discounted
                ? featuredOption.available
                  ? 'Kedvezményes ajánlat'
                  : 'Lejárt kedvezmény'
                : 'Egyösszegű fizetés'}
            </span>

            <h3 className="font-heading mt-5 text-2xl font-bold">
              {featuredOption.name}
            </h3>

            {featuredOption.savingsVsStandard ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-sm font-semibold text-primary">
                  <TrendingDown className="h-4 w-4" />
                  {formatHUF(featuredOption.savingsVsStandard)} megtakarítás
                </span>
                {featuredOption.bonusPrivateLessons && featuredOption.bonusLessonMinutes ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-sm font-semibold text-primary">
                    <Gift className="h-4 w-4" />
                    {featuredOption.bonusPrivateLessons} × {featuredOption.bonusLessonMinutes} perc ajándék magánóra
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6">
              {discounted ? (
                <p className="text-sm text-muted-foreground line-through decoration-muted-foreground/60">
                  Normál egyösszegű díj: {formatHUF(standardOption.total)}
                </p>
              ) : null}
              <p className="font-heading mt-1 break-words text-4xl font-extrabold tabular-nums text-primary sm:text-5xl">
                {formatHUF(featuredOption.total)}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground/70">
                egyszeri befizetés
              </p>
            </div>

            <p className="mt-6 leading-relaxed text-foreground/75">
              {featuredOption.description}
            </p>

            {featuredOption.paymentDeadline ? (
              <div className="mt-6 rounded-2xl border-l-4 border-primary bg-primary/10 px-5 py-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-foreground/70">
                  Befizetési határidő
                </p>
                <p className="mt-1 font-bold text-foreground">
                  {formatHuDate(featuredOption.paymentDeadline)}
                </p>
              </div>
            ) : null}

            <PaymentAction
              option={featuredOption}
              accepting={accepting}
              courseSlug={courseSlug}
              featured
            />
          </article>

          {alternativeOptions.length ? (
            <div className="flex flex-col gap-6 lg:col-span-2">
              {alternativeOptions.map((option) => (
                <PricingOptionCard
                  key={option.key}
                  option={option}
                  accepting={accepting}
                  courseSlug={courseSlug}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-6 rounded-3xl border border-navy-foreground/15 bg-navy-foreground/5 p-6 sm:p-8">
          <h3 className="font-heading text-center text-lg font-bold text-navy-foreground">
            Fontos a fizetésről
          </h3>
          <ul className="mx-auto mt-6 grid max-w-5xl gap-4 md:grid-cols-3">
            {[
              'Minden konstrukció ugyanahhoz a teljes kurzushoz tartozik.',
              'A választott konstrukciót a jelentkezés után egyeztetjük.',
              'A hely az aláírt szerződés és a díj vagy az első részlet jóváírása után végleges.',
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-2xl bg-navy-foreground/5 px-4 py-3"
              >
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="text-navy-foreground/85">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function PricingOptionCard({
  option,
  accepting,
  courseSlug,
}: {
  option: CoursePaymentOption
  accepting: boolean
  courseSlug: string
}) {
  const installment = option.installmentCount && option.installmentAmount

  return (
    <article className="flex h-full flex-col rounded-3xl border border-navy-foreground/15 bg-navy-foreground/5 p-6 sm:p-7">
      <h3 className="font-heading text-lg font-bold text-navy-foreground">
        {option.name}
      </h3>
      <p className="font-heading mt-3 break-words text-3xl font-bold tabular-nums text-navy-foreground">
        {installment
          ? `${option.installmentCount} × ${formatHUF(option.installmentAmount!)}`
          : formatHUF(option.total)}
      </p>
      <p className="mt-1 text-sm text-navy-foreground/60">
        {installment ? `${formatHUF(option.total)} összesen` : 'egyszeri befizetés'}
      </p>
      <p className="mt-4 leading-relaxed text-navy-foreground/75">
        {option.description}
      </p>

      {option.dueDates.some(Boolean) ? (
        <ul className="mt-4 space-y-1 text-sm text-navy-foreground/65">
          {option.dueDates.map((date, index) =>
            date ? (
              <li key={`${option.key}-${date}-${index}`}>
                {option.installmentCount ? `${index + 1}. részlet` : 'Határidő'}:{' '}
                {formatHuDate(date)}
              </li>
            ) : null,
          )}
        </ul>
      ) : null}

      <PaymentAction
        option={option}
        accepting={accepting}
        courseSlug={courseSlug}
      />
    </article>
  )
}

function PaymentAction({
  option,
  accepting,
  courseSlug,
  featured = false,
}: {
  option: CoursePaymentOption
  accepting: boolean
  courseSlug: string
  featured?: boolean
}) {
  if (!option.available) {
    return (
      <p
        className={`mt-6 rounded-full px-5 py-3 text-center text-sm font-semibold ${
          featured ? 'bg-foreground/10 text-foreground/70' : 'bg-white/5 text-white/60'
        }`}
      >
        Ez a konstrukció már nem választható.
      </p>
    )
  }

  if (!accepting) return null

  return (
    <Link
      href={`/jelentkezes?course=${encodeURIComponent(courseSlug)}&csomag=${encodeURIComponent(option.key)}`}
      className={
        featured
          ? 'mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary'
          : 'mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-navy-foreground/25 px-5 py-2.5 font-semibold text-navy-foreground transition-colors hover:bg-navy-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-navy'
      }
    >
      Ezt választom
      <ArrowRight className="h-4 w-4" />
    </Link>
  )
}

function isPaymentOption(
  option: CoursePaymentOption | null,
): option is CoursePaymentOption {
  return option !== null
}
