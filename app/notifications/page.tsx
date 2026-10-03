import type { Metadata } from 'next'
import NotificationsInbox from '@/components/NotificationsInbox'

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'What is happening with your recipes on Savry.',
  robots: { index: false, follow: false },
}

export default function NotificationsPage() {
  return <NotificationsInbox />
}
