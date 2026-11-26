'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { safeReturnPath } from '@/lib/security-policy.mjs'

type Stage = 'loading' | 'enroll' | 'challenge' | 'error'

/** Supabase hands the QR code back as raw SVG after a data: prefix; encode it so every character survives. */
function qrImageSource(value: string): string {
  const prefix = 'data:image/svg+xml;utf-8,'
  const svg = value.startsWith(prefix) ? value.slice(prefix.length) : value
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * Second sign-in step for admins: a 6-digit code from an authenticator app
 * (1Password, Google Authenticator, Authy, Apple Passwords…). The middleware
 * sends a listed admin here until their session has the second factor; the
 * database (is_admin) refuses admin work without it.
 */
function TwoFactorContent() {
  const sp = useSearchParams()
  const requested = safeReturnPath(sp?.get('next'), '/admin')
  const next = requested.startsWith('/admin') && !requested.startsWith('/admin/two-factor') ? requested : '/admin'

  const [stage, setStage] = useState<Stage>('loading')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = getSupabaseBrowserClient()
      const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (level?.currentLevel === 'aal2') {
        window.location.replace(next)
        return
      }
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
      if (cancelled) return
      if (listError || !factors) {
        setError(listError?.message ?? 'Could not read your sign-in methods.')
        setStage('error')
        return
      }
      const verified = factors.totp[0]
      if (verified) {
        setFactorId(verified.id)
        setStage('challenge')
        return
      }
      // First time: set up an authenticator app. A half-finished setup from before is cleared first.
      for (const factor of factors.all) {
        if (factor.factor_type === 'totp' && factor.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: factor.id })
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Savry admin' })
      if (cancelled) return
      if (enrollError || !enrolled) {
        setError(enrollError?.message ?? 'Could not start two-factor setup.')
        setStage('error')
        return
      }
      setFactorId(enrolled.id)
      setQr(qrImageSource(enrolled.totp.qr_code))
      setSecret(enrolled.totp.secret)
      setStage('enroll')
    })()
    return () => {
      cancelled = true
    }
  }, [next])

  async function verify(event: FormEvent) {
    event.preventDefault()
    const digits = code.replace(/\s/g, '')
    if (!factorId || !/^\d{6}$/.test(digits)) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setBusy(true)
    setError(null)
    const { error: verifyError } = await getSupabaseBrowserClient().auth.mfa.challengeAndVerify({ factorId, code: digits })
    if (verifyError) {
      setError('That code did not work. Use the newest code, and check that the time on your phone is set automatically.')
      setCode('')
      setBusy(false)
      return
    }
    window.location.replace(next)
  }

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut()
    window.location.assign('/')
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-3xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900">Two-factor sign-in</h1>

        {stage === 'loading' && <p className="mt-4 text-sm text-gray-600">Checking your sign-in…</p>}

        {stage === 'enroll' && (
          <>
            <p className="mt-2 text-sm text-gray-600">
              Admin pages need a code from an authenticator app as well as your Savry sign-in. Scan this with the app, then enter the code it shows.
            </p>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR code for your authenticator app" width={192} height={192} className="mx-auto mt-6 h-48 w-48 rounded-xl border border-gray-200 bg-white p-2" />
            )}
            {secret && (
              <p className="mt-4 text-center text-xs text-gray-500">
                Can&rsquo;t scan? Enter this key instead:
                <span className="mt-1 block break-all font-mono text-sm text-gray-900">{secret}</span>
              </p>
            )}
          </>
        )}

        {stage === 'challenge' && <p className="mt-2 text-sm text-gray-600">Enter the 6-digit code from your authenticator app.</p>}

        {(stage === 'enroll' || stage === 'challenge') && (
          <form onSubmit={verify} className="mt-6">
            <label htmlFor="code" className="text-sm font-semibold text-gray-900">Code</label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-gray-900"
              autoFocus
            />
            <button type="submit" disabled={busy} className="mt-4 w-full bg-gray-900 text-white px-4 py-3 rounded-xl font-semibold disabled:opacity-50">
              {busy ? 'Checking…' : 'Continue'}
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}

        <p className="mt-6 text-xs text-gray-500">
          Lost your phone? Another admin can remove your authenticator in Supabase (Authentication → Users → your account → MFA factors), then you set it up again here.
        </p>

        <div className="mt-6 flex justify-between text-sm">
          <Link href="/" className="text-gray-600 hover:underline">Back to Savry</Link>
          <button type="button" onClick={signOut} className="text-gray-600 hover:underline">Sign out</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminTwoFactorPage() {
  return (
    <Suspense fallback={null}>
      <TwoFactorContent />
    </Suspense>
  )
}
