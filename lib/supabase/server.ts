import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireSupabasePublishableKey, requireSupabaseURL } from './config'

export function getSupabaseServerClient() {
  const cookieStore = cookies()

  return createServerClient(requireSupabaseURL(), requireSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Components cannot always write cookies. Route handlers can,
          // and the browser client refreshes the session during normal use.
        }
      },
    },
  })
}
