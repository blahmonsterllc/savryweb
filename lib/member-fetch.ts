'use client'

import { getSupabaseBrowserClient } from './supabase/browser'

/**
 * POSTs to one of the site's member routes with the signed-in member's
 * Supabase access token. Resolves with the parsed JSON (or {}) and ok/status,
 * or { ok: false, status: 401 } when nobody is signed in.
 */
export async function memberPost(path: string, body: unknown = {}): Promise<{ ok: boolean; status: number; data: { error?: string } & Record<string, unknown> }> {
  const accessToken = (await getSupabaseBrowserClient().auth.getSession()).data.session?.access_token
  if (!accessToken) return { ok: false, status: 401, data: { error: 'Sign in first' } }
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, data }
}
