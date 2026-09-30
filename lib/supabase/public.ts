import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireSupabasePublishableKey, requireSupabaseURL } from './config'

let publicClient: SupabaseClient | undefined

/** RLS-constrained server client for public recipe reads. */
export function getSupabasePublic(): SupabaseClient {
  publicClient ??= createClient(requireSupabaseURL(), requireSupabasePublishableKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return publicClient
}
