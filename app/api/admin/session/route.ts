import { type NextRequest, NextResponse } from 'next/server'
import {
  adminSessionCookie,
  createAdminSessionToken,
  isAdminAuthConfigured,
  sanitizeReturnTo,
  verifyAdminCredentials,
} from '@/lib/admin-auth'
import { consumeRateLimit, hashRequestIp } from '@/lib/application-repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
}

function loginRedirect(req: NextRequest, error: string, returnTo: string): NextResponse {
  const url = new URL('/admin/login', req.url)
  url.searchParams.set('error', error)
  url.searchParams.set('next', returnTo)
  return NextResponse.redirect(url, 303)
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  const returnTo = sanitizeReturnTo(String(formData.get('next') ?? '/admin'))

  if (!isAdminAuthConfigured()) return loginRedirect(req, 'config', returnTo)

  try {
    const rateKey = `admin-login:${hashRequestIp(clientIp(req))}`
    const allowed = await consumeRateLimit(rateKey, 5, 10 * 60)
    if (!allowed) return loginRedirect(req, 'rate-limit', returnTo)
  } catch {
    return loginRedirect(req, 'database', returnTo)
  }

  if (!verifyAdminCredentials(email, password)) {
    return loginRedirect(req, 'invalid', returnTo)
  }

  const response = NextResponse.redirect(new URL(returnTo, req.url), 303)
  response.cookies.set(
    adminSessionCookie.name,
    createAdminSessionToken(email),
    adminSessionCookie.options,
  )
  return response
}
