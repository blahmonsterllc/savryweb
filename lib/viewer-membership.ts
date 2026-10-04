import 'server-only'

import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export type ViewerMembership = { isMember: boolean; tier: 'free' | 'plus' | 'pro' | null }

const MEMBER_TIERS = new Set(['plus', 'pro'])

/**
 * Reads the Supabase session cookie for the current request and reports
 * whether the viewer is a Savry+ (or pro) member. Never throws: an anonymous
 * visitor, a missing configuration, or a Supabase error all mean "not a member".
 */
export async function getViewerMembership(): Promise<ViewerMembership> {
  if (!isSupabaseConfigured()) return { isMember: false, tier: null }
  try {
    const supabase = getSupabaseServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { isMember: false, tier: null }

    // Own row only, through the member's profile function; profiles.tier is not client-readable.
    const { data } = await supabase.rpc('my_profile')
    const tier = (data?.tier as ViewerMembership['tier']) ?? 'free'
    return { isMember: MEMBER_TIERS.has(tier), tier }
  } catch (error) {
    console.warn('viewer membership: could not read session', error)
    return { isMember: false, tier: null }
  }
}
