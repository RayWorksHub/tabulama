import { type NextRequest, NextResponse } from 'next/server'
import { authSessionCookie } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', req.url), 303)
  response.cookies.set(authSessionCookie.name, '', {
    ...authSessionCookie.options,
    maxAge: 0,
  })
  return response
}
