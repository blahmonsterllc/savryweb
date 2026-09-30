'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const adsConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID)

export default function AdConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!adsConfigured) return
    setVisible(!window.localStorage.getItem('savry_ad_consent'))
  }, [])

  function choose(value: 'granted' | 'declined') {
    window.localStorage.setItem('savry_ad_consent', value)
    window.dispatchEvent(new Event('savry-ad-consent-changed'))
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
