'use client'

import { Bookmark } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

/**
 * Saves a recipe to the member's Savry account. The same list shows on the
 * account page and in the iOS app's Community tab.
 */
export default function SaveRecipeButton({ slug }: { slug: string }) {
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    getSupabaseBrowserClient()
      .rpc('recipe_save_state', { target_slug: slug })
      .then(({ data }: { data: { saved?: boolean } | null }) => { if (active && data) setSaved(Boolean(data.saved)) })
    return () => { active = false }
  }, [slug])

  async function toggle() {
    const supabase = getSupabaseBrowserClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) {
      window.location.assign(`/app-login?returnTo=${encodeURIComponent(`/recipes/${slug}`)}`)
      return
    }
    setBusy(true)
    const { data, error } = await supabase.rpc('toggle_recipe_save', { target_slug: slug })
    setBusy(false)
    if (!error && data) setSaved(Boolean(data.saved))
  }

  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={saved} className={saved ? 'is-saved' : undefined}>
      <Bookmark size={17} aria-hidden="true" fill={saved ? 'currentColor' : 'none'} /> <span className="recipe-quick-actions__label">{saved ? 'Saved' : 'Save'}</span>
    </button>
  )
}
