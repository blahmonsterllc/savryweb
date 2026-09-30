'use client'

import { Check, Link2, Share2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * One quiet "Share" button. On phones it opens the system share sheet; on
 * desktop it opens a small menu with the networks cooks actually use plus
 * "Copy link". Every entry is a plain intent URL, so no third-party scripts.
 * The page's Open Graph card is what the networks render.
 */
export default function RecipeShareBar({ title, url, imageUrl, label = 'Share' }: { title: string; url: string; imageUrl?: string | null; label?: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const text = `${title} on Savry`
  const e = encodeURIComponent

  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => {
        setCopied(false)
        setOpen(false)
      }, 1200)
    } catch {
      setOpen(false)
    }
  }

  async function share() {
    // Phones and tablets get the system sheet, which already knows Messages, Instagram, TikTok, and the rest.
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title, text: `Cook ${title} with me on Savry.`, url }).catch(() => undefined)
      return
    }
    setOpen((value) => !value)
  }

  const networks = [
    { name: 'Threads', href: `https://www.threads.net/intent/post?text=${e(`${text} ${url}`)}` },
    { name: 'X', href: `https://twitter.com/intent/tweet?text=${e(text)}&url=${e(url)}` },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}` },
    { name: 'Pinterest', href: `https://www.pinterest.com/pin/create/button/?url=${e(url)}&description=${e(title)}${imageUrl ? `&media=${e(imageUrl)}` : ''}` },
    { name: 'WhatsApp', href: `https://wa.me/?text=${e(`${text} ${url}`)}` },
    { name: 'Reddit', href: `https://www.reddit.com/submit?url=${e(url)}&title=${e(title)}` },
    { name: 'Email', href: `mailto:?subject=${e(text)}&body=${e(`${title}\n${url}`)}` },
  ]

  return (
    <div className="share" ref={root}>
      <button type="button" className="share__button" onClick={share} aria-haspopup="menu" aria-expanded={open}>
        <Share2 size={16} /> {label}
      </button>
      {open && (
        <div className="share__menu" role="menu" aria-label="Share options">
          <button type="button" role="menuitem" onClick={copyLink}>
            {copied ? <Check size={15} /> : <Link2 size={15} />} {copied ? 'Link copied' : 'Copy link'}
          </button>
          {networks.map((n) => (
            <a key={n.name} role="menuitem" href={n.href} target={n.name === 'Email' ? undefined : '_blank'} rel="noopener noreferrer" onClick={() => setOpen(false)}>
              {n.name}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
