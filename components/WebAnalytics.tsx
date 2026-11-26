'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'

/**
 * Cloudflare Web Analytics: cookie-free visit counts for public pages (page,
 * referrer, country, browser). Off until NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN
 * is set; never loaded on admin pages. The token is public by design.
 */
export default function WebAnalytics({ token }: { token: string | null }) {
  const pathname = usePathname() ?? ''
  if (!token || pathname === '/admin' || pathname.startsWith('/admin/')) return null
  return <Script src="https://static.cloudflareinsights.com/beacon.min.js" strategy="afterInteractive" data-cf-beacon={JSON.stringify({ token })} />
}
