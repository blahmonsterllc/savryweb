import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireSupabaseSecretKey, requireSupabaseURL } from './config'

let adminClient: SupabaseClient | undefined

/** Server-only client. Never import this module into a client component. */
export function getSupabaseAdmin(): SupabaseClient {
  adminClient ??= createClient(requireSupabaseURL(), requireSupabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return adminClient
}
