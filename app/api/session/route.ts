import { type NextRequest, NextResponse } from 'next/server'
import { authSessionCookie, authenticateCredentials, createSessionToken } from '@/lib/auth'
import { consumeRateLimit, hashRequestIp } from '@/lib/application-repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
}

function failed(req: NextRequest, error: string): NextResponse {
  const url = new URL('/login', req.url)
  url.searchParams.set('error', error)
  return NextResponse.redirect(url, 303)
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const email = String(formData.get('email') ?? '').slice(0, 254)
  const password = String(formData.get('password') ?? '').slice(0, 128)

  try {
    const allowed = await consumeRateLimit(`login:${hashRequestIp(clientIp(req))}`, 8, 10 * 60)
    if (!allowed) return failed(req, 'rate-limit')
  } catch {
    return failed(req, 'database')
  }

  try {
    const result = await authenticateCredentials(email, password)
    if (result.status !== 'authenticated') return failed(req, result.status)
    const target = result.session.role === 'student' ? '/portal' : '/admin'
    const response = NextResponse.redirect(new URL(target, req.url), 303)
    response.cookies.set(
      authSessionCookie.name,
      createSessionToken(result.session),
      authSessionCookie.options,
    )
    return response
  } catch {
    return failed(req, 'database')
  }
}
