import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ExternalLink } from 'lucide-react'
import CookCollections from '@/components/CookCollections'
import CookMadeIts from '@/components/CookMadeIts'
import FollowButton from '@/components/FollowButton'
import RecipeShareBar from '@/components/RecipeShareBar'
import { getSupabasePublicCook } from '@/lib/community-recipes-supabase'
import { SOCIAL_NETWORKS, socialLinkLabel, socialLinkURL } from '@/lib/social-links'
import { SITE_URL } from '@/lib/site-url'

export const revalidate = 300

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'S'
}

function since(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const cook = await getSupabasePublicCook(params.username).catch(() => null)
  if (!cook) return { title: 'Cook not found', robots: { index: false } }
  const title = `${cook.displayName} (@${cook.username})`
  const description = cook.bio ?? `${cook.displayName} shares recipes with the Savry community.`
  const url = `${SITE_URL}/cooks/${cook.username}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'profile', images: cook.avatarUrl ? [{ url: cook.avatarUrl }] : undefined },
    twitter: { card: 'summary', title, description },
  }
}

export default async function CookPage({ params }: { params: { username: string } }) {
  const cook = await getSupabasePublicCook(params.username).catch(() => null)
  if (!cook) notFound()
  const url = `${SITE_URL}/cooks/${cook.username}`
  const links = SOCIAL_NETWORKS.map((network) => {
    const value = cook.socialLinks[network.key]
    const href = value ? socialLinkURL(network.key, value) : null
    return href ? { key: network.key, href, label: socialLinkLabel(network.key, value) } : null
  }).filter(Boolean) as { key: string; href: string; label: string }[]
  const madeCount = cook.recipes.reduce((sum, recipe) => sum + recipe.madeCount, 0)

  return (
    <main className="cook-page site-shell">
      <header className="cook-page__header">
        {cook.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cook.avatarUrl} alt="" className="cook-page__avatar" width={132} height={132} />
        ) : (
          <span className="cook-page__avatar cook-page__avatar--initials" aria-hidden="true">{initials(cook.displayName)}</span>
        )}
        <div className="cook-page__identity">
          <span className="eyebrow">Savry cook · since {since(cook.memberSince)}</span>
          <h1>{cook.displayName}</h1>
          <p className="cook-page__handle">@{cook.username}</p>
          {cook.bio && <p className="cook-page__bio">{cook.bio}</p>}
          <dl className="cook-page__stats">
            <div><dt>Recipes</dt><dd>{cook.recipes.length}</dd></div>
            <div><dt>Cooked by others</dt><dd>{madeCount}</dd></div>
          </dl>
          <div className="cook-page__actions">
            <FollowButton username={cook.username} />
            <RecipeShareBar title={`${cook.displayName} on Savry`} url={url} imageUrl={cook.avatarUrl} label="Share this cook" />
            {links.length > 0 && (
              <ul className="cook-page__links" aria-label="Elsewhere">
                {links.map((link) => (
                  <li key={link.key}><a href={link.href} target="_blank" rel="me noopener noreferrer">{link.label} <ExternalLink size={12} /></a></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </header>

      <section className="cook-page__recipes" aria-labelledby="cook-recipes-title">
        <div className="section-heading section-heading--row">
          <div><span className="eyebrow">From this kitchen</span><h2 id="cook-recipes-title">Recipes by {cook.displayName}</h2></div>
        </div>
        {cook.recipes.length ? (
          <ul className="cook-page__grid">
            {cook.recipes.map((recipe) => (
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
                    <p>{[recipe.totalTime ? `${recipe.totalTime} min` : null, recipe.cuisine, `${recipe.madeCount} made it`].filter(Boolean).join(' · ')}</p>
                  </div>
                  <ArrowRight size={18} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cook-page__empty">No public recipes yet. Check back soon.</p>
        )}
      </section>

      <CookMadeIts username={cook.username} displayName={cook.displayName} />
      <CookCollections username={cook.username} displayName={cook.displayName} />
    </main>
  )
}
