import Link from 'next/link'
import Image from 'next/image'
import TableThisWeek from '@/components/TableThisWeek'
import { listPublicRecipes, type PublicRecipe } from '@/lib/community-recipes'

/** The photo at the top is a real recipe on the site; the caption links to it. */
const COVER_SLUG = 'roasted-tomato-white-bean-skillet'

/** How the index groups the site's categories, in the order a day is eaten. */
const SHELVES: { title: string; categories: string[] }[] = [
  { title: 'Breakfast', categories: ['Breakfast'] },
  { title: 'Lunch', categories: ['Lunch'] },
  { title: 'Dinner', categories: ['Dinner', 'Soup', 'Main Course'] },
  { title: 'Sides and snacks', categories: ['Side Dish', 'Appetizer', 'Snack'] },
  { title: 'Desserts and drinks', categories: ['Dessert', 'Beverage'] },
]
const PER_SHELF = 8

function price(dollars: number | null): string | null {
  if (dollars == null || !Number.isFinite(dollars)) return null
  return dollars < 1 ? `${Math.round(dollars * 100)}¢` : `$${dollars.toFixed(2)}`
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function IndexLine({ recipe }: { recipe: PublicRecipe }) {
  const cost = price(recipe.costPerServing)
  return (
    <li>
      <Link href={`/recipes/${recipe.slug}`}>
        <span className="home-index__title">{recipe.title}</span>
        <span className="home-index__leader" aria-hidden="true" />
        <span className="home-index__facts">
          {recipe.totalTime ? `${recipe.totalTime} min` : null}
          {recipe.totalTime && cost ? ' · ' : null}
          {cost ? `${cost}${recipe.servingType === 'yields' ? ' each' : ''}` : null}
        </span>
      </Link>
    </li>
  )
}

export default async function HomeExperience() {
  const recipes = await listPublicRecipes(1000).catch(() => [] as PublicRecipe[])
  const cover = recipes.find((recipe) => recipe.slug === COVER_SLUG)
  const typical = median(recipes.filter((r) => r.servingType !== 'yields').map((r) => r.costPerServing).filter((c): c is number => c != null))
  const quick = recipes.filter((r) => r.totalTime > 0 && r.totalTime <= 30).length
  const shelves = SHELVES
    .map((shelf) => ({ ...shelf, recipes: recipes.filter((r) => shelf.categories.includes(r.category)) }))
    .filter((shelf) => shelf.recipes.length > 0)

  return (
    <div className="savry-home">
      <section className="home-masthead site-shell" aria-labelledby="home-title">
        <div className="home-masthead__text">
          <h1 id="home-title">Home recipes, priced per serving.</h1>
          <p>
            Savry Kitchen wrote and tested the first {recipes.length || 'few hundred'} recipes, and home cooks add theirs as they join.
            Each one lists what it costs at average US grocery prices, its nutrition from USDA data, and the common allergens it contains.
          </p>
          {recipes.length > 0 && (
            <dl className="home-masthead__facts">
              <div><dt>Recipes</dt><dd>{recipes.length}</dd></div>
              {typical != null && <div><dt>Typical serving</dt><dd>{price(typical)}</dd></div>}
              {quick > 0 && <div><dt>Ready in 30 min or less</dt><dd>{quick}</dd></div>}
            </dl>
          )}
          <div className="home-masthead__actions">
            <Link href="/recipes" className="home-button">Browse the recipes</Link>
            <Link href="/recipes/new" className="home-link">Add one of yours</Link>
          </div>
        </div>
        <figure className="home-masthead__cover">
          <div className="home-masthead__photo">
            <Image
              src="/images/savry-editorial-hero-natural.webp"
              alt="Roasted tomatoes and white beans in a cast-iron skillet beside a recipe notebook"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 46vw"
            />
          </div>
          {cover && (
            <figcaption>
              <Link href={`/recipes/${cover.slug}`}>{cover.title}</Link>
              <span>{[cover.totalTime ? `${cover.totalTime} min` : null, price(cover.costPerServing) ? `${price(cover.costPerServing)} a serving` : null, 'illustration'].filter(Boolean).join(' · ')}</span>
            </figcaption>
          )}
        </figure>
      </section>

      <TableThisWeek />

      {shelves.length > 0 && (
        <section className="home-index site-shell" aria-labelledby="home-index-title">
          <header className="home-index__header">
            <h2 id="home-index-title">Index</h2>
            <p>Every recipe on Savry, by meal. Times are start to finish; prices are per serving.</p>
          </header>
          <div className="home-index__shelves">
            {shelves.map((shelf) => (
              <section key={shelf.title} className="home-index__shelf" aria-label={shelf.title}>
                <h3>{shelf.title} <small>{shelf.recipes.length}</small></h3>
                <ul>
                  {shelf.recipes.slice(0, PER_SHELF).map((recipe) => <IndexLine key={recipe.slug} recipe={recipe} />)}
                </ul>
                {shelf.recipes.length > PER_SHELF && (
                  <Link href={`/recipes?category=${encodeURIComponent(shelf.categories[0])}`} className="home-link">
                    All {shelf.recipes.length} {shelf.title.toLowerCase()} recipes
                  </Link>
                )}
              </section>
            ))}
          </div>
        </section>
      )}

      <section className="home-app site-shell" id="app-coming-soon" aria-labelledby="home-app-title">
        <div>
          <h2 id="home-app-title">Savry for iPhone</h2>
          <p>The app keeps your recipes and Savry&rsquo;s in one place and turns them into a week of meals. It is on its way to the App Store.</p>
          <Link href="/savry-plus" className="home-link">What Savry+ adds, $29.99 a year</Link>
        </div>
        <ul className="home-app__list">
          <li><strong>A week planned in a minute.</strong> From your saved recipes and Savry&rsquo;s, inside a budget if you set one.</li>
          <li><strong>One grocery list for the house.</strong> Shared with your family through iCloud and sorted by store aisle.</li>
          <li><strong>Allergies checked on every recipe.</strong> Including the less obvious ones, like hazelnut in praline or gianduja.</li>
          <li><strong>Savry Chef.</strong> Describe a dish or list what&rsquo;s in the fridge and it writes the recipe.</li>
          <li><strong>Import from anywhere.</strong> Recipe sites, and the recipe in a TikTok or Instagram caption.</li>
        </ul>
      </section>
    </div>
  )
}
