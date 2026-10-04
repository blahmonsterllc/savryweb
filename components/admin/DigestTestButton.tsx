'use client'

import { useState } from 'react'

/** Sends the admin a test copy of this week's email. */
export default function DigestTestButton() {
  const [state, setState] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function send() {
    setBusy(true)
    setState(null)
    const res = await fetch('/api/admin/digest-preview', { method: 'POST' })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok || !body.ok) return setState(body.error ?? 'Could not send')
    setState(body.empty ? 'Sent. Note: a quiet week like this one would normally be skipped.' : 'Sent. Check your inbox.')
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
      <button type="button" onClick={send} disabled={busy} className="rounded-full bg-gray-900 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40">{busy ? 'Sending…' : 'Send me a test'}</button>
      {state && <span className="text-gray-600">{state}</span>}
    </div>
  )
}
