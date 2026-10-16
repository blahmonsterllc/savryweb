import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/site-url'

// The App Store's Support URL: how to reach Savry, and answers to the
// questions people ask most. Button names match the app's own wording.

export const metadata: Metadata = {
  title: 'Support',
  description: 'Get help with Savry: contact us, manage Savry+, restore purchases, share your grocery list with family, delete your account, or report a recipe.',
  alternates: { canonical: `${SITE_URL}/support` },
}

const questions: { id: string; q: string; a: React.ReactNode }[] = [
  {
    id: 'savry-plus',
    q: 'How do I cancel or change Savry+?',
    a: <>Savry+ is billed by Apple. On your iPhone open <strong>Settings → your name → Subscriptions → Savry</strong>, or in the Savry app tap <strong>Manage Subscription</strong>. Cancel at least a day before the renewal date; you keep Savry+ until the end of the period you paid for. Refunds are handled by Apple at <a href="https://reportaproblem.apple.com">reportaproblem.apple.com</a>.</>,
  },
  {
    id: 'restore',
    q: 'I paid for Savry+ but the app doesn’t show it.',
    a: <>Make sure you’re signed in to the App Store with the Apple Account you used to buy it, then tap <strong>Restore Purchases</strong> in the app’s Savry+ screen. If someone in your Family Sharing group bought it, Family Sharing must be turned on for purchases.</>,
  },
  {
    id: 'family-list',
    q: 'How do I share the grocery list with my family?',
    a: <>On the Grocery List, tap the people icon, then <strong>Invite family</strong>, and send the invitation by Messages or Mail. Everyone needs the Savry app and an iCloud account; nobody needs a Savry account. Anyone on the list can add and tick items, and you can stop sharing at any time from the same screen.</>,
  },
  {
    id: 'sync',
    q: 'My recipes aren’t on my other iPhone or iPad.',
    a: <>Recipes sync through your iCloud. Check that both devices are signed in to the same Apple Account and that iCloud is on for Savry in <strong>Settings → your name → iCloud</strong>. Changes can take a few minutes to arrive.</>,
  },
  {
    id: 'allergies',
    q: 'How do the allergy warnings work?',
    a: <>Set the allergies to avoid in the app’s <strong>Food Safety Profile</strong>. Savry checks every recipe’s ingredients for them, including foods sold under other names (Nutella and filberts are hazelnuts, for example), and warns you on the recipe. It can miss things: always read the labels on what you buy, because brands and kitchens differ.</>,
  },
  {
    id: 'costs',
    q: 'Where do the recipe costs come from?',
    a: <>From US average grocery prices published by the Bureau of Labor Statistics, scaled to prices in your state when you give the app your ZIP code. Savry+ members near a Kroger-family store also see that store’s shelf prices. They are estimates; your store will differ a little.</>,
  },
  {
    id: 'delete',
    q: 'How do I delete my account?',
    a: <>In the app, open <strong>Settings → Account → Delete account</strong>. This deletes your Savry.io account, everything you published, and the photos you uploaded. Recipes kept only in the app stay on your devices until you delete the app. You can also email <a href="mailto:privacy@savry.io">privacy@savry.io</a> from the address on your account, and we’ll finish the deletion within 30 days. Deleting your account does not cancel Savry+; cancel that with Apple.</>,
  },
  {
    id: 'report',
    q: 'How do I report a recipe or comment?',
    a: <>Use <strong>Report</strong> on the recipe or comment, or email <a href="mailto:kitchen@savry.io">kitchen@savry.io</a> with the link. You can also block a cook so you no longer see anything they post. If you believe something copies your work, see the copyright section of our <Link href="/terms#copyright">Terms</Link>.</>,
  },
]

export default function SupportPage() {
  return (
    <main className="legal-page site-shell">
      <header className="legal-page__header">
        <span className="eyebrow">Support</span>
        <h1>How can we help?</h1>
        <p className="legal-page__lede">
          Email <a href="mailto:kitchen@savry.io">kitchen@savry.io</a> and a person will answer, usually within two business days.
          For privacy questions or data requests, write to <a href="mailto:privacy@savry.io">privacy@savry.io</a>.
        </p>
      </header>

      {questions.map(({ id, q, a }) => (
        <section key={id} id={id}>
          <h2>{q}</h2>
          <p>{a}</p>
        </section>
      ))}

      <section id="more">
        <h2>Anything else</h2>
        <p>
          Read the <Link href="/terms">Terms of Service</Link> and the <Link href="/privacy">Privacy Policy</Link>, or email{' '}
          <a href="mailto:kitchen@savry.io">kitchen@savry.io</a>. Please include your iPhone model and iOS version if something in the app isn’t working.
        </p>
      </section>
    </main>
  )
}
