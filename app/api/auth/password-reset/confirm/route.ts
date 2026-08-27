import { type NextRequest, NextResponse } from 'next/server'
import { passwordValidationError } from '@/lib/password'
import { resetPasswordWithToken } from '@/lib/student-repository'

export const runtime = 'nodejs'

function back(req: NextRequest, token: string, error: string): NextResponse {
  const url = new URL(`/jelszo-visszaallitas/${encodeURIComponent(token)}`, req.url)
  url.searchParams.set('error', error)
  return NextResponse.redirect(url, 303)
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const token = String(formData.get('token') ?? '')
  const password = String(formData.get('password') ?? '')
  const confirmation = String(formData.get('passwordConfirmation') ?? '')
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return back(req, token, 'invalid')
  if (password !== confirmation) return back(req, token, 'mismatch')
  if (passwordValidationError(password)) return back(req, token, 'password')
  try {
    if (!await resetPasswordWithToken(token, password)) return back(req, token, 'invalid')
  } catch {
    return back(req, token, 'save')
  }
  return NextResponse.redirect(new URL('/login?success=password-reset', req.url), 303)
}
