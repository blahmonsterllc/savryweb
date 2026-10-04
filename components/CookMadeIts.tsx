import Link from 'next/link'
import { getSupabasePublic } from '@/lib/supabase/public'

type MadeIt = { id: string; at: string; note: string | null; photoUrl: string; recipe: { slug: string; title: string; authorName: string; authorUsername: string | null } }

/** The dishes a cook has made, as a photo gallery on their page. Nothing to show means nothing rendered. */
export default async function CookMadeIts({ username, displayName }: { username: string; displayName: string }) {
  let items: MadeIt[] = []
  try {
    const { data } = await getSupabasePublic().rpc('cook_made_its', { target_username: username, result_limit: 12 })
    items = ((data as { items?: MadeIt[] } | null)?.items ?? [])
  } catch {
    items = []
  }
  if (!items.length) return null
  return (
    <section className="cook-page__made" aria-labelledby="cook-made-title">
      <div className="section-heading section-heading--row">
        <div><span className="eyebrow">Out of the oven</span><h2 id="cook-made-title">What {displayName} has made</h2></div>
      </div>
      <ul className="made-gallery">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/recipes/${item.recipe.slug}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.photoUrl} alt={`${displayName} made ${item.recipe.title}`} loading="lazy" />
              <span className="made-gallery__caption">
                <strong>{item.recipe.title}</strong>
                {item.recipe.authorUsername && item.recipe.authorUsername !== username && <small>by {item.recipe.authorName}</small>}
                {item.note && <em>{item.note}</em>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
