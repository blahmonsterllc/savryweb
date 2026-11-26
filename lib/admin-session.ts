import 'server-only'

import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerClient } from '@supabase/ssr'
import { ACCESS_HEADER, checkAccess, clientIp } from '@/lib/cloudflare-access.mjs'
import { getSupabaseAdmin } from './supabase/admin'
import { requireSupabasePublishableKey, requireSupabaseURL } from './supabase/config'

/** Requests whose Cloudflare Access token was verified here, so their CF-Connecting-IP can be believed. */
const viaCloudflare = new WeakSet<NextApiRequest>()

const header = (req: NextApiRequest, name: string): string | undefined => {
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] : value
}

/** The admin's IP address and browser, for the activity log. */
export function requestOrigin(req: NextApiRequest): { ip: string | null; userAgent: string } {
  return {
    ip: clientIp((name) => req.headers[name], viaCloudflare.has(req)),
    userAgent: (header(req, 'user-agent') ?? '').slice(0, 300),
  }
}

/**
 * Admin check for every /api/admin handler. middleware.ts already gates these
 * routes; this repeats every check inside the handler so the service-role
 * client is never reached on the strength of the middleware alone:
 *
 *   1. Cloudflare Access token, when Access is configured.
 *   2. A Savry session verified with Supabase Auth.
 *   3. is_admin() with that session: on the admin list AND signed in with a
 *      second factor (aal2), answered by the database from the verified JWT.
 *   4. admin_is_admin() with the service role: still on the list, not banned.
 *
 * The first request of each admin session is written to the activity log.
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

  const access = await checkAccess(header(req, ACCESS_HEADER))
  if (access.status === 'denied') {
    res.status(403).json({ message: 'Cloudflare Access sign-in required' })
    return null
  }
  if (access.status === 'allowed') viaCloudflare.add(req)

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

  const { data: twoFactorAdmin, error: sessionError } = await supabase.rpc('is_admin')
  if (sessionError || twoFactorAdmin !== true) {
    const { data: needsSecondFactor } = await supabase.rpc('needs_admin_second_factor')
    res.status(403).json({ message: needsSecondFactor === true ? 'Two-factor sign-in required' : 'This account is not an admin' })
    return null
  }

  const { data: isAdmin, error: adminError } = await getSupabaseAdmin().rpc('admin_is_admin', { target: user.id })
  if (adminError || isAdmin !== true) {
    res.status(403).json({ message: 'This account is not an admin' })
    return null
  }

  // Once per session (the database ignores repeats): who, how they signed in, from where.
  const { ip, userAgent } = requestOrigin(req)
  const { error: noteError } = await supabase.rpc('note_admin_session', { p_ip: ip, p_user_agent: userAgent })
  if (noteError) console.error('Admin activity log (sign-in):', noteError.message)

  return user.id
}
