'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AD_CONSENT_EVENT, adsConfigured, detectGoogleCmp, googleCmpLoaded, readLocalAdConsent, writeLocalAdConsent } from '@/lib/ads'

/**
 * House consent banner. When Google's certified CMP (Privacy & messaging) is
 * loaded from the layout it owns EEA/UK consent and this banner stays hidden;
 * it only appears as a fallback when that script is unavailable.
 */
export default function AdConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!adsConfigured) return
    let cancelled = false
    const refresh = () => {
      if (cancelled || googleCmpLoaded()) return
      setVisible(!readLocalAdConsent())
    }
    detectGoogleCmp().then((cmpPresent) => {
      if (!cmpPresent) refresh()
    })
    window.addEventListener(AD_CONSENT_EVENT, refresh)
    return () => {
      cancelled = true
      window.removeEventListener(AD_CONSENT_EVENT, refresh)
    }
  }, [])

  function choose(value: 'granted' | 'declined') {
    writeLocalAdConsent(value)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside className="ad-consent" aria-label="Advertising privacy choices">
      <div>
        <strong>Your recipes stay yours.</strong>
        <p>Savry can use advertising cookies to show and measure clearly labeled ads. Community and recipe features work either way. <Link href="/privacy">Learn more</Link></p>
      </div>
      <div className="ad-consent__actions">
        <button type="button" onClick={() => choose('declined')}>No advertising cookies</button>
        <button type="button" className="ad-consent__accept" onClick={() => choose('granted')}>Allow ads</button>
      </div>
    </aside>
  )
}
