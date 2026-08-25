import { type NextRequest, NextResponse } from 'next/server'
import { adminSessionCookie } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/admin/login', req.url), 303)
  response.cookies.set(adminSessionCookie.name, '', {
    ...adminSessionCookie.options,
    maxAge: 0,
  })
  return response
}
