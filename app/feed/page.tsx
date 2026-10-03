import type { Metadata } from 'next'
import HomeFeed from '@/components/HomeFeed'

// Personal to the viewer; never indexed.
export const metadata: Metadata = {
  title: 'Your table',
  description: 'What the cooks you follow are making on Savry.',
  robots: { index: false, follow: false },
}

export default function FeedPage() {
  return <HomeFeed />
}
