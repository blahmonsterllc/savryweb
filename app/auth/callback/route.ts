import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { safeReturnPath } from '@/lib/security-policy.mjs'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get('returnTo'))

  if (code) {
    const supabase = getSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(returnTo, request.url))
  }

  const errorURL = new URL('/app-login', request.url)
  errorURL.searchParams.set('error', 'We could not complete that sign-in. Please try again.')
  errorURL.searchParams.set('returnTo', returnTo)
  return NextResponse.redirect(errorURL)
}
