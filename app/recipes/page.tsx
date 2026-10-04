import type { Metadata } from 'next'
import { listPublicRecipes } from '@/lib/community-recipes'
import { SITE_URL } from '@/lib/site-url'
import RecipeExplorer from '@/components/RecipeExplorer'
import Image from 'next/image'
import Link from 'next/link'
import { safeJsonLd } from '@/lib/security-policy.mjs'

export const revalidate = 120

export const metadata: Metadata = {
  title: 'Community recipes',
  description: 'Browse recipes from Savry Kitchen and the cooks joining the Savry community.',
  alternates: { canonical: `${SITE_URL}/recipes` },
}

export default async function RecipesIndexPage() {
  let recipes: Awaited<ReturnType<typeof listPublicRecipes>> = []
  try {
    recipes = await listPublicRecipes(1000)
  } catch (error) {
    console.error('recipes index: failed to load', error)
  }

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Savry community recipes',
    numberOfItems: recipes.length,
    itemListElement: recipes.map((recipe, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: recipe.url,
      name: recipe.title,
    })),
  }

  return (
    <main className="recipe-index site-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }} />
      <header className="recipe-index__header">
        <div className="recipe-index__art" aria-hidden="true">
          <Image src="/images/shared-table-vegetables.webp" alt="" fill priority sizes="(max-width: 760px) 100vw, 720px" />
        </div>
        <span className="eyebrow">The shared table</span>
        <h1>Recipes for the<br />shared table.</h1>
        <p>Start with recipes from Savry Kitchen, then help fill the shared table with dishes from your own kitchen.</p>
        <div className="recipe-index__legend">
          <span><i className="legend-dot legend-dot--coral" /> New recipes</span>
          <span><i className="legend-dot legend-dot--mint" /> Community publishing is open</span>
        </div>
        <div className="recipe-index__actions">
          <Link href="/recipes/new" className="button button--coral">Add your recipe</Link>
          <span>Free community account required to publish.</span>
        </div>
      </header>

      {recipes.length === 0 ? (
        <div className="recipe-index__empty">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/roasted-tomato-white-bean-skillet.webp" alt="Roasted tomato and white bean skillet" />
          <div>
            <span className="eyebrow">The first plate is yours</span>
            <h2>Share the recipe people always ask you for.</h2>
            <p>Create a community account and add it on the web. Your original stays yours, with clear credit whenever you share it.</p>
            <div className="recipe-index__empty-actions">
              <Link href="/recipes/new" className="button button--coral">Add on the web</Link>
              <Link href="/app-login?returnTo=/recipes/new" className="button button--light">Create an account</Link>
            </div>
          </div>
        </div>
      ) : (
        <RecipeExplorer recipes={recipes} />
      )}
    </main>
  )
}
