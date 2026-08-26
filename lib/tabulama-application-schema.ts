/**
 * TabuLama jelentkezés – közös (kliens + szerver) Zod séma és életkori logika.
 *
 * A séma egy gyár (`buildApplicationSchema`), amely megkapja az aktuális időt,
 * hogy az early-bird lejárat determinisztikusan ellenőrizhető legyen mindkét
 * oldalon. A szerver mindig a saját idejével és a config árával dolgozik –
 * a kliens által küldött árat, bónuszt vagy korhatárt soha nem fogadja el.
 */

import { z } from 'zod'
import {
  PACKAGE_KEYS,
  EARLY_BIRD_DEADLINE_ISO,
  type PackageKey,
} from '@/lib/tabulama-config'

export const grades = [
  '8. évfolyam',
  '9. évfolyam',
  '10. évfolyam',
  '11. évfolyam',
  '12. évfolyam',
  '13. évfolyam',
  'Egyéb / már nem vagyok középiskolás',
] as const

export const goals = [
  'Ágazati alapvizsga – Python',
  'Digitális kultúra érettségi – Python/programozási rész',
  'Mindkettő érdekel',
  'Még nem tudom, segítséget kérek a választáshoz',
] as const

export const experiences = [
  'Még nem programoztam',
  'Ismerem az alapokat',
  'Már oldottam meg összetettebb Python-feladatokat',
] as const

export const guardianRelations = [
  'anya',
  'apa',
  'gyám',
  'egyéb törvényes képviselő',
] as const

export const payerTypes = [
  'participant',
  'guardian',
  'other-person',
  'company',
] as const

export type PayerType = (typeof payerTypes)[number]
export type ApplicantType = 'child' | 'self'

export const MESSAGE_MAX = 1000

export type AgeStatus = 'adult' | 'minor-limited' | 'minor-represented'

export interface AgeInfo {
  valid: boolean
  age: number
  isMinor: boolean
  status: AgeStatus
}

/** Életkori státusz kiszámítása a születési dátumból, az adott napra. */
export function computeAgeInfo(
  birthDateISO: string,
  ref: Date = new Date(),
): AgeInfo {
  const birth = new Date(birthDateISO)
  if (Number.isNaN(birth.getTime()) || birth.getTime() > ref.getTime()) {
    return { valid: false, age: 0, isMinor: true, status: 'minor-represented' }
  }
  let age = ref.getFullYear() - birth.getFullYear()
  const m = ref.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--

  const isMinor = age < 18
  let status: AgeStatus = 'adult'
  if (age < 14) status = 'minor-represented'
  else if (age < 18) status = 'minor-limited'
  return { valid: true, age, isMinor, status }
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isReasonablePhone(value: string): boolean {
  const digits = value.replace(/[^\d]/g, '')
  if (digits.length < 7 || digits.length > 15) return false
  return /^\+?[\d\s()/-]+$/.test(value.trim())
}

const optionalTrimmed = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v ? v : undefined))

/**
 * A jelentkezési séma gyára. `now` az early-bird lejárat ellenőrzéséhez kell.
 */
