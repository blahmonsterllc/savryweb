import 'server-only'

import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseAdmin } from './supabase/admin'
import { requireSupabasePublishableKey, requireSupabaseURL } from './supabase/config'

/**
 * Admin check for every /api/admin handler. middleware.ts already gates these
 * routes; this repeats the check inside the handler so the service-role client
 * is never reached on the strength of the middleware alone.
 *
 * Returns the admin's user id, or null after answering 401/403.
 */
export async function requireAdmin(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
  res.setHeader('Cache-Control', 'no-store, max-age=0')

  // Writes must come from this site's own pages.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const origin = req.headers.origin
    let sameOrigin = !origin
    if (origin) {
      try {
        sameOrigin = new URL(origin).host === req.headers.host
      } catch {
        sameOrigin = false
      }
    }
    if (!sameOrigin) {
      res.status(403).json({ message: 'Forbidden' })
      return null
    }
  }

  // The session cookie was refreshed by the middleware, so nothing is written back here.
  const supabase = createServerClient(requireSupabaseURL(), requireSupabasePublishableKey(), {
    cookies: {
      getAll: () => Object.entries(req.cookies).map(([name, value]) => ({ name, value: value ?? '' })),
      setAll: () => {},
    },
  })
  const { data, error } = await supabase.auth.getUser()
  const user = error ? null : data.user
  if (!user) {
    res.status(401).json({ message: 'Admin authorization required' })
    return null
  }

  const { data: isAdmin, error: adminError } = await getSupabaseAdmin().rpc('admin_is_admin', { target: user.id })
  if (adminError || isAdmin !== true) {
    res.status(403).json({ message: 'This account is not an admin' })
    return null
  }
  return user.id
}
