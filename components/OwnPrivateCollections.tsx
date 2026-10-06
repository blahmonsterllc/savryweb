'use client'

import { useEffect, useState } from 'react'
import CollectionGrid, { type CollectionCardData } from '@/components/CollectionGrid'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

/**
 * The cook page is cached for every visitor, so it lists public collections
 * only. When the cook looks at their own page, their private collections are
 * fetched here with their session and shown below, marked private.
 */
export default function OwnPrivateCollections({ username }: { username: string }) {
  const [collections, setCollections] = useState<CollectionCardData[]>([])

  useEffect(() => {
    let active = true
    const supabase = getSupabaseBrowserClient()
    supabase.auth.getSession().then(async ({ data }: { data: { session: unknown } }) => {
      if (!data.session) return
      const { data: found } = await supabase.rpc('cook_collections', { target_username: username })
      const list = ((found as { collections?: (CollectionCardData & { mine?: boolean })[] } | null)?.collections ?? [])
      if (active) setCollections(list.filter((collection) => collection.mine && collection.isPublic === false))
    })
    return () => { active = false }
  }, [username])

  if (!collections.length) return null
  return (
    <>
      <div className="section-heading section-heading--row">
        <div><span className="eyebrow">Only you can see these</span><h2>Your private collections</h2></div>
      </div>
      <CollectionGrid username={username} collections={collections} />
    </>
  )
}
