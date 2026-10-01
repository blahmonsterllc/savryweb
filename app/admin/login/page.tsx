'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
import { safeReturnPath } from '@/lib/security-policy.mjs'

/**
 * Admin uses the same Savry sign-in as the rest of the site. The middleware
 * sends signed-out visitors straight to /app-login; this page is where a
 * signed-in account that is not on the admin list lands.
 */
function LoginContent() {
  const sp = useSearchParams()
  const next = safeReturnPath(sp?.get('next'), '/admin')
  const denied = sp?.get('denied') === '1'
  const [busy, setBusy] = useState(false)

  async function switchAccount() {
    setBusy(true)
    await getSupabaseBrowserClient().auth.signOut()
    window.location.assign(`/app-login?returnTo=${encodeURIComponent(next)}`)
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-3xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900">Savry admin</h1>

        {denied ? (
          <>
            <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
              The account you are signed in with is not an admin.
            </p>
            <button
              type="button"
              onClick={switchAccount}
              disabled={busy}
              className="mt-6 w-full bg-gray-900 text-white px-4 py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              {busy ? 'Signing out…' : 'Sign in with a different account'}
            </button>
          </>
        ) : (
          <>
            <p className="text-gray-600 mt-2 text-sm">Sign in with your Savry account. Only accounts on the admin list can open these pages.</p>
            <a
              href={`/app-login?returnTo=${encodeURIComponent(next)}`}
              className="mt-6 block w-full bg-gray-900 text-white px-4 py-3 rounded-xl font-semibold text-center"
            >
              Sign in
            </a>
          </>
        )}

        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-gray-600 hover:underline">Back to Savry</Link>
        </p>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}