export function buildApplicationSchema(now: Date = new Date()) {
  return z
    .object({
      packageKey: z.enum(PACKAGE_KEYS as [PackageKey, ...PackageKey[]]),
      applicantType: z.enum(['child', 'self']),

      // Résztvevő
      participantName: z.string().trim().min(2, 'Add meg a résztvevő teljes nevét.').max(120),
      participantBirthDate: z
        .string()
        .trim()
        .min(1, 'Add meg a születési dátumot.'),
      participantEmail: z
        .string()
        .trim()
        .max(160)
        .optional()
        .transform((v) => (v ? v : undefined)),
      participantPhone: z
        .string()
        .trim()
        .max(40)
        .optional()
        .transform((v) => (v ? v : undefined)),
      grade: z.enum(grades),
      goal: z.enum(goals),
      experience: z.enum(experiences),
      schoolName: optionalTrimmed,
      message: z
        .string()
        .trim()
        .max(MESSAGE_MAX, `Az üzenet legfeljebb ${MESSAGE_MAX} karakter lehet.`)
        .optional()
        .transform((v) => (v ? v : undefined)),

      // Törvényes képviselő (kiskorúnál kötelező)
      guardianName: z.string().trim().max(120).optional().transform((v) => (v ? v : undefined)),
      guardianEmail: z.string().trim().max(160).optional().transform((v) => (v ? v : undefined)),
      guardianPhone: z.string().trim().max(40).optional().transform((v) => (v ? v : undefined)),
      guardianRelation: z
        .union([z.enum(guardianRelations), z.literal('')])
        .optional()
        .transform((v) => (v ? v : undefined)),
      guardianDeclaration: z.boolean().optional(),

      // Fizető és számlázás
      payerType: z.enum(payerTypes),
      billingName: z.string().trim().min(2, 'Add meg a számlázási nevet.').max(160),
      billingZip: z.string().trim().min(3, 'Add meg az irányítószámot.').max(12),
      billingCity: z.string().trim().min(2, 'Add meg a települést.').max(80),
      billingAddress: z.string().trim().min(3, 'Add meg a címet.').max(160),
      billingEmail: z.string().trim().min(1, 'Add meg a számlázási e-mail-címet.').max(160),
      taxNumber: z.string().trim().max(40).optional().transform((v) => (v ? v : undefined)),

      // Nyilatkozatok
      declPrivacy: z.boolean(),
      declNotAutomatic: z.boolean(),
      declPaymentTerms: z.boolean(),
      declTruthful: z.boolean(),
      declGuardianAuth: z.boolean().optional(),

      // Konverziómérés – kizárólag technikai forrásadatok.
      source: optionalTrimmed,
      referrer: z.string().trim().max(500).optional().transform((v) => (v ? v : undefined)),
      utmSource: optionalTrimmed,
      utmMedium: optionalTrimmed,
      utmCampaign: optionalTrimmed,

      // Honeypot – üresen kell maradnia
      website: z.string().max(200).optional(),
    })
    .superRefine((data, ctx) => {
      // Csomag e-mail formátumok
      if (data.participantEmail && !emailRegex.test(data.participantEmail)) {
        ctx.addIssue({ code: 'custom', path: ['participantEmail'], message: 'Érvénytelen e-mail-cím.' })
      }
      if (data.billingEmail && !emailRegex.test(data.billingEmail)) {
        ctx.addIssue({ code: 'custom', path: ['billingEmail'], message: 'Érvénytelen e-mail-cím.' })
      }

      // Születési dátum + életkor
      const ageInfo = computeAgeInfo(data.participantBirthDate, now)
      if (!ageInfo.valid) {
        ctx.addIssue({
          code: 'custom',
          path: ['participantBirthDate'],
          message: 'Érvénytelen születési dátum (nem lehet jövőbeli).',
        })
      }

      // Nagykorú résztvevőnél kötelező a telefonszám
      if (ageInfo.valid && !ageInfo.isMinor) {
        if (!data.participantPhone) {
          ctx.addIssue({
            code: 'custom',
            path: ['participantPhone'],
            message: 'Nagykorú résztvevőnél kötelező a telefonszám.',
          })
        } else if (!isReasonablePhone(data.participantPhone)) {
          ctx.addIssue({ code: 'custom', path: ['participantPhone'], message: 'Érvénytelen telefonszám.' })
        }
      } else if (data.participantPhone && !isReasonablePhone(data.participantPhone)) {
        ctx.addIssue({ code: 'custom', path: ['participantPhone'], message: 'Érvénytelen telefonszám.' })
      }

      // Kiskorúnál kötelező a törvényes képviselő
      if (ageInfo.valid && ageInfo.isMinor) {
        if (!data.guardianName || data.guardianName.length < 2) {
          ctx.addIssue({ code: 'custom', path: ['guardianName'], message: 'Add meg a törvényes képviselő nevét.' })
        }
        if (!data.guardianEmail) {
          ctx.addIssue({ code: 'custom', path: ['guardianEmail'], message: 'Add meg a törvényes képviselő e-mail-címét.' })
        } else if (!emailRegex.test(data.guardianEmail)) {
          ctx.addIssue({ code: 'custom', path: ['guardianEmail'], message: 'Érvénytelen e-mail-cím.' })
        }
        if (!data.guardianPhone) {
          ctx.addIssue({ code: 'custom', path: ['guardianPhone'], message: 'Add meg a törvényes képviselő telefonszámát.' })
        } else if (!isReasonablePhone(data.guardianPhone)) {
          ctx.addIssue({ code: 'custom', path: ['guardianPhone'], message: 'Érvénytelen telefonszám.' })
        }
        if (!data.guardianRelation) {
          ctx.addIssue({ code: 'custom', path: ['guardianRelation'], message: 'Válaszd ki a kapcsolatot.' })
        }
        if (data.guardianDeclaration !== true) {
          ctx.addIssue({ code: 'custom', path: ['guardianDeclaration'], message: 'A képviseleti jogosultság megerősítése kötelező.' })
        }
        if (data.declGuardianAuth !== true) {
          ctx.addIssue({ code: 'custom', path: ['declGuardianAuth'], message: 'A törvényes képviselői nyilatkozat elfogadása kötelező.' })
        }
      }

      // A résztvevő csak nagykorúként lehet a fizető
      if (data.payerType === 'participant' && ageInfo.valid && ageInfo.isMinor) {
        ctx.addIssue({
          code: 'custom',
          path: ['payerType'],
          message: 'Kiskorú résztvevő nem lehet a fizető.',
        })
      }

      // Céges/szervezeti fizetőnél kötelező az adószám
      if (data.payerType === 'company' && !data.taxNumber) {
        ctx.addIssue({ code: 'custom', path: ['taxNumber'], message: 'Céges fizetőnél kötelező az adószám.' })
      }

      // Kötelező nyilatkozatok
      for (const [key, message] of [
        ['declPrivacy', 'Az adatkezelési tájékoztató tudomásulvétele kötelező.'],
        ['declNotAutomatic', 'A jelentkezés jellegére vonatkozó nyilatkozat kötelező.'],
        ['declPaymentTerms', 'A fizetési feltételek megismerése kötelező.'],
        ['declTruthful', 'A valódiságról szóló nyilatkozat kötelező.'],
      ] as const) {
        if (data[key] !== true) {
          ctx.addIssue({ code: 'custom', path: [key], message })
        }
      }

      // Early-bird lejárat – szerver- és kliensoldalon is
      if (data.packageKey === 'early-bird' && now.getTime() > new Date(EARLY_BIRD_DEADLINE_ISO).getTime()) {
        ctx.addIssue({
          code: 'custom',
          path: ['packageKey'],
          message: 'A korai (early-bird) ajánlat már lejárt. Kérjük, válassz másik csomagot.',
        })
      }
    })
}

export type ApplicationInput = z.input<ReturnType<typeof buildApplicationSchema>>
export type ApplicationData = z.output<ReturnType<typeof buildApplicationSchema>>
