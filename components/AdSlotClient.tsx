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

/** What the window shows when no ad is running: an invitation, in Savry's own voice. */
const HOUSE: Record<AdPlacement, { eyebrow: string; title: string; text: string; action: string; href: string }> = {
  home: { eyebrow: 'A living cookbook', title: 'Good recipes get passed around.', text: 'Browse what the community is cooking this week.', action: 'Explore recipes', href: '/recipes' },
  feed: { eyebrow: 'Your turn', title: 'Bring the recipe people ask you for.', text: 'Share it once. Keep the credit. Let other cooks make it better.', action: 'Add your recipe', href: '/recipes/new' },
  recipe: { eyebrow: 'Made together', title: 'Cooked this? Tell the next cook how it went.', text: 'A free Savry account lets you save recipes, post a photo of what you made, and suggest improvements.', action: 'Join the community', href: '/app-login?returnTo=/account' },
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

  const live = enabled && consent
  const house = HOUSE[placement]

  // One framed window per placement. It holds a real ad when ads are switched
  // on and the reader has agreed to them; otherwise a quiet note from Savry.
  // The frame and its reserved height are the same either way, so the page
  // never jumps and an ad never sits loose among the recipes.
  return (
    <aside className={`ad-window ad-window--${placement}`} aria-label={live ? 'Advertisement' : 'From Savry'}>
      <div className="ad-window__bar">
        <span>{live ? 'Sponsored' : 'From Savry'}</span>
        {live ? <Link href="/savry-plus">Go ad-free with Savry+</Link> : <Link href="/advertise">Advertise with Savry</Link>}
      </div>
      <div className="ad-window__pane">
        {live ? (
          <>
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
              style={{ display: 'block', width: '100%' }}
              data-ad-client={clientId}
              data-ad-slot={slot}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          </>
        ) : (
          <div className="house-ad">
            <span className="house-ad__eyebrow">{house.eyebrow}</span>
            <h3>{house.title}</h3>
            <p>{house.text}</p>
            <Link href={house.href}>{house.action}</Link>
          </div>
        )}
      </div>
    </aside>
  )
}
