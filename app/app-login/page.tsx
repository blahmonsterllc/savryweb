import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SITE_URL } from '@/lib/site-url'
import LoginForm from './LoginForm'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Create a Savry account or sign in to publish recipes and join the community.',
  alternates: { canonical: `${SITE_URL}/app-login` },
  robots: { index: false, follow: false },
}

export default function AppLoginPage() {
  return (
    <main className="community-login site-shell">
      <div className="community-login__intro">
        <span className="eyebrow">Join the community</span>
        <h1>Your place at the shared table.</h1>
        <p>One Savry account for the community website and the Savry app.</p>
      </div>
      <Suspense fallback={<div className="community-login__card">Opening sign in…</div>}><LoginForm /></Suspense>
    </main>
  )
}
