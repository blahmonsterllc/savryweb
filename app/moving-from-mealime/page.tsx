import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ExternalLink } from 'lucide-react'
import { SITE_URL } from '@/lib/site-url'

// For people looking for a new meal planner after Mealime closes. Everything
// said about Mealime is taken from its own closing notice, linked below, and
// dated, because it will go out of date. Mealime is named only to describe the
// switch; Savry is not connected to Mealime or Albertsons Companies.

export const metadata: Metadata = {
  title: 'Moving from Mealime? Plan your week with Savry',
  description: 'Mealime closes on October 21, 2026. Savry plans your week of meals, builds the grocery list, and shows what each recipe costs per serving. Free to start.',
  alternates: { canonical: `${SITE_URL}/moving-from-mealime` },
}

const MEALIME_NOTICE = 'https://www.mealime.com/closing'

const whatYouGet = [
  'A week of meals planned in minutes, from your own recipes and every recipe on Savry.io',
  'The cost of every recipe per serving, so you know what the week will cost before you shop',
  'One grocery list that combines the week, ticks off what you already have, and can be shared with your family',
  'Allergy checks on every recipe, including foods sold under other names (Nutella, filberts and pralines are hazelnuts)',
  'Recipes from any website or from TikTok, Instagram, Facebook and YouTube posts with the recipe in the caption',
]

const steps = [
  {
    title: 'Before October 21, keep the recipes you cook most',
    body: 'Mealime’s notice says personal data is deleted when the app closes, and it does not mention an export. Open each favorite and write it down, take a screenshot, or copy the ingredients and steps into a note.',
  },
  {
    title: 'Add them to Savry',
    body: 'In the Savry app, type a recipe in with Add Manually, or with Savry+ import a screenshot of it. Recipes you add stay private in your own kitchen.',
  },
  {
    title: 'Plan the week',
    body: 'Pick the meals you want, and Savry fills in the week from your recipes and Savry.io’s, then builds the grocery list with what it should cost.',
  },
]

export default function MovingFromMealimePage() {
  return (
    <main className="plus-page">
      <section className="plus-hero site-shell">
        <div className="plus-hero__copy">
          <span className="eyebrow">Moving from Mealime</span>
          <h1>Keep planning the week. Now with what it costs.</h1>
          <p>
            Mealime closes on October 21, 2026. If it was how you planned dinners and made your grocery list, Savry does the same job and adds
            the price: every recipe shows its cost per serving, and a planned week shows what the groceries should come to.
          </p>
          <div className="plus-hero__actions">
            <Link href="/recipes" className="button button--coral">Browse recipes</Link>
            <Link href="/app-login?returnTo=/welcome" className="button--ghost-dark">Create a free account</Link>
          </div>
          <p className="plus-hero__note">
            The Savry iPhone app is in its final round of testing. Create a free account and we&rsquo;ll email you the day it&rsquo;s in the App Store.
          </p>
        </div>

        <aside className="plus-card" aria-label="What Savry does">
          <h2>What you get with Savry</h2>
          <ul>
            {whatYouGet.map((item) => <li key={item}><Check size={18} /> <span>{item}</span></li>)}
          </ul>
          <span className="plus-card__fine">Free to use. <Link href="/savry-plus" className="underline">Savry+</Link> adds planning under a weekly grocery budget, a scan of your fridge and pantry, and unlimited AI help.</span>
        </aside>
      </section>

      <section className="plus-free">
        <div className="site-shell plus-free__inner">
          <div>
            <span className="eyebrow">Switching in three steps</span>
            <h2>Bring your favorites along.</h2>
            <p>
              What Mealime says about closing, as of October 16, 2026: the app is discontinued on October 21, Pro recipes and features are free to
              everyone until then, subscriptions won&rsquo;t renew, and personal data is deleted when it closes. Its owner, Albertsons Companies,
              is moving people to Meals Hub in its store apps.{' '}
              <a href={MEALIME_NOTICE} rel="nofollow noopener" className="underline">Read Mealime&rsquo;s notice <ExternalLink size={14} className="inline" /></a>
            </p>
          </div>
          <ol className="space-y-4">
            {steps.map((step, index) => (
              <li key={step.title}>
                <strong>{index + 1}. {step.title}</strong>
                <p className="mt-1 text-gray-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="site-shell py-10">
        <p className="text-xs text-gray-500">
          Savry is independent and not affiliated with Mealime or Albertsons Companies. Mealime is a trademark of its owner and is named here only to
          describe moving from one app to another.
        </p>
      </section>
    </main>
  )
}
