import { type NextRequest, NextResponse } from 'next/server'
import { consumeRateLimit, hashRequestIp } from '@/lib/application-repository'
import { provider } from '@/lib/tabulama-config'
import { sendPasswordResetEmail } from '@/lib/tabulama-email'
import { createPasswordReset, recordAuthTokenEmailResult } from '@/lib/student-repository'

export const runtime = 'nodejs'

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const email = String(formData.get('email') ?? '').slice(0, 254)
  try {
    const allowed = await consumeRateLimit(`password-reset:${hashRequestIp(clientIp(req))}`, 5, 30 * 60)
    if (allowed) {
      const reset = await createPasswordReset(email)
      if (reset) {
        const resetUrl = new URL(`/jelszo-visszaallitas/${reset.rawToken}`, provider.website).toString()
        const result = await sendPasswordResetEmail({
          recipient: reset.email,
          fullName: reset.fullName,
          resetUrl,
          expiresAt: reset.expiresAt,
        })
        await recordAuthTokenEmailResult(reset.tokenHash, result)
      }
    }
  } catch {
    console.error('[TabuLama] A jelszó-visszaállítási kérés feldolgozása sikertelen.')
  }
  return NextResponse.redirect(new URL('/elfelejtett-jelszo?sent=1', req.url), 303)
}
