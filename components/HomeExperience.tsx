import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, BookOpen, Check, RefreshCw, Sparkles, Users } from 'lucide-react'
import TableThisWeek from '@/components/TableThisWeek'

const featured = [
  {
    title: 'Roasted tomato & white bean skillet',
    author: 'Savry Kitchen',
    image: '/images/roasted-tomato-white-bean-skillet.webp',
    meta: '35 min · one pan',
    note: 'A Savry Kitchen launch recipe',
    accent: 'coral',
  },
  {
    title: 'Charred corn & avocado tacos',
    author: 'Savry Kitchen',
    image: '/images/charred-corn-avocado-tacos.webp',
    meta: '25 min · vegetarian',
    note: 'A Savry Kitchen launch recipe',
    accent: 'saffron',
  },
]

export default function HomeExperience() {
  return (
    <div className="savry-home">
      <section className="editorial-hero">
        <Image
          src="/images/savry-editorial-hero-natural.webp"
          alt="A home-cooked skillet of roasted tomatoes and white beans beside a well-used recipe notebook"
          fill
          priority
          sizes="100vw"
          className="editorial-hero__image"
        />
        <div className="editorial-hero__veil" />
        <div className="site-shell editorial-hero__content">
          <p className="eyebrow eyebrow--light">A living cookbook, made together</p>
          <h1>Good recipes<br />get passed around.</h1>
          <p className="editorial-hero__lede">
            Save what you love, cook it your way, and share the small changes that make dinner better. Every useful tweak can become part of the recipe.
          </p>
          <div className="editorial-hero__actions">
            <Link href="/recipes" className="button button--coral button--glow">Explore community recipes <ArrowRight size={18} /></Link>
            <Link href="/recipes/new" className="button button--ghost">Share your recipe</Link>
          </div>
          <div className="editorial-hero__proof">
            <span><Users size={17} /> A new community for home cooks</span>
            <span><RefreshCw size={17} /> Share recipes without losing your original</span>
          </div>
        </div>
      </section>

      <TableThisWeek />

      <section className="community-now site-shell" aria-labelledby="community-now-title">
        <div className="section-heading section-heading--row">
          <div>
            <span className="eyebrow">On Savry right now</span>
            <h2 id="community-now-title">Recipes for the first table.</h2>
          </div>
          <Link href="/recipes" className="text-link">See all recipes <ArrowRight size={17} /></Link>
        </div>

        <div className="community-layout">
          <div className="featured-recipes">
            {featured.map((recipe) => (
              <article className={`recipe-card recipe-card--${recipe.accent}`} key={recipe.title}>
                <div className="recipe-card__image-wrap">
                  <Image src={recipe.image} alt={recipe.title} fill sizes="(max-width: 900px) 100vw, 34vw" className="recipe-card__image" />
                  <span className="recipe-card__stamp"><Check size={14} /> launch kitchen</span>
                </div>
                <div className="recipe-card__body">
                  <div className="recipe-card__meta"><span>{recipe.meta}</span><span>by {recipe.author}</span></div>
                  <h3>{recipe.title}</h3>
                  <div className="recipe-card__stats"><span><BookOpen size={16} /> {recipe.note}</span></div>
                </div>
              </article>
            ))}
          </div>

          <aside className="activity-note" aria-label="Invitation to the Savry community">
            <div className="activity-note__tape" />
            <span className="eyebrow">The table is opening</span>
            <h3>Bring the recipe<br />people ask you for.</h3>
            <p>There are no invented cooks or inflated counters here. Join early, publish a recipe you own, and help shape the kind of food community you want to use.</p>
            <div className="editorial-hero__actions">
              <Link href="/app-login?returnTo=/recipes/new" className="button button--coral">Create an account</Link>
              <Link href="/recipes/new" className="text-link">Start a recipe <ArrowRight size={16} /></Link>
            </div>
            <p className="activity-note__foot">Featured cooks and chefs will always be real community members.</p>
          </aside>
        </div>
      </section>

      <section className="recipe-loop site-shell" aria-labelledby="recipe-loop-title">
        <div className="section-heading">
          <span className="eyebrow">How Savry works</span>
          <h2 id="recipe-loop-title">Start simple. Build together.</h2>
          <p>The preview begins with useful recipes, real accounts, and an easy way for cooks to contribute their own.</p>
        </div>
        <div className="recipe-loop__grid">
          <article>
            <span className="recipe-loop__number">01</span>
            <BookOpen size={27} />
            <h3>Bring in the recipe</h3>
            <p>Add your own recipe on the web. Link import and Savry’s cooking model will arrive after the preview.</p>
          </article>
          <article>
            <span className="recipe-loop__number">02</span>
            <Sparkles size={27} />
            <h3>Cook it your way</h3>
            <p>Browse clear ingredients and steps, then share the recipe with anyone who should try it next.</p>
          </article>
          <article>
            <span className="recipe-loop__number">03</span>
            <RefreshCw size={27} />
            <h3>Help set the table</h3>
            <p>Create an account and publish a recipe you own. Cook photos, comments, and structured improvements come next.</p>
          </article>
        </div>
      </section>

      <section className="app-bridge" id="app-coming-soon">
        <div className="site-shell app-bridge__inner">
          <div>
            <span className="eyebrow eyebrow--light">The Savry app is coming soon</span>
            <h2>Meet the community.<br />Then take it to the kitchen.</h2>
            <p>The preview starts here on the web: discover recipes, make an account, and share your own. The iPhone, iPad, Apple Watch, and desktop experiences are still being finished for the full launch.</p>
            <Link href="/app-login?returnTo=/account" className="button button--paper">Join the preview <ArrowRight size={18} /></Link>
          </div>
          <div className="app-bridge__card" aria-label="Example recipe handoff to the Savry app">
            <div className="app-bridge__card-top">
              <Image src="/savry-logo.svg" alt="" width={46} height={44} />
              <span>IN DEVELOPMENT</span>
            </div>
            <div className="app-bridge__recipe">
              <span>COMMUNITY PICK</span>
              <h3>Roasted tomato & white bean skillet</h3>
              <p>35 minutes · 4 servings</p>
            </div>
            <div className="app-bridge__check"><Check size={20} /> Cooking mode, grocery lists, and Apple Watch support are on the way</div>
          </div>
        </div>
      </section>

    </div>
  )
}
