'use client'

import { Check, Copy, Share2 } from 'lucide-react'
import { useState } from 'react'

/**
 * Share a recipe to the networks cooks actually use. Every link is a plain
 * intent URL, so nothing loads third-party scripts. The page's Open Graph
 * card (title, photo, description) is what these networks render.
 */
export default function RecipeShareBar({ title, url, imageUrl }: { title: string; url: string; imageUrl?: string | null }) {
  const [copied, setCopied] = useState(false)
  const text = `${title} on Savry`
  const e = encodeURIComponent

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      return
    }
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

  const networks = [
    { name: 'Threads', href: `https://www.threads.net/intent/post?text=${e(`${text} ${url}`)}` },
    { name: 'X', href: `https://twitter.com/intent/tweet?text=${e(text)}&url=${e(url)}` },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}` },
    { name: 'Pinterest', href: `https://www.pinterest.com/pin/create/button/?url=${e(url)}&description=${e(title)}${imageUrl ? `&media=${e(imageUrl)}` : ''}` },
    { name: 'WhatsApp', href: `https://wa.me/?text=${e(`${text} ${url}`)}` },
    { name: 'Reddit', href: `https://www.reddit.com/submit?url=${e(url)}&title=${e(title)}` },
  ]

  return (
    <div className="recipe-share" aria-label="Share this recipe">
      <button type="button" onClick={share}><Share2 size={17} /> Share recipe</button>
      <button type="button" onClick={copyLink}>{copied ? <Check size={17} /> : <Copy size={17} />} {copied ? 'Copied' : 'Copy link'}</button>
      {networks.map((n) => (
        <a key={n.name} href={n.href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${n.name}`}>
          {n.name} <span aria-hidden="true">↗</span>
        </a>
      ))}
      <p className="recipe-share__hint">Instagram and TikTok don’t take links from the web. Copy the link and post it with your photo, or share straight from the Savry app.</p>
    </div>
  )
}
