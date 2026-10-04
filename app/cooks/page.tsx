import type { Metadata } from 'next'
import Link from 'next/link'
import FollowButton from '@/components/FollowButton'
import { getSupabasePublic } from '@/lib/supabase/public'
import { SITE_URL } from '@/lib/site-url'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Cooks on Savry',
  description: 'The people behind the recipes on Savry. Follow a few and your table fills up.',
  alternates: { canonical: `${SITE_URL}/cooks` },
}

type Cook = { id: string; username: string | null; displayName: string; chefTitle: string | null; avatarUrl: string | null; followerCount: number; recipeCount: number; madeCount: number; bio: string | null; isFeatured: boolean }

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'S'
}

export default async function CooksPage() {
  let cooks: Cook[] = []
  try {
    const { data } = await getSupabasePublic().rpc('cook_directory', { result_limit: 60, result_offset: 0 })
    cooks = ((data as { cooks?: Cook[] } | null)?.cooks ?? []).filter((c) => c.username)
  } catch {
    cooks = []
  }

  return (
    <main className="cook-page cooks-directory site-shell">
      <header className="cooks-directory__header">
        <span className="eyebrow">The people at the table</span>
        <h1>Cooks on Savry.</h1>
        <p>Everyone here has put at least one recipe on the shared table. Follow a few and <Link href="/feed">your table</Link> fills with what they cook.</p>
      </header>
      {cooks.length ? (
        <ul className="cooks-directory__grid">
          {cooks.map((cook) => (
            <li key={cook.id} className={`cook-tile ${cook.isFeatured ? 'cook-tile--featured' : ''}`}>
              <Link href={`/cooks/${cook.username}`} className="cook-tile__identity">
                {cook.avatarUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={cook.avatarUrl} alt="" width={56} height={56} loading="lazy" />
                  : <span className="cook-tile__initials" aria-hidden="true">{initials(cook.displayName)}</span>}
                <span>
                  <strong>{cook.displayName}</strong>
                  <small>{cook.chefTitle ?? `@${cook.username}`}</small>
                </span>
              </Link>
              {cook.bio && <p className="cook-tile__bio">{cook.bio}</p>}
              <p className="cook-tile__stats">{[`${cook.recipeCount} recipe${cook.recipeCount === 1 ? '' : 's'}`, cook.madeCount ? `cooked ${cook.madeCount} time${cook.madeCount === 1 ? '' : 's'} by others` : null, cook.followerCount ? `${cook.followerCount} follower${cook.followerCount === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}</p>
              <FollowButton username={cook.username!} compact />
            </li>
          ))}
        </ul>
      ) : (
        <p className="cook-page__empty">No cooks to show yet.</p>
      )}
    </main>
  )
}
