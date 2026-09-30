import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/site-url'
import AccountHub from '@/components/AccountHub'

export const metadata: Metadata = {
  title: 'My Savry',
  description: 'Your Savry community account and the recipes you share.',
  alternates: { canonical: `${SITE_URL}/account` },
  robots: { index: false, follow: false },
}

export default function AccountPage() {
  return (
    <main className="account-page site-shell">
      <header>
        <span className="eyebrow">Your community account</span>
        <h1>One community kitchen.</h1>
        <p>Manage the recipes you share during the web preview. Your account will connect to the Savry app when the Apple experience launches.</p>
      </header>
      <AccountHub />
    </main>
  )
}
