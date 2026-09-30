import { ImageResponse } from 'next/og'
import { getPublicRecipeBySlug } from '@/lib/community-recipes'

/**
 * Link card for a recipe page. Rendered on demand so every recipe, with or
 * without a photo, gets a proper preview on Threads, X, Facebook, iMessage,
 * WhatsApp, and Slack. Cached by the CDN.
 */
export const runtime = 'nodejs'
export const alt = 'Savry recipe'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 3600

export default async function RecipeOpenGraphImage({ params }: { params: { slug: string } }) {
  const recipe = await getPublicRecipeBySlug(params.slug).catch(() => null)
  const title = recipe?.title ?? 'A recipe on Savry'
  const meta = recipe
    ? [recipe.totalTime ? `${recipe.totalTime} min` : null, recipe.servingType === 'yields' ? `Makes ${recipe.servings} ${recipe.yieldUnit ?? ''}`.trim() : `Serves ${recipe.servings}`, recipe.cuisine, recipe.difficulty]
        .filter(Boolean)
        .join('  ·  ')
    : ''
  const author = recipe?.authorName ?? 'Savry Kitchen'
  const made = recipe?.madeCount ? `${recipe.madeCount} cook${recipe.madeCount === 1 ? '' : 's'} made this` : 'Shared on Savry'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #14b8a6 0%, #0e7490 100%)',
          color: '#ffffff',
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}
      >
        {recipe?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.imageUrl} alt="" width={540} height={630} style={{ objectFit: 'cover', width: 540, height: 630 }} />
        ) : (
          <div style={{ width: 540, height: 630, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 220 }}>🍽️</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 56px 48px', width: 660 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 22, letterSpacing: 4, textTransform: 'uppercase', opacity: 0.85 }}>Savry · community recipe</div>
            <div style={{ fontSize: title.length > 48 ? 48 : 60, fontWeight: 700, lineHeight: 1.1, marginTop: 24 }}>{title}</div>
            {meta && <div style={{ fontSize: 26, marginTop: 24, opacity: 0.92 }}>{meta}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ opacity: 0.8, fontSize: 20 }}>by</span>
              <span style={{ fontWeight: 700 }}>{author}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 999, padding: '10px 22px' }}>{made}</div>
          </div>
        </div>
      </div>
    ),
    size
  )
}
