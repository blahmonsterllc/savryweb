import type { Metadata } from 'next'
import WelcomeFlow from '@/components/WelcomeFlow'

export const metadata: Metadata = {
  title: 'Set your table',
  description: 'Tell Savry what you like to cook, follow a few cooks, and save your first recipes.',
  robots: { index: false, follow: false },
}

export default function WelcomePage() {
  return <WelcomeFlow />
}
