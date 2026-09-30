import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPublicRecipeBySlug, ingredientLine, recipeJsonLd } from '@/lib/community-recipes'
import { safeJsonLd } from '@/lib/security-policy.mjs'
import RecipeShareBar from '@/components/RecipeShareBar'
import RecipeQuickActions from '@/components/RecipeQuickActions'
import RecipeDiscussion from '@/components/RecipeDiscussion'
import AdSlot from '@/components/AdSlot'

export const revalidate = 300

type Params = { params: { slug: string } }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const recipe = await getPublicRecipeBySlug(params.slug).catch(() => null)
  if (!recipe) return { title: 'Recipe not found' }
  const description = recipe.description ?? `${recipe.title}: ${recipe.ingredients.length} ingredients, ${recipe.instructions.length} steps.`
  return {
    title: recipe.title,
    description,
    alternates: { canonical: recipe.url },
    openGraph: {
      type: 'article',
      title: recipe.title,
      description,
      url: recipe.url,
      siteName: 'Savry',
      images: recipe.imageUrl ? [{ url: recipe.imageUrl }] : undefined,
    },
    twitter: {
      card: recipe.imageUrl ? 'summary_large_image' : 'summary',
      title: recipe.title,
      description,
      images: recipe.imageUrl ? [recipe.imageUrl] : undefined,
    },
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-primary-50 px-4 py-3 text-center">
      <div className="text-xs uppercase tracking-wide text-primary-700">{label}</div>
      <div className="text-lg font-semibold text-gray-900">{value}</div>
    </div>
  )
}

