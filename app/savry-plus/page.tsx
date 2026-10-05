import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ShieldCheck, Sparkles } from 'lucide-react'
import { SITE_URL } from '@/lib/site-url'
import PlusCallToAction from '@/components/PlusCallToAction'

export const metadata: Metadata = {
  title: 'Savry+ Membership',
  description: 'Savry+ plans your week of meals under a grocery budget, using what is already in your kitchen and prices where you shop. $4.99 a month or $29.99 a year, with a free week to start.',
  alternates: { canonical: `${SITE_URL}/savry-plus` },
}

const plusFeatures = [
  'Plan the week under a grocery budget: meal plans built from your own recipes that stay within what you want to spend',
  'Cook from what you already have: plans lean on your pantry first, so the shopping list is shorter',
  'Prices where you shop: costs scaled to your state, with shelf prices from your nearest Kroger-family store where there is one',
  'Unlimited recipe imports from websites and social posts, and on-device recipe help that never sends your data anywhere',
]

const freeFeatures = [
  'See what every recipe costs per serving, from US average grocery prices',
  'Explore, save and publish community recipes',
  'Keep private recipes on your device with iCloud sync',
]

export default function SavryPlusPage() {
  return (
    <main className="plus-page">
      <section className="plus-hero site-shell">
        <div className="plus-hero__copy">
          <span className="eyebrow">Savry+ membership</span>
          <h1>Plan the week. Know what it costs.</h1>
          <p>Set what you want to spend on groceries, tell Savry what is already in the kitchen, and get a week of meals from your own recipes that fits. Every recipe shows its cost per serving, priced where you shop. Prices are estimates, so your store will differ a little; the plan still keeps you close. Food restrictions stay in your control and are never guessed.</p>
          <div className="plus-hero__actions">
            <span className="plus-price"><strong>$29.99</strong><span>per year</span></span>
            <span className="plus-badge">First 7 days free</span>
          </div>
          <p className="plus-hero__alt">Or <strong>$4.99</strong> a month. The year saves 50%; cancel either any time.</p>
          <p className="plus-hero__note">Savry+ is an auto-renewing subscription purchased in the Savry app through the App Store. The yearly plan starts with a free week; you are not charged if you cancel before it ends. Cancel any time in your App Store settings.</p>
        </div>

        <aside className="plus-card" aria-label="Savry Plus membership benefits">
          <div className="plus-card__mark"><Sparkles size={20} /> Savry+</div>
          <h2>Cook with less friction.</h2>
          <ul>
            {plusFeatures.map((feature) => <li key={feature}><Check size={18} /> <span>{feature}</span></li>)}
          </ul>
          <PlusCallToAction />
          <span className="plus-card__fine"><ShieldCheck size={16} /> Your membership follows your Savry account on the web and in the app.</span>
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
