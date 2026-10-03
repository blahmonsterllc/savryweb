import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Lock } from 'lucide-react'
import RecipeShareBar from '@/components/RecipeShareBar'
import { getSupabasePublic } from '@/lib/supabase/public'
import { SITE_URL } from '@/lib/site-url'

export const revalidate = 120

type Recipe = { id: string; slug: string; title: string; imageUrl: string | null; category: string | null; totalTime: number; madeCount: number; authorName: string }
type Detail = {
  slug: string; title: string; description: string | null; isPublic: boolean; itemCount: number; updatedAt: string
  owner: { username: string | null; displayName: string }
  recipes: Recipe[]
}

async function load(username: string, slug: string): Promise<Detail | null> {
  const { data, error } = await getSupabasePublic().rpc('collection_detail', { target_username: username, target_slug: slug })
  if (error) throw error
  return (data as Detail | null) ?? null
}

export async function generateMetadata({ params }: { params: { username: string; slug: string } }): Promise<Metadata> {
  const detail = await load(params.username, params.slug).catch(() => null)
  if (!detail) return { title: 'Collection not found', robots: { index: false } }
  const title = `${detail.title} by ${detail.owner.displayName}`
  const description = detail.description ?? `${detail.itemCount} recipes collected by ${detail.owner.displayName} on Savry.`
  const url = `${SITE_URL}/cooks/${params.username}/collections/${detail.slug}`
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, images: detail.recipes[0]?.imageUrl ? [{ url: detail.recipes[0].imageUrl }] : undefined } }
}

export default async function CollectionPage({ params }: { params: { username: string; slug: string } }) {
  const detail = await load(params.username, params.slug).catch(() => null)
  if (!detail) notFound()
  const url = `${SITE_URL}/cooks/${params.username}/collections/${detail.slug}`

  return (
    <main className="cook-page collection-page site-shell">
      <header className="collection-page__header">
        <span className="eyebrow">
          A collection by <Link href={`/cooks/${params.username}`}>{detail.owner.displayName}</Link>
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
