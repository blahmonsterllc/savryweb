import Link from 'next/link'
import { getSupabasePublic } from '@/lib/supabase/public'

type Card = { id: string; slug: string; title: string; description: string | null; itemCount: number; coverUrls: string[] }

/** A cook's public collections, on their page. Server-rendered; nothing to show means nothing rendered. */
export default async function CookCollections({ username, displayName }: { username: string; displayName: string }) {
  const { data } = await getSupabasePublic().rpc('cook_collections', { target_username: username })
  const collections = ((data as { collections?: Card[] } | null)?.collections ?? [])
  if (!collections.length) return null
  return (
    <section className="cook-page__collections" aria-labelledby="cook-collections-title">
      <div className="section-heading section-heading--row">
        <div><span className="eyebrow">Put together</span><h2 id="cook-collections-title">Collections by {displayName}</h2></div>
      </div>
      <ul className="collection-grid">
        {collections.map((collection) => (
          <li key={collection.id}>
            <Link href={`/cooks/${username}/collections/${collection.slug}`}>
              <span className="collection-grid__covers" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => collection.coverUrls[i]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img key={i} src={collection.coverUrls[i]} alt="" loading="lazy" />
                  : <span key={i} />)}
              </span>
              <span className="collection-grid__body">
                <strong>{collection.title}</strong>
                <small>{collection.itemCount} recipe{collection.itemCount === 1 ? '' : 's'}</small>
                {collection.description && <span>{collection.description}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
