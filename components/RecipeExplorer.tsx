'use client'

import Link from 'next/link'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

type ExplorerRecipe = {
  id: string
  slug: string
  title: string
  description: string | null
  imageUrl: string | null
  authorName: string
  publishedAt: string
  totalTime: number
  difficulty: string
  category: string
  cuisine: string | null
  tags: string[]
  dietaryTags: string[]
  ingredients: Array<{ name: string }>
  madeCount: number
  commentCount: number
  version: number
}

export default function RecipeExplorer({ recipes }: { recipes: ExplorerRecipe[] }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [diet, setDiet] = useState('all')
  const [maxTime, setMaxTime] = useState('all')
  const [sort, setSort] = useState<'community' | 'newest' | 'quick'>('newest')

  const categories = useMemo(
    () => Array.from(new Set(recipes.map((recipe) => recipe.category).filter(Boolean))).sort(),
    [recipes]
  )
  const diets = useMemo(
    () => Array.from(new Set(recipes.flatMap((recipe) => recipe.dietaryTags).filter(Boolean))).sort(),
    [recipes]
  )

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return recipes
      .filter((recipe) => category === 'all' || recipe.category === category)
      .filter((recipe) => diet === 'all' || recipe.dietaryTags.includes(diet))
      .filter((recipe) => maxTime === 'all' || (recipe.totalTime > 0 && recipe.totalTime <= Number(maxTime)))
      .filter((recipe) => {
        if (!needle) return true
        return [
          recipe.title,
          recipe.description,
          recipe.authorName,
          recipe.category,
          recipe.cuisine,
          ...recipe.tags,
          ...recipe.dietaryTags,
          ...recipe.ingredients.map((ingredient) => ingredient.name),
        ].some((value) => String(value ?? '').toLowerCase().includes(needle))
      })
      .sort((a, b) => {
        if (sort === 'newest') return Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
        if (sort === 'quick') return (a.totalTime || Number.MAX_SAFE_INTEGER) - (b.totalTime || Number.MAX_SAFE_INTEGER)
        return b.madeCount * 5 + b.version - (a.madeCount * 5 + a.version)
      })
  }, [category, diet, maxTime, query, recipes, sort])

  const hasFilters = Boolean(query.trim()) || category !== 'all' || diet !== 'all' || maxTime !== 'all'

  function clearFilters() {
    setQuery('')
    setCategory('all')
    setDiet('all')
    setMaxTime('all')
  }

  return (
    <section className="recipe-explorer" aria-label="Explore community recipes">
      <div className="recipe-explorer__tools">
        <label className="recipe-explorer__search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search recipes</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search dishes, ingredients or cooks" />
        </label>
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
          <option value="all">All categories</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={maxTime} onChange={(event) => setMaxTime(event.target.value)} aria-label="Filter by total time">
          <option value="all">Any time</option>
          <option value="30">30 min or less</option>
          <option value="45">45 min or less</option>
          <option value="60">60 min or less</option>
        </select>
        <select value={diet} onChange={(event) => setDiet(event.target.value)} aria-label="Filter by dietary need">
          <option value="all">Any diet</option>
          {diets.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort recipes">
          <option value="newest">Newest</option>
          <option value="community">Most cooked</option>
          <option value="quick">Quickest</option>
        </select>
      </div>

      <div className="recipe-explorer__summary">
        <p className="recipe-explorer__count">{visible.length} recipe{visible.length === 1 ? '' : 's'} at the table</p>
        {hasFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}
      </div>

      {visible.length ? (
        <ul className="recipe-index__grid">
          {visible.map((recipe) => (
              <li key={recipe.id} className="recipe-index-card">
                <Link href={`/recipes/${recipe.slug}`}>
                  {recipe.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={recipe.imageUrl} alt={recipe.title} loading="lazy" />
                  ) : (
                    <div className="recipe-index-card__placeholder"><span>{recipe.title.charAt(0)}</span></div>
                  )}
                  <div className="recipe-index-card__body">
                    <p className="recipe-index-card__kicker">{recipe.category || 'Community recipe'}</p>
                    <h2>{recipe.title}</h2>
                    <p className="recipe-index-card__meta">
                      {[recipe.cuisine, recipe.totalTime ? `${recipe.totalTime} min` : null, recipe.difficulty].filter(Boolean).join(' · ')}
                    </p>
                    <div className="recipe-index-card__foot">
                      <span>by {recipe.authorName}</span>
                      <span>{recipe.commentCount > 0 ? `${recipe.commentCount} cook note${recipe.commentCount === 1 ? '' : 's'}` : recipe.madeCount > 0 ? `${recipe.madeCount} made it` : 'new to Savry'}{recipe.version > 1 ? ` · v${recipe.version}` : ''}</span>
                    </div>
                  </div>
                </Link>
              </li>
          ))}
        </ul>
      ) : (
        <div className="recipe-explorer__none">No recipes match that yet. Try another ingredient or category.</div>
      )}
    </section>
  )
}
