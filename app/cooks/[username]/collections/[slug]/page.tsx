import type { Metadata } from 'next'
import CollectionView, { type CollectionDetail } from '@/components/CollectionView'
import OwnCollection from '@/components/OwnCollection'
import { getSupabasePublic } from '@/lib/supabase/public'
import { SITE_URL } from '@/lib/site-url'

export const revalidate = 120

async function load(username: string, slug: string): Promise<CollectionDetail | null> {
  const { data, error } = await getSupabasePublic().rpc('collection_detail', { target_username: username, target_slug: slug })
  if (error) throw error
  return (data as CollectionDetail | null) ?? null
}

export async function generateMetadata({ params }: { params: { username: string; slug: string } }): Promise<Metadata> {
  const detail = await load(params.username, params.slug).catch(() => null)
  if (!detail) return { title: 'Collection', robots: { index: false } }
  const title = `${detail.title} by ${detail.owner.displayName}`
  const description = detail.description ?? `${detail.itemCount} recipes collected by ${detail.owner.displayName} on Savry.`
  const url = `${SITE_URL}/cooks/${params.username}/collections/${detail.slug}`
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, images: detail.recipes[0]?.imageUrl ? [{ url: detail.recipes[0].imageUrl }] : undefined } }
}

export default async function CollectionPage({ params }: { params: { username: string; slug: string } }) {
  // A database error throws, so the last good cached page stays up.
  const detail = await load(params.username, params.slug)
  // The cached render is anonymous, so a private collection is not found here.
  // Its owner gets it in the browser, fetched with their own session.
  if (!detail) return <OwnCollection username={params.username} slug={params.slug} />
  return <CollectionView detail={detail} username={params.username} />
}
