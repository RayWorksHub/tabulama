import { z } from 'zod'
import { COURSE_STATUSES } from '@/lib/course-repository'

const optionalText = z.string().trim().max(10_000).transform((value) => value || null)
const optionalDate = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).transform((value) => value || null)
const optionalDateTime = z.string().trim().transform((value, ctx) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: 'custom', message: 'Érvénytelen dátum és idő.' })
    return z.NEVER
  }
  return date.toISOString()
})
const optionalInteger = z.preprocess(
  (value) => value === '' || value === null ? null : value,
  z.coerce.number().int().nonnegative().nullable(),
)

export const courseFormSchema = z.object({
  title: z.string().trim().min(3).max(200),
  shortTitle: z.string().trim().min(2).max(100),
  slug: z.string().trim().toLowerCase().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(10).max(20_000),
  summary: z.string().trim().min(10).max(500),
  category: z.string().trim().min(2).max(100),
  imageUrl: optionalText,
  startDate: optionalDate,
  endDate: optionalDate,
  applicationDeadline: optionalDateTime,
  weeklySchedule: optionalText,
  maxCapacity: optionalInteger,
  priceHuf: z.coerce.number().int().nonnegative().max(100_000_000),
  discountedPriceHuf: optionalInteger,
  discountedPaymentDeadline: optionalDateTime,
  installmentEnabled: z.boolean(),
  installmentCount: optionalInteger,
  installmentAmountHuf: optionalInteger,
  installmentDueDates: z.array(z.union([z.string().datetime(), z.null()])).max(24),
  status: z.enum(COURSE_STATUSES),
  instructorName: optionalText,
  targetAudience: optionalText,
  prerequisites: optionalText,
  syllabus: optionalText,
  applicationsEnabled: z.boolean(),
}).superRefine((data, ctx) => {
  if (data.maxCapacity === 0) {
    ctx.addIssue({ code: 'custom', path: ['maxCapacity'], message: 'A létszám legyen legalább 1.' })
  }
  if (data.installmentEnabled) {
    if (!data.installmentCount || data.installmentCount < 2) {
      ctx.addIssue({ code: 'custom', path: ['installmentCount'], message: 'Legalább 2 részlet szükséges.' })
    }
    if (!data.installmentAmountHuf) {
      ctx.addIssue({ code: 'custom', path: ['installmentAmountHuf'], message: 'Add meg a részlet összegét.' })
    }
  }
  if (data.endDate && data.startDate && data.endDate < data.startDate) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'A zárás nem előzheti meg a kezdést.' })
  }
})

export function parseInstallmentDueDates(raw: string, count: number | null): Array<string | null> {
  if (!count) return []
  const lines = raw.replace(/\r/g, '').split('\n')
  return Array.from({ length: count }, (_, index) => {
    const value = lines[index]?.trim()
    if (!value) return null
    const date = new Date(`${value}T12:00:00.000Z`)
    return Number.isNaN(date.getTime()) ? '__invalid__' : date.toISOString()
  })
}
