'use client'

import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

let cached: Promise<boolean> | undefined

/** Browser-side membership check used inside client components (e.g. the recipe feed). */
export function isViewerMember(): Promise<boolean> {
  if (typeof window === 'undefined' || !isSupabaseConfigured()) return Promise.resolve(false)
  cached ??= (async () => {
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return false
      // Own row only, through the member's profile function; profiles.tier is not client-readable.
    const { data } = await supabase.rpc('my_profile')
      return data?.tier === 'plus' || data?.tier === 'pro'
    } catch {
      return false
    }
  })()
  return cached
}
