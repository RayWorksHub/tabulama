import { type NextRequest, NextResponse } from 'next/server'
import { buildApplicationSchema } from '@/lib/tabulama-application-schema'
import { sendInternalNotification, sendApplicantConfirmation } from '@/lib/tabulama-email'
import { generateApplicationId } from '@/lib/tabulama-config'
import {
  CourseApplicationError,
  consumeRateLimit,
  hashRequestIp,
  saveApplication,
} from '@/lib/application-repository'
import { DatabaseNotConfiguredError } from '@/lib/database'
import type { ApplicationPricing } from '@/lib/course-payment-options'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 5

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(req: NextRequest) {
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Hibás kérés.' }, { status: 400 })
  }

  // A szerver a SAJÁT idejével validál – a kliens idejét/árát nem fogadja el.
  const now = new Date()
  const schema = buildApplicationSchema(now)
  const parsed = schema.safeParse(payload)

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_form'
      if (!fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return NextResponse.json(
      { ok: false, message: 'A jelentkezés nem küldhető el, kérjük ellenőrizd a mezőket.', fieldErrors },
      { status: 422 },
    )
  }

  const data = parsed.data
  const applicationId = generateApplicationId(now)
  const meta = { applicationId, receivedAt: now }

  // Honeypot: ha ki van töltve, csendben "sikeres" választ adunk, de nem küldünk.
  if (data.website && data.website.length > 0) {
    return NextResponse.json({ ok: true, applicationId })
  }

  const requestIpHash = hashRequestIp(clientIp(req))
  let pricing: ApplicationPricing

  try {
    const allowed = await consumeRateLimit(
      `application:${requestIpHash}`,
      MAX_PER_WINDOW,
      WINDOW_MS / 1000,
    )
    if (!allowed) {
      return NextResponse.json(
        { ok: false, message: 'Túl sok próbálkozás. Kérjük, próbáld újra egy perc múlva.' },
        { status: 429 },
      )
    }

    pricing = await saveApplication(data, meta, requestIpHash)
  } catch (error) {
    if (error instanceof CourseApplicationError) {
      const message = error.code === 'payment_option_unavailable'
        ? 'A kiválasztott fizetési konstrukció már nem érhető el. Kérjük, válassz másikat.'
        : 'Erre a kurzusra jelenleg nem lehet jelentkezést leadni.'
      return NextResponse.json({ ok: false, message }, { status: 409 })
    }
    const reason = error instanceof DatabaseNotConfiguredError ? 'nincs konfigurálva' : 'adatbázishiba'
    console.error(`[TabuLama] Jelentkezés mentése sikertelen (${applicationId}, ${reason}).`)
    return NextResponse.json(
      {
        ok: false,
        message:
          'A jelentkezési rendszer átmenetileg nem elérhető. Kérjük, próbáld újra néhány perc múlva.',
      },
      { status: 503 },
    )
  }

  // Az adatbázis a mérvadó; az e-mail-küldés külön hibája nem veszít jelentkezést.
  await Promise.allSettled([
    sendInternalNotification(data, meta, pricing),
    sendApplicantConfirmation(data, meta, pricing),
  ])

  return NextResponse.json({ ok: true, applicationId })
}
