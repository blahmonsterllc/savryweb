import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { safeReturnPath } from '@/lib/security-policy.mjs'

const RESET_PATH = '/auth/reset'
const OTP_TYPES: ReadonlySet<string> = new Set(['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'])

/**
 * Finishes Supabase auth redirects: OAuth (Apple), email confirmation, and
 * password recovery. PKCE links arrive with `?code=`; token-hash email links
 * arrive with `?token_hash=&type=`. Either way the session cookie is set here
 * and the cook is sent to `next` (recovery → /auth/reset) or `returnTo`.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const type = params.get('type')
  const next = params.get('next')
  const returnTo = safeReturnPath(params.get('returnTo'))
  const isRecovery = type === 'recovery' || next === RESET_PATH
  const destination = isRecovery ? RESET_PATH : safeReturnPath(next ?? returnTo)

  if (code || (tokenHash && type && OTP_TYPES.has(type))) {
    const supabase = getSupabaseServerClient()
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash as string, type: type as EmailOtpType })
    if (!error) return NextResponse.redirect(new URL(destination, request.url))
    console.warn('auth callback: exchange failed', error.message)
  }

  const errorURL = new URL('/app-login', request.url)
  errorURL.searchParams.set('error', isRecovery ? 'recovery' : 'callback')
  if (!isRecovery) errorURL.searchParams.set('returnTo', returnTo)
  return NextResponse.redirect(errorURL)
}