export default async function RecipePage({ params }: Params) {
  const recipe = await getPublicRecipeBySlug(params.slug).catch(() => null)
  if (!recipe) notFound()

  const jsonLd = recipeJsonLd(recipe)
  const sections = new Map<string, typeof recipe.ingredients>()
  for (const i of recipe.ingredients) {
    const key = i.section ?? ''
    sections.set(key, [...(sections.get(key) ?? []), i])
  }
  const yieldText = recipe.servingType === 'yields' ? `${recipe.servings} ${recipe.yieldUnit ?? 'items'}` : `${recipe.servings} servings`
  const n = recipe.nutritionPerServing

  return (
    <article className="mx-auto max-w-4xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <Link href="/recipes" className="text-sm text-primary-700 hover:underline">← All community recipes</Link>

      <header className="mt-4 overflow-hidden rounded-3xl bg-white shadow-xl">
        {recipe.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.imageUrl} alt={recipe.title} className="max-h-[420px] w-full object-cover" />
        )}
        <div className="p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">{recipe.title}</h1>
          {recipe.description && <p className="mt-3 text-lg text-gray-600">{recipe.description}</p>}
          <p className="mt-3 text-sm text-gray-500">
            Shared by{' '}
            {recipe.authorUsername ? (
              <Link href={`/cooks/${recipe.authorUsername}`} className="font-medium text-gray-700 underline-offset-2 hover:underline">{recipe.authorName}</Link>
            ) : (
              <span className="font-medium text-gray-700">{recipe.authorName}</span>
            )}
            {recipe.cuisine ? ` · ${recipe.cuisine}` : ''} · {recipe.difficulty}
            {recipe.madeCount > 0 ? ` · ${recipe.madeCount} cook${recipe.madeCount === 1 ? '' : 's'} made this` : ''}
            {recipe.version > 1 ? ` · v${recipe.version}` : ''}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Prep" value={recipe.prepTime ? `${recipe.prepTime} min` : '—'} />
            <Stat label="Cook" value={recipe.cookTime ? `${recipe.cookTime} min` : '—'} />
            <Stat label="Total" value={recipe.totalTime ? `${recipe.totalTime} min` : '—'} />
            <Stat label={recipe.servingType === 'yields' ? 'Makes' : 'Serves'} value={yieldText} />
          </div>

          {(recipe.tags.length > 0 || recipe.dietaryTags.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {[...recipe.dietaryTags, ...recipe.tags].map((t) => (
                <span key={t} className="rounded-full bg-secondary-100 px-3 py-1 text-xs font-medium text-secondary-800">{t}</span>
              ))}
            </div>
          )}

          <div className="mt-6"><RecipeShareBar title={recipe.title} url={recipe.url} imageUrl={recipe.imageUrl} /></div>
        </div>
      </header>

      <RecipeQuickActions cooking={{ title: recipe.title, ingredients: recipe.ingredients.map(ingredientLine), steps: recipe.instructions, ovenTemp: recipe.ovenTemp }} />

      <div className="mt-8 grid gap-8 md:grid-cols-5">
        <section id="ingredients" className="recipe-anchor md:col-span-2">
          <h2 className="text-xl font-bold text-gray-900">Ingredients</h2>
          <p className="mt-1 text-sm text-gray-500">Tap each item as you gather it.</p>
          {[...sections.entries()].map(([section, items]) => (
            <div key={section} className="mt-4">
              {section && <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary-700">{section}</h3>}
              <ul className="space-y-2">
                {items.map((i, idx) => (
                  <li key={idx} className="recipe-ingredient">
                    <label>
                      <input type="checkbox" />
                      <span>{ingredientLine(i)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {recipe.equipment.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-primary-700">Equipment</h3>
              <p className="mt-1 text-gray-700">{recipe.equipment.join(', ')}</p>
            </div>
          )}
          {recipe.ovenTemp && <p className="mt-4 text-sm text-gray-600">Oven: {recipe.ovenTemp}°F</p>}
        </section>

        <section id="instructions" className="recipe-anchor md:col-span-3">
          <h2 className="text-xl font-bold text-gray-900">Instructions</h2>
          <ol className="mt-4 space-y-4">
            {recipe.instructions.map((step, idx) => (
              <li key={idx} className="flex gap-4">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-r from-primary-600 to-secondary-600 text-sm font-bold text-white">{idx + 1}</span>
                <p className="pt-1 text-gray-800">{step}</p>
              </li>
            ))}
          </ol>
          {recipe.notes && (
            <div className="mt-6 rounded-xl bg-yellow-50 p-4 text-sm text-yellow-900">
              <span className="font-semibold">Notes: </span>{recipe.notes}
            </div>
          )}
        </section>
      </div>

      <AdSlot placement="recipe" />

      {n && (
        <section className="mt-10 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-bold text-gray-900">Nutrition per {recipe.servingType === 'yields' ? (recipe.yieldUnit?.replace(/s$/, '') ?? 'item') : 'serving'}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ['Calories', `${n.calories}`],
              ['Protein', `${n.protein} g`],
              ['Carbs', `${n.carbohydrates} g`],
              ['Fat', `${n.fat} g`],
              ['Fiber', `${n.fiber} g`],
              ['Sugar', `${n.sugar} g`],
              ['Sodium', `${n.sodium} mg`],
              ['Cholesterol', `${n.cholesterol} mg`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-gray-500">{k}</dt>
                <dd className="font-semibold text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-gray-500">
            {n.source === 'usdaFoodDataCentral'
              ? 'Nutrition matched to USDA FoodData Central records.'
              : n.source === 'packageLabel'
                ? 'Nutrition entered from package labels.'
                : n.source === 'onDeviceEstimate'
                  ? 'Estimated privately on the cook’s device.'
                  : n.source === 'localReference'
                    ? `Estimated from Savry’s local reference data${typeof n.ingredientCoverage === 'number' ? ` · ${Math.round(n.ingredientCoverage * 100)}% of ingredients matched` : ''}.`
                    : 'Nutrition is an estimate; verify amounts for medical or dietary decisions.'}
          </p>
        </section>
      )}

      <RecipeDiscussion slug={recipe.slug} initialCount={recipe.commentCount} />

      <section className="mt-10 rounded-3xl bg-white p-6 shadow sm:p-8">
        <span className="eyebrow">Add to the shared table</span>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">Have a recipe of your own?</h2>
        <p className="mt-2 max-w-2xl text-gray-600">Create a free Savry community account, publish a recipe you own, and learn from focused feedback from other home cooks and bakers.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/recipes/new" className="button button--coral">Share a recipe</Link>
          <Link href="/app-login?returnTo=/account" className="button button--light">Join the community</Link>
        </div>
      </section>

      {recipe.sourceURL && (
        <p className="mt-6 text-sm text-gray-500">
          Originally from <a href={recipe.sourceURL} rel="nofollow noopener" className="underline">{new URL(recipe.sourceURL).hostname}</a>
        </p>
      )}
    </article>
  )
}
