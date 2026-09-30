'use client'

import Script from 'next/script'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Placement = 'home' | 'feed' | 'recipe'

const clientId = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID
const slots: Record<Placement, string | undefined> = {
  home: process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_HOME_SLOT,
  feed: process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_FEED_SLOT,
  recipe: process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_RECIPE_SLOT,
}

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

export default function AdSlot({ placement }: { placement: Placement }) {
  const slot = slots[placement]
  const enabled = Boolean(clientId && slot)
  const [consent, setConsent] = useState(false)
  const [ready, setReady] = useState(false)
  const adKey = useMemo(() => `${placement}-${slot ?? 'partner'}`, [placement, slot])

  useEffect(() => {
    const refresh = () => setConsent(window.localStorage.getItem('savry_ad_consent') === 'granted')
    refresh()
    window.addEventListener('savry-ad-consent-changed', refresh)
    return () => window.removeEventListener('savry-ad-consent-changed', refresh)
  }, [])

  useEffect(() => {
    if (!enabled || !consent || !ready) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (error) {
      console.warn('Advertisement could not be initialized', error)
    }
  }, [adKey, consent, enabled, ready])

  if (!enabled || !consent) {
    return (
      <aside className={`partner-slot partner-slot--${placement}`} aria-label="Savry partnership opportunity">
        <span className="partner-slot__label">Partnership</span>
        <p><strong>A considered place for a good kitchen brand.</strong> Savry offers a small number of clearly labeled sponsorships.</p>
        <Link href="/advertise">Partner with Savry</Link>
      </aside>
    )
  }

  return (
    <aside className={`ad-slot ad-slot--${placement}`} aria-label="Advertisement">
      <span className="ad-slot__label">Advertisement</span>
      <Script
        id="savry-adsense"
        async
        strategy="afterInteractive"
        crossOrigin="anonymous"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
        onReady={() => setReady(true)}
      />
      <ins
        key={adKey}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={clientId}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  )
}
