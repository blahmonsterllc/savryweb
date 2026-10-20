import Link from 'next/link'
import { getSupabasePublic } from '@/lib/supabase/public'

type Card = { id: string; slug: string; title: string; imageUrl: string | null; category: string | null; totalTime: number; madeCount: number; saveCount: number; authorName: string; authorUsername: string | null; editorsPick: boolean; score?: number }

async function fetchCards(fn: 'trending_recipes' | 'editors_picks', limit: number): Promise<Card[]> {
  try {
    const { data } = await getSupabasePublic().rpc(fn, { result_limit: limit })
    return ((data as { recipes?: Card[] } | null)?.recipes ?? [])
  } catch {
    return []
  }
}

function RecipeTile({ recipe, badge }: { recipe: Card; badge?: string }) {
  return (
    <li className="table-week__tile">
      <Link href={`/recipes/${recipe.slug}`}>
        {recipe.imageUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={recipe.imageUrl} alt="" loading="lazy" />
          : <span className="table-week__placeholder" aria-hidden="true">{recipe.title.charAt(0)}</span>}
        <span className="table-week__body">
          {badge && <small className="table-week__badge">{badge}</small>}
          <strong>{recipe.title}</strong>
          <span>{[recipe.authorName ? `by ${recipe.authorName}` : null, recipe.totalTime ? `${recipe.totalTime} min` : null, recipe.madeCount ? `${recipe.madeCount} made it` : null].filter(Boolean).join(' · ')}</span>
        </span>
      </Link>
    </li>
  )
}

/**
 * Home page: what the community is cooking this week, and the editors' picks.
 * Server-rendered from two public functions; a section with nothing to show
 * is not rendered at all.
 */
export default async function TableThisWeek() {
  const [hot, chosen] = await Promise.all([fetchCards('trending_recipes', 6), fetchCards('editors_picks', 6)])
  // A row of one or two looks unfinished; each row waits until it has three.
  const trending = hot.length >= 3 ? hot : []
  const picks = chosen.length >= 3 ? chosen : []
  if (!trending.length && !picks.length) return null
  return (
    <section className="table-week site-shell" aria-labelledby="table-week-title">
      {trending.length > 0 && (
        <div className="table-week__group">
          <div className="section-heading section-heading--row">
            <div><h2 id="table-week-title">Cooked most this week</h2></div>
            <Link href="/feed" className="home-link">What cooks are making</Link>
          </div>
          <ul className="table-week__grid">
            {trending.map((recipe) => <RecipeTile key={recipe.id} recipe={recipe} badge={recipe.editorsPick ? "Editor's pick" : undefined} />)}
          </ul>
        </div>
      )}
      {picks.length > 0 && (
        <div className="table-week__group">
          <div className="section-heading section-heading--row">
            <div><h2>Editor&rsquo;s picks</h2></div>
            <Link href="/recipes" className="home-link">All recipes</Link>
          </div>
          <ul className="table-week__grid">
            {picks.map((recipe) => <RecipeTile key={recipe.id} recipe={recipe} />)}
          </ul>
        </div>
      )}
    </section>
  )
}
