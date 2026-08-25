import { type NextRequest, NextResponse } from 'next/server'
import { buildApplicationSchema } from '@/lib/tabulama-application-schema'
import { sendInternalNotification, sendApplicantConfirmation } from '@/lib/tabulama-email'
import { generateApplicationId } from '@/lib/tabulama-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Nagyon egyszerű, memórián belüli sebességkorlát (IP + rövid ablak). */
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 5
const hits = new Map<string, { count: number; resetAt: number }>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = hits.get(ip)
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > MAX_PER_WINDOW
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, message: 'Túl sok próbálkozás. Kérjük, próbáld újra egy perc múlva.' },
      { status: 429 },
    )
  }

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

  // A belső értesítő a mérvadó: csak akkor sikeres a jelentkezés, ha ez elment
  // (vagy szándékosan nincs még konfigurálva az e-mail – induló, manuális mód).
  const internal = await sendInternalNotification(data, meta)

  if (internal.status === 'error') {
    return NextResponse.json(
      {
        ok: false,
        message:
          'A jelentkezés elküldése átmenetileg nem sikerült. Az adataid megmaradtak – kérjük, próbáld újra néhány perc múlva.',
      },
      { status: 502 },
    )
  }

  // A jelentkezői visszaigazolás best-effort: külön hibája nem buktatja a beküldést.
  await sendApplicantConfirmation(data, meta)

  return NextResponse.json({ ok: true, applicationId })
}
