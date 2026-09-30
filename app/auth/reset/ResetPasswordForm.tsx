'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

type Status = 'checking' | 'ready' | 'no-session' | 'saving' | 'done'

export default function ResetPasswordForm() {
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    let cancelled = false
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (cancelled) return
      setStatus(data.session ? 'ready' : 'no-session')
    })
    // Recovery links that land with a hash fragment surface the session slightly later.
    const { data: subscription } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (cancelled) return
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        setStatus((current) => (current === 'checking' || current === 'no-session' ? 'ready' : current))
      }
    })
    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Those passwords do not match.')
      return
    }
    setStatus('saving')
    const { error: authError } = await getSupabaseBrowserClient().auth.updateUser({ password })
    if (authError) {
      const message = authError.message.toLowerCase()
      setError(
        message.includes('different from the old')
          ? 'Choose a password you have not used before.'
          : message.includes('session') || message.includes('not logged in')
            ? 'This reset link is no longer valid. Request a new one from the sign-in page.'
            : 'We could not update your password. Please try again.'
      )
      setStatus('ready')
      return
    }
    setStatus('done')
    window.location.assign('/account')
  }

  if (status === 'checking') {
    return <div className="community-login__card">Checking your reset link…</div>
  }

  if (status === 'no-session') {
    return (
      <div className="community-login__card">
        <p className="community-login__error" role="alert">This password reset link is invalid or has expired.</p>
        <p className="community-login__legal">Request a new link from the sign-in page: enter your email, then choose “Forgot password?”.</p>
        <Link className="button button--coral" href="/app-login?error=recovery">Back to sign in</Link>
      </div>
    )
  }

  return (
    <div className="community-login__card">
      <form onSubmit={onSubmit} className="community-login__form">
        <label>New password<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label>Confirm new password<input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>

        {error && <p className="community-login__error" role="alert">{error}</p>}
        {status === 'done' && <p className="community-login__info" role="status">Password updated. Taking you to your account…</p>}

        <button type="submit" className="button button--coral" disabled={status === 'saving' || status === 'done'}>
          {status === 'saving' ? 'Saving…' : 'Save new password'}
        </button>
      </form>
      <p className="community-login__legal">Changed your mind? <Link href="/account">Go to your account</Link>.</p>
    </div>
  )
}
