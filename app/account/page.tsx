import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/site-url'
import AccountHub from '@/components/AccountHub'

export const metadata: Metadata = {
  title: 'Account settings',
  description: 'Your Savry community account and the recipes you share.',
  alternates: { canonical: `${SITE_URL}/account` },
  robots: { index: false, follow: false },
}

export default function AccountPage() {
  return (
    <main className="account-page site-shell">
      <header>
        <span className="eyebrow">Your community account</span>
        <h1>Your Savry settings.</h1>
        <p>Your name and username, the recipes you share, social links, email, membership, and your account. The same account signs you in to the Savry app.</p>
      </header>
      <AccountHub />
    </main>
  )
}
