'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import CollectionView, { type CollectionDetail } from '@/components/CollectionView'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'

/**
 * Shown when the cached page found no public collection at this address. The
 * page is rendered for anonymous visitors, so an owner's private collection
 * is fetched here with their own session; collection_detail returns it only
 * to its owner. Anyone else gets the not-found message.
 */
export default function OwnCollection({ username, slug }: { username: string; slug: string }) {
  const [detail, setDetail] = useState<CollectionDetail | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    const supabase = getSupabaseBrowserClient()
    supabase.auth.getSession().then(async ({ data }: { data: { session: unknown } }) => {
      if (!data.session) return active && setDetail(null)
      const { data: found, error } = await supabase.rpc('collection_detail', { target_username: username, target_slug: slug })
      if (active) setDetail(error ? null : ((found as CollectionDetail | null) ?? null))
    })
    return () => { active = false }
  }, [username, slug])

  if (detail) return <CollectionView detail={detail} username={username} />
  return (
    <main className="cook-page collection-page site-shell">
      <header className="collection-page__header">
        {detail === undefined ? (
          <p className="cook-page__empty">Loading…</p>
        ) : (
          <>
            <h1>Collection not found</h1>
            <p className="cook-page__bio">This collection is private or no longer exists.</p>
            <div className="cook-page__actions"><Link href={`/cooks/${username}`} className="text-link">See this cook’s page</Link></div>
          </>
        )}
      </header>
    </main>
  )
}
