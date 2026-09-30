import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Partner with Savry',
  description: 'Tasteful sponsorship opportunities for food and kitchen brands on Savry.',
}

export default function AdvertisePage() {
  return (
    <main className="partner-page site-shell">
      <span className="eyebrow">Partnerships</span>
      <h1>Reach cooks while they are deciding what to make.</h1>
      <p className="partner-page__lede">Savry keeps sponsorships limited, clearly labeled, and away from cooking controls. We are a fit for thoughtful pantry, cookware, grocery, and food-access brands.</p>
      <div className="partner-page__grid">
        <article><span>01</span><h2>Community placement</h2><p>A quiet horizontal placement between recipe discovery and the Savry Chef workbench.</p></article>
        <article><span>02</span><h2>Recipe placement</h2><p>A clearly labeled unit after the complete recipe—never between ingredients and instructions.</p></article>
        <article><span>03</span><h2>Useful by design</h2><p>No pop-ups, autoplay, fake buttons, or ads inside the iOS cooking experience.</p></article>
      </div>
      <a className="button button--coral" href="mailto:partnerships@savry.app?subject=Savry%20partnership">Ask about a partnership</a>
      <Link className="text-link" href="/recipes">See the community experience</Link>
    </main>
  )
}
