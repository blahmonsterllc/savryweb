import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/site-url'

export const metadata: Metadata = {
  title: 'Partner with Savry',
  description: 'Tasteful, clearly labeled advertising for food and kitchen brands on the Savry recipe community.',
  alternates: { canonical: `${SITE_URL}/advertise` },
}

export default function AdvertisePage() {
  return (
    <main className="partner-page site-shell">
      <span className="eyebrow">Partnerships</span>
      <h1>Reach cooks while they are deciding what to make.</h1>
      <p className="partner-page__lede">Savry keeps advertising limited, clearly labeled, and away from cooking controls. Ads run on the website only, through Google AdSense with visitor consent, and Savry+ members never see them. We are a fit for thoughtful pantry, cookware, grocery, and food-access brands.</p>
      <div className="partner-page__grid">
        <article><span>01</span><h2>Recipe feed placement</h2><p>One clearly labeled unit inside the community recipe feed, between rows of recipe cards.</p></article>
        <article><span>02</span><h2>Recipe page placement</h2><p>One clearly labeled unit on each recipe page, placed below the ingredients and steps—never between them.</p></article>
        <article><span>03</span><h2>Useful by design</h2><p>No pop-ups, autoplay, fake buttons, or ads inside the Savry iOS app.</p></article>
      </div>
      <a className="button button--coral" href="mailto:kitchen@savry.io?subject=Savry%20partnership">Ask about a partnership</a>
      <Link className="text-link" href="/recipes">See the community experience</Link>
    </main>
  )
}
