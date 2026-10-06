import Link from 'next/link'
import { ArrowRight, Lock } from 'lucide-react'
import RecipeShareBar from '@/components/RecipeShareBar'
import { SITE_URL } from '@/lib/site-url'

export type CollectionRecipe = { id: string; slug: string; title: string; imageUrl: string | null; category: string | null; totalTime: number; madeCount: number; authorName: string }
export type CollectionDetail = {
  slug: string; title: string; description: string | null; isPublic: boolean; itemCount: number; updatedAt: string
  owner: { username: string | null; displayName: string }
  recipes: CollectionRecipe[]
}

/** One collection with its recipes. Rendered by the cached page for public collections and in the browser for an owner's private one. */
export default function CollectionView({ detail, username }: { detail: CollectionDetail; username: string }) {
  const url = `${SITE_URL}/cooks/${username}/collections/${detail.slug}`
  return (
    <main className="cook-page collection-page site-shell">
      <header className="collection-page__header">
        <span className="eyebrow">
          A collection by <Link href={`/cooks/${username}`}>{detail.owner.displayName}</Link>
          {!detail.isPublic && <> · <Lock size={12} /> private</>}
        </span>
        <h1>{detail.title}</h1>
        {detail.description && <p className="cook-page__bio">{detail.description}</p>}
        <div className="cook-page__actions">
          <span className="follow-button__count">{detail.itemCount} recipe{detail.itemCount === 1 ? '' : 's'}</span>
          {detail.isPublic && <RecipeShareBar title={`${detail.title} by ${detail.owner.displayName}`} url={url} imageUrl={detail.recipes[0]?.imageUrl} label="Share this collection" />}
        </div>
      </header>

      {detail.recipes.length ? (
        <ul className="cook-page__grid">
          {detail.recipes.map((recipe) => (
            <li key={recipe.id}>
              <Link href={`/recipes/${recipe.slug}`}>
                {recipe.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={recipe.imageUrl} alt="" loading="lazy" />
                ) : (
                  <span className="cook-page__placeholder" aria-hidden="true">{recipe.title.charAt(0)}</span>
                )}
                <div>
                  <h3>{recipe.title}</h3>
                  <p>{[recipe.totalTime ? `${recipe.totalTime} min` : null, recipe.category, `by ${recipe.authorName}`].filter(Boolean).join(' · ')}</p>
                </div>
                <ArrowRight size={18} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cook-page__empty">Nothing in this collection yet.</p>
      )}
    </main>
  )
}
