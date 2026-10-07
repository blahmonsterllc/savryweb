import { ImageResponse } from 'next/og'
import { getPublicRecipeBySlug } from '@/lib/community-recipes'

/**
 * The share card for a recipe: what shows when a link is pasted into
 * Messages, Instagram, Slack or X, and what "Share as image" sends. Built
 * from the public recipe only; a missing recipe gets a plain Savry card.
 */
// A plain route rather than Next's opengraph-image file, which is always sent
// "immutable" for a year. Here the CDN keeps a card for an hour, and the page
// links it with the recipe's version (?v=), so an edited recipe gets a new card.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const size = { width: 1200, height: 630 }

const INK = '#101d2f'
const PAPER = '#f7f2e8'
const CORAL = '#f06449'
const SAFFRON = '#efb63f'

async function serif(): Promise<ArrayBuffer | null> {
  try {
    // No browser user agent: Google Fonts then answers with a TTF, which the renderer can read (it cannot read WOFF2).
    const css = await fetch('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500&display=swap', {
      headers: { 'User-Agent': 'Savry share card' },
      next: { revalidate: 86_400 },
    }).then((r) => r.text())
    const url = /src: url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/.exec(css)?.[1]
    if (!url) return null
    return await fetch(url, { next: { revalidate: 86_400 } }).then((r) => r.arrayBuffer())
  } catch {
    return null
  }
}

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const [recipe, font] = await Promise.all([getPublicRecipeBySlug(params.slug).catch(() => null), serif()])
  const fonts = font ? [{ name: 'Serif', data: font, style: 'normal' as const, weight: 500 as const }] : []
  const titleFont = font ? 'Serif' : 'serif'

  const title = recipe?.title ?? 'Recipes worth keeping'
  const meta = recipe
    ? [recipe.authorName ? `by ${recipe.authorName}` : null, recipe.totalTime ? `${recipe.totalTime} min` : null, recipe.madeCount ? `${recipe.madeCount} made it` : null].filter(Boolean).join('  ·  ')
    : 'Share a recipe. Follow a cook. Post what you made.'
  const image = recipe?.imageUrl ?? null

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: PAPER, color: INK, fontFamily: 'sans-serif' }}>
        {image && (
          <div style={{ display: 'flex', width: 560, height: '100%', position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" width={560} height={630} style={{ objectFit: 'cover', width: 560, height: 630 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(247,242,232,0) 70%, rgba(247,242,232,1) 100%)' }} />
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, padding: '56px 64px 52px 48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', width: 46, height: 46, borderRadius: 12, background: INK, color: PAPER, alignItems: 'center', justifyContent: 'center', fontFamily: titleFont, fontSize: 30, fontWeight: 500 }}>S</div>
            <div style={{ fontFamily: titleFont, fontSize: 34, fontWeight: 500, letterSpacing: -1 }}>Savry</div>
            {recipe?.editorsPick && <div style={{ marginLeft: 12, background: SAFFRON, borderRadius: 999, padding: '6px 14px', fontSize: 18, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Editor’s pick</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontFamily: titleFont, fontSize: title.length > 48 ? 54 : 66, fontWeight: 500, lineHeight: 1.05, letterSpacing: -2, display: 'flex' }}>{title}</div>
            <div style={{ fontSize: 26, color: '#596475', display: 'flex' }}>{meta}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 14, height: 14, borderRadius: 999, background: CORAL }} />
            <div style={{ fontSize: 22, color: '#596475' }}>savry.io · recipes worth keeping</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts, headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' } },
  )
}
