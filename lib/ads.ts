/**
 * Client-safe advertising configuration shared by the layout, the consent UI,
 * the ad slots, and the ads.txt route. No secrets live here.
 */
export const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID || ''

/** AdSense publisher id without the `ca-` prefix (used by ads.txt and the CMP script). */
export const ADSENSE_PUBLISHER_ID = ADSENSE_CLIENT_ID.replace(/^ca-/, '')

export const adsConfigured = Boolean(ADSENSE_CLIENT_ID)

export const AD_CONSENT_KEY = 'savry_ad_consent'
export const AD_CONSENT_EVENT = 'savry-ad-consent-changed'

export const GOOGLE_CMP_SCRIPT_URL = ADSENSE_PUBLISHER_ID
  ? `https://fundingchoicesmessages.google.com/i/${ADSENSE_PUBLISHER_ID}?ers=1`
  : ''

/** Standard Google "Privacy & messaging" presence signal. */
export const GOOGLE_FC_PRESENT_SNIPPET =
  "(function(){function signalGooglefcPresent(){if(!window.frames['googlefcPresent']){if(document.body){var iframe=document.createElement('iframe');iframe.style='width: 0; height: 0; border: none; z-index: -1000; left: -1000px; top: -1000px;';iframe.style.display='none';iframe.name='googlefcPresent';document.body.appendChild(iframe);}else{setTimeout(signalGooglefcPresent,0);}}}signalGooglefcPresent();})();"

type GoogleFundingChoices = {
  callbackQueue: Array<Record<string, () => void>>
  showRevocationMessage?: () => void
}

declare global {
  interface Window {
    googlefc?: GoogleFundingChoices
    adsbygoogle?: unknown[]
  }
}

export type AdConsentValue = 'granted' | 'declined'

/** True once Google's certified CMP script has loaded on this page. */
export function googleCmpLoaded(): boolean {
  return typeof window !== 'undefined' && typeof window.googlefc?.showRevocationMessage === 'function'
}

let cmpProbe: Promise<boolean> | undefined

/**
 * Resolves true when Google's CMP is present, false when it never appears
 * (script not configured, blocked, or failed) so the house banner can take over.
 */
export function detectGoogleCmp(timeoutMs = 4000): Promise<boolean> {
  if (typeof window === 'undefined' || !adsConfigured) return Promise.resolve(false)
  cmpProbe ??= new Promise((resolve) => {
    const startedAt = Date.now()
    const tick = () => {
      if (googleCmpLoaded()) return resolve(true)
      if (Date.now() - startedAt > timeoutMs) return resolve(false)
      window.setTimeout(tick, 200)
    }
    tick()
  })
  return cmpProbe
}

export function readLocalAdConsent(): AdConsentValue | null {
  try {
    const value = window.localStorage.getItem(AD_CONSENT_KEY)
    return value === 'granted' || value === 'declined' ? value : null
  } catch {
    return null
  }
}

export function writeLocalAdConsent(value: AdConsentValue | null) {
  try {
    if (value) window.localStorage.setItem(AD_CONSENT_KEY, value)
    else window.localStorage.removeItem(AD_CONSENT_KEY)
  } catch {
    // Storage can be unavailable (private mode); the banner simply shows again.
  }
  window.dispatchEvent(new Event(AD_CONSENT_EVENT))
}

/**
 * Re-opens the consent dialog. Uses Google's revocation message when the CMP
 * is present, otherwise clears the house flag so the fallback banner returns.
 * Returns false when advertising is not configured at all.
 */
export function openPrivacyChoices(): boolean {
  if (!adsConfigured || typeof window === 'undefined') return false
  const googlefc = window.googlefc
  if (googlefc && typeof googlefc.showRevocationMessage === 'function') {
    googlefc.callbackQueue = googlefc.callbackQueue || []
    googlefc.callbackQueue.push({ CONSENT_DATA_READY: () => googlefc.showRevocationMessage?.() })
    return true
  }
  writeLocalAdConsent(null)
  return true
}
