import Link from 'next/link'
import { ArrowRight, Flame, Star } from 'lucide-react'
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
  const [trending, picks] = await Promise.all([fetchCards('trending_recipes', 6), fetchCards('editors_picks', 6)])
  if (!trending.length && !picks.length) return null
  return (
    <section className="table-week site-shell" aria-labelledby="table-week-title">
      {trending.length > 0 && (
        <div className="table-week__group">
          <div className="section-heading section-heading--row">
            <div><span className="eyebrow"><Flame size={13} /> On the table this week</span><h2 id="table-week-title">What everyone is cooking.</h2></div>
            <Link href="/feed" className="text-link">See the table <ArrowRight size={17} /></Link>
          </div>
          <ul className="table-week__grid">
            {trending.map((recipe) => <RecipeTile key={recipe.id} recipe={recipe} badge={recipe.editorsPick ? "Editor's pick" : undefined} />)}
          </ul>
        </div>
      )}
      {picks.length > 0 && (
        <div className="table-week__group">
          <div className="section-heading section-heading--row">
            <div><span className="eyebrow"><Star size={13} /> Editor&rsquo;s picks</span><h2>Chosen by the Savry Kitchen.</h2></div>
            <Link href="/recipes" className="text-link">All recipes <ArrowRight size={17} /></Link>
          </div>
          <ul className="table-week__grid">
            {picks.map((recipe) => <RecipeTile key={recipe.id} recipe={recipe} />)}
          </ul>
        </div>
      )}
    </section>
  )
}
