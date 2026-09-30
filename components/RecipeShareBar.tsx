'use client'

import { Check, Copy, Share2 } from 'lucide-react'
import { useState } from 'react'

export default function RecipeShareBar({ title, url, imageUrl }: { title: string; url: string; imageUrl?: string | null }) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({ title, text: `Cook ${title} with me on Savry.`, url }).catch(() => undefined)
      return
    }
    await copyLink()
  }

  const pinterest = `https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&description=${encodeURIComponent(title)}${imageUrl ? `&media=${encodeURIComponent(imageUrl)}` : ''}`

  return (
    <div className="recipe-share" aria-label="Share this recipe">
      <button type="button" onClick={share}><Share2 size={17} /> Share recipe</button>
      <button type="button" onClick={copyLink}>{copied ? <Check size={17} /> : <Copy size={17} />} {copied ? 'Copied' : 'Copy link'}</button>
      <a href={pinterest} target="_blank" rel="noopener noreferrer">Save to Pinterest <span aria-hidden="true">↗</span></a>
    </div>
  )
}
