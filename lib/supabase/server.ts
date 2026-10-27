import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireSupabasePublishableKey, requireSupabaseURL } from './config'

export async function getSupabaseServerClient() {
  // Next 15: request cookies are read asynchronously.
  const cookieStore = await cookies()

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
