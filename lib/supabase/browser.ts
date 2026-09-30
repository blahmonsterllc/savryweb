'use client'

import { createBrowserClient } from '@supabase/ssr'
import { requireSupabasePublishableKey, requireSupabaseURL } from './config'

let browserClient: ReturnType<typeof createBrowserClient> | undefined

export function getSupabaseBrowserClient() {
  browserClient ??= createBrowserClient(requireSupabaseURL(), requireSupabasePublishableKey())
  return browserClient
}
