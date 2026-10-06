/**
 * Deletes the caller's Savry account and every photo they uploaded.
 *
 * POST /api/account/delete
 *   Authorization: Bearer <Supabase access token of the signed-in cook>
 *
 * Photos (recipe photos, Made It photos, avatars) all live in the cook's own
 * folder of the recipe-images bucket; the upload policy allows no other place.
 * The folder is listed first, then the account is deleted as the member
 * (delete_my_account, which cascades every row), then the folder's files are
 * removed with the service role. Nothing outside the caller's folder is ever
 * touched. If the photos cannot be listed the account is left as it is, so the
 * cook can try again rather than leave photos behind.
 *
 * → 200 { deleted: true, photosRemoved }
 *   401 not signed in · 500 nothing was deleted
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { listOwnPhotos, memberClient, refreshRecipePages, removeOwnPhotos, requireMember } from '@/lib/member-api'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const member = await requireMember(req, res)
  if (!member) return
  const userId = member.user.id

  let photos: string[]
  try {
    photos = await listOwnPhotos(userId)
  } catch (error) {
    console.error('account delete:', (error as Error).message)
    return res.status(500).json({ error: 'Could not delete the account. Please try again.' })
  }

  // What the cached pages showed of this cook, read before the rows go.
  const supabase = getSupabaseAdmin()
  const [{ data: profile }, { data: recipes }] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', userId).maybeSingle(),
    supabase.from('recipes').select('slug').eq('author_id', userId).eq('visibility', 'public').limit(100),
  ])

  const { error } = await memberClient(member.token).rpc('delete_my_account')
  if (error) return res.status(400).json({ error: error.message })

  const photosRemoved = await removeOwnPhotos(userId, photos)
  if (photosRemoved < photos.length) console.error(`account delete: ${photos.length - photosRemoved} photos could not be removed`)

  const username = (profile as { username?: string | null } | null)?.username ?? null
  await refreshRecipePages(res, { username })
  await Promise.all(((recipes ?? []) as { slug: string }[]).map((r) => res.revalidate(`/recipes/${r.slug}`).catch(() => undefined)))
  return res.status(200).json({ deleted: true, photosRemoved })
}
