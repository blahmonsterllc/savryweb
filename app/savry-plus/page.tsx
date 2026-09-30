import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ShieldCheck, Sparkles } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Savry+ Membership',
  description: 'Meet Savry+—the founding membership for smarter meal planning, household cooking, and a calmer grocery trip.',
}

const plusFeatures = [
  'Unlimited recipe imports from supported websites and social posts, with the original source preserved',
  'Your own private on-device cooking profile that learns from favorites, ratings, repeat cooks, swaps, equipment, and timing',
  'Smarter weekly meal plans shaped around your household, schedule, and budget',
  'Expanded Savry Chef tools that adapt recipes to the way you actually cook',
  'Household recipe, meal-plan, and grocery-list collaboration across devices',
  'Advanced nutrition context, dietary filters, and ingredient insights',
  'Enhanced Apple Watch grocery tools and shopping organization',
  'An ad-free Savry website and app experience',
]

const freeFeatures = [
  'Explore and publish community recipes',
  'Save recipes and suggest improvements',
  'Build a core grocery list and use it on Apple Watch',
]

export default function SavryPlusPage() {
  return (
    <main className="plus-page">
      <section className="plus-hero site-shell">
        <div className="plus-hero__copy">
          <span className="eyebrow">Savry+ membership</span>
          <h1>More help for the kitchen you actually have.</h1>
          <p>Bring in recipes from the web and social posts, then let Savry privately learn from what you favorite, rate, repeat, skip, and change. Explicit food restrictions stay in control and are never guessed from behavior. Every person keeps a separate cooking profile, even when recipes and grocery lists are shared.</p>
          <div className="plus-hero__actions">
            <span className="plus-price"><strong>$29.99</strong><span>per year</span></span>
            <span className="plus-badge">Founding membership</span>
          </div>
          <p className="plus-hero__note">Membership opens at launch. No payment is being collected yet.</p>
        </div>

        <aside className="plus-card" aria-label="Savry Plus membership benefits">
          <div className="plus-card__mark"><Sparkles size={20} /> Savry+</div>
          <h2>Cook with less friction.</h2>
          <ul>
            {plusFeatures.map((feature) => <li key={feature}><Check size={18} /> <span>{feature}</span></li>)}
          </ul>
          <Link className="button button--coral" href="/account">Create your free Savry account</Link>
          <span className="plus-card__fine"><ShieldCheck size={16} /> Founding price stays active while the membership remains active.</span>
        </aside>
      </section>

      <section className="plus-free">
        <div className="site-shell plus-free__inner">
          <div>
            <span className="eyebrow">The community stays open</span>
            <h2>Free still means useful.</h2>
            <p>Savry+ funds the product, but the recipe community should be welcoming whether or not someone subscribes.</p>
          </div>
          <ul>
            {freeFeatures.map((feature) => <li key={feature}><Check size={18} /> <span>{feature}</span></li>)}
          </ul>
        </div>
      </section>
    </main>
  )
}
