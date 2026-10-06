import Link from 'next/link'
import { Lock } from 'lucide-react'

export type CollectionCardData = { id: string; slug: string; title: string; description: string | null; isPublic?: boolean; itemCount: number; coverUrls: string[] }

/** The grid of collection cards on a cook's page. */
export default function CollectionGrid({ username, collections }: { username: string; collections: CollectionCardData[] }) {
  return (
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
              <small>{collection.isPublic === false && <><Lock size={11} /> Private · </>}{collection.itemCount} recipe{collection.itemCount === 1 ? '' : 's'}</small>
              {collection.description && <span>{collection.description}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
