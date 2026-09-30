'use client'

import { useState } from 'react'

interface Props {
  /** foodprep://import?url=... */
  deepLink: string
  appStoreUrl: string
}

/**
 * Tries the app's custom URL scheme. If the page is still visible a moment
 * later the app isn't installed, so we fall back to the App Store.
 */
export default function OpenInSavryButton({ deepLink, appStoreUrl }: Props) {
  const [tried, setTried] = useState(false)

  function open() {
    setTried(true)
    const start = Date.now()
    window.location.href = deepLink
    setTimeout(() => {
      if (!document.hidden && Date.now() - start < 2500) {
        window.location.href = appStoreUrl
      }
    }, 1600)
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-secondary-600 px-5 py-3 font-semibold text-white shadow-md transition hover:opacity-95"
      >
        <span aria-hidden>📲</span> Open in Savry
      </button>
      <p className="text-xs text-gray-500">
        {tried ? 'Didn’t open? ' : 'Saves this recipe to your Savry library. '}
        <a href={appStoreUrl} className="underline hover:text-primary-700">Get the app</a>
      </p>
    </div>
  )
}
