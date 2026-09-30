'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

function safeReturnTo(value: string | null): string {
  return value && /^\/[^/\\]/.test(value) ? value : '/account'
}

// Only fixed messages are rendered for the `?error=` query parameter so a
// crafted link can never inject arbitrary text into the sign-in page.
const QUERY_ERROR_MESSAGES: Record<string, string> = {
  callback: 'We could not complete that sign-in. Please try again.',
  recovery: 'That password reset link is invalid or has expired. Enter your email and request a new one.',
  expired: 'That link has expired. Please request a new one.',
  session: 'Please sign in again to continue.',
}

function messageForQuery(code: string | null): string | null {
  if (!code) return null
  return QUERY_ERROR_MESSAGES[code] ?? 'Something went wrong. Please try again.'
}

function messageFor(error: { message?: string } | null): string {
  const message = error?.message?.toLowerCase() ?? ''
  if (message.includes('invalid login')) return 'Email or password is incorrect.'
  if (message.includes('already registered')) return 'There is already an account for that email. Try signing in.'
  if (message.includes('rate limit') || message.includes('too many')) return 'Too many attempts. Please wait a moment and try again.'
  if (message.includes('password')) return 'Use a password with at least 8 characters.'
  if (message.includes('provider') || message.includes('apple')) return 'Apple sign-in is not available right now. Please use email.'
  return 'Something went wrong. Please try again.'
}

export default function LoginForm() {
  const params = useSearchParams()
  const returnTo = useMemo(() => safeReturnTo(params?.get('returnTo') ?? null), [params])
  const [mode, setMode] = useState<'signin' | 'create'>(params?.get('error') === 'recovery' ? 'signin' : 'create')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(() => messageForQuery(params?.get('error') ?? null))
  const [info, setInfo] = useState<string | null>(null)

  function callbackURL() {
    const url = new URL('/auth/callback', window.location.origin)
    url.searchParams.set('returnTo', returnTo)
    return url.toString()
  }

  async function signInWithApple() {
    setBusy(true)
    setError(null)
    setInfo(null)
    const { error: authError } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: callbackURL(), scopes: 'email name' },
    })
    if (authError) {
      setError(messageFor(authError))
      setBusy(false)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    const supabase = getSupabaseBrowserClient()

    if (mode === 'create') {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() || email.trim().split('@')[0] },
          emailRedirectTo: callbackURL(),
        },
      })
      if (authError) setError(messageFor(authError))
      else if (data.session) window.location.assign(returnTo)
      else setInfo('Check your email to confirm your account, then return here to sign in.')
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (authError) setError(messageFor(authError))
      else window.location.assign(returnTo)
    }
    setBusy(false)
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError('Enter your email first and we will send a reset link.')
      return
    }
    setBusy(true)
    setError(null)
    setInfo(null)
    // The callback exchanges the recovery code for a session, then sends the
    // cook to /auth/reset to choose a new password.
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent('/auth/reset')}`
    const { error: authError } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email.trim(), { redirectTo })
    setBusy(false)
    if (authError) setError(messageFor(authError))
    else setInfo('Password reset email sent. Open the link on this device to choose a new password.')
  }

  return (
    <div className="community-login__card">
      <button type="button" className="apple-signin" onClick={signInWithApple} disabled={busy}>
        <span aria-hidden="true"></span> Continue with Apple
      </button>

      <div className="community-login__divider"><span>or use email</span></div>

      <div className="community-login__tabs" aria-label="Account mode">
        <button type="button" className={mode === 'create' ? 'is-active' : ''} onClick={() => setMode('create')}>Create account</button>
        <button type="button" className={mode === 'signin' ? 'is-active' : ''} onClick={() => setMode('signin')}>Sign in</button>
      </div>

      <form onSubmit={onSubmit} className="community-login__form">
        {mode === 'create' && (
          <label>Your name<input type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Shown on recipes you publish" /></label>
        )}
        <label>Email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input type="password" required minLength={8} autoComplete={mode === 'create' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} /></label>

        {error && <p className="community-login__error" role="alert">{error}</p>}
        {info && <p className="community-login__info" role="status">{info}</p>}

        <button type="submit" className="button button--coral" disabled={busy}>
          {busy ? 'One moment…' : mode === 'create' ? 'Create my account' : 'Sign in'}
        </button>
        {mode === 'signin' && <button type="button" className="community-login__forgot" onClick={resetPassword} disabled={busy}>Forgot password?</button>}
      </form>

      <p className="community-login__legal">By continuing, you agree to Savry’s <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
    </div>
  )
}
