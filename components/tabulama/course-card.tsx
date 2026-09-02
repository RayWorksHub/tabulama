import Link from 'next/link'
import { ArrowRight, CalendarDays, Users } from 'lucide-react'
import type { Course } from '@/lib/course-repository'
import { COURSE_STATUS_LABELS } from '@/lib/course-repository'
import { buildCoursePaymentOptions } from '@/lib/course-payment-options'
import { formatHUF, formatHuDate } from '@/lib/tabulama-config'

export function CourseCard({ course }: { course: Course }) {
  const paymentOptions = buildCoursePaymentOptions(course)
  const discountedOption = paymentOptions['early-bird']
  const displayedOption = discountedOption?.available
    ? discountedOption
    : paymentOptions.standard

  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      {course.imageUrl ? <div className="h-44 bg-cover bg-center" role="img" aria-label={`${course.shortTitle} kurzuskép`} style={{ backgroundImage: `url(${JSON.stringify(course.imageUrl).slice(1, -1)})` }} /> : <div className="h-3 bg-primary" />}
      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">{course.category}</span><span className="text-xs font-semibold text-muted-foreground">{COURSE_STATUS_LABELS[course.status]}</span></div>
        <h3 className="font-heading mt-4 break-words text-xl font-bold text-foreground">{course.title}</h3>
        <p className="mt-3 flex-1 leading-relaxed text-muted-foreground">{course.summary}</p>
        <div className="mt-5 grid gap-2 text-sm text-muted-foreground">
          {course.startDate ? <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />{formatHuDate(course.startDate)}</p> : null}
          <p className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />{course.maxCapacity === null ? `${course.currentHeadcount} résztvevő` : `${course.remainingCapacity} szabad hely / ${course.maxCapacity}`}</p>
        </div>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {discountedOption?.available ? 'Kedvezményes díj' : 'Képzési díj'}
            </p>
            <span className="font-heading mt-1 block text-xl font-bold text-primary">
              {formatHUF(displayedOption?.total ?? course.priceHuf)}
            </span>
          </div>
          <Link href={`/kurzusok/${course.slug}`} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Részletek <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </article>
  )
}
