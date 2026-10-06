import CollectionGrid, { type CollectionCardData } from '@/components/CollectionGrid'
import OwnPrivateCollections from '@/components/OwnPrivateCollections'
import { getSupabasePublic } from '@/lib/supabase/public'

/**
 * A cook's public collections, on their page. Server-rendered and cached, so
 * it reads as an anonymous visitor; the cook's own private collections are
 * added in the browser by OwnPrivateCollections.
 */
export default async function CookCollections({ username, displayName }: { username: string; displayName: string }) {
  const { data } = await getSupabasePublic().rpc('cook_collections', { target_username: username })
  const collections = ((data as { collections?: CollectionCardData[] } | null)?.collections ?? [])
  return (
    <section className="cook-page__collections" aria-labelledby={collections.length > 0 ? 'cook-collections-title' : undefined}>
      {collections.length > 0 && (
        <>
          <div className="section-heading section-heading--row">
            <div><span className="eyebrow">Put together</span><h2 id="cook-collections-title">Collections by {displayName}</h2></div>
          </div>
          <CollectionGrid username={username} collections={collections} />
        </>
      )}
      <OwnPrivateCollections username={username} />
    </section>
  )
}
