'use client'

import Script from 'next/script'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AD_CONSENT_EVENT, ADSENSE_CLIENT_ID, detectGoogleCmp, readLocalAdConsent } from '@/lib/ads'
import { isViewerMember } from '@/lib/viewer-membership-client'

export type AdPlacement = 'home' | 'feed' | 'recipe'

const clientId = ADSENSE_CLIENT_ID
const slots: Record<AdPlacement, string | undefined> = {
  home: process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_HOME_SLOT,
  feed: process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_FEED_SLOT,
  recipe: process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_RECIPE_SLOT,
}

type Props = {
  placement: AdPlacement
  /** Render nothing (e.g. the server wrapper already knows the viewer is a member). */
  hidden?: boolean
  /** Check membership in the browser; use from client components that have no server parent to ask. */
  checkMembership?: boolean
}

export default function AdSlotClient({ placement, hidden = false, checkMembership = false }: Props) {
  const slot = slots[placement]
  const enabled = Boolean(clientId && slot)
  // Consent is granted through Google's CMP when present (savry_ad_consent is the house fallback).
  const [consent, setConsent] = useState(false)
  const [ready, setReady] = useState(false)
  const [membership, setMembership] = useState<'unknown' | 'member' | 'guest'>(checkMembership ? 'unknown' : 'guest')
  const adKey = useMemo(() => `${placement}-${slot ?? 'partner'}`, [placement, slot])

  useEffect(() => {
    if (!checkMembership) return
    let cancelled = false
    isViewerMember().then((member) => {
      if (!cancelled) setMembership(member ? 'member' : 'guest')
    })
    return () => {
      cancelled = true
    }
  }, [checkMembership])

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      if (!cancelled) setConsent(readLocalAdConsent() === 'granted')
    }
    detectGoogleCmp().then((cmpPresent) => {
      if (cancelled) return
      if (cmpPresent) setConsent(true)
      else refresh()
    })
    window.addEventListener(AD_CONSENT_EVENT, refresh)
    return () => {
      cancelled = true
      window.removeEventListener(AD_CONSENT_EVENT, refresh)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !consent || !ready) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (error) {
      console.warn('Advertisement could not be initialized', error)
    }
  }, [adKey, consent, enabled, ready])

  if (hidden || membership !== 'guest') return null

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
