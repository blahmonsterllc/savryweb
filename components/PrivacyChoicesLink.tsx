'use client'

import type { MouseEvent } from 'react'
import { adsConfigured, openPrivacyChoices } from '@/lib/ads'

/** Persistent footer control that re-opens the advertising consent dialog. */
export default function PrivacyChoicesLink() {
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!adsConfigured) return
    event.preventDefault()
    openPrivacyChoices()
  }

  return (
    <a href="/privacy#advertising-choices" onClick={onClick}>Privacy choices</a>
  )
}
