import type { Metadata } from 'next'
import HomeExperience from '@/components/HomeExperience'
import { SITE_URL } from '@/lib/site-url'

// Each page declares its own canonical; the home page was the one still missing it.
export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
  openGraph: { url: SITE_URL },
}

export default function Home() {
  return <HomeExperience />
}
