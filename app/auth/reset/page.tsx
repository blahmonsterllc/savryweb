import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/site-url'
import ResetPasswordForm from './ResetPasswordForm'

export const metadata: Metadata = {
  title: 'Choose a new password',
  description: 'Set a new password for your Savry account.',
  alternates: { canonical: `${SITE_URL}/auth/reset` },
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
  return (
    <main className="community-login site-shell">
      <div className="community-login__intro">
        <span className="eyebrow">Password reset</span>
        <h1>Choose a new password.</h1>
        <p>Pick something with at least 8 characters. You will stay signed in on this device once it is saved.</p>
      </div>
      <ResetPasswordForm />
    </main>
  )
}
