import 'server-only'

import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { getSupabaseAdmin } from './supabase/admin'
import { requireSupabasePublishableKey, requireSupabaseURL } from './supabase/config'
import { ownPhotoPaths, recipePagePaths } from './member-cleanup.mjs'

const BUCKET = 'recipe-images'

/**
 * The signed-in member behind `Authorization: Bearer <Supabase access token>`,
 * verified with Supabase Auth (never just decoded). Answers 401 and returns
 * null when there is no valid session.
 */
export async function requireMember(req: NextApiRequest, res: NextApiResponse): Promise<{ user: User; token: string } | null> {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) {
    res.status(401).json({ error: 'Sign in first' })
    return null
  }
  const { data, error } = await getSupabaseAdmin().auth.getUser(token)
  if (error || !data.user) {
    res.status(401).json({ error: 'Sign in first' })
    return null
  }
  return { user: data.user, token }
}

/**
 * A client that acts as the member, so database functions see them as
 * auth.uid() and apply their own checks exactly as they do for the browser.
 */
export function memberClient(token: string): SupabaseClient {
  return createClient(requireSupabaseURL(), requireSupabasePublishableKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

/** Every object in the member's own folder of the bucket, subfolders included. */
export async function listOwnPhotos(userId: string): Promise<string[]> {
  const storage = getSupabaseAdmin().storage.from(BUCKET)
  const found: string[] = []
  const folders = [userId]
  while (folders.length) {
    const folder = folders.shift() as string
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await storage.list(folder, { limit: 1000, offset })
      if (error) throw new Error(`Could not list photos: ${error.message}`)
      for (const entry of data ?? []) {
        // Folders come back without an id.
        if (entry.id === null) folders.push(`${folder}/${entry.name}`)
        else found.push(`${folder}/${entry.name}`)
      }
      if (!data || data.length < 1000) break
    }
  }
  return ownPhotoPaths(userId, found)
}

/** Removes photos, but only ones inside the member's own folder. Best effort; returns how many went. */
export async function removeOwnPhotos(userId: string, paths: Iterable<unknown>): Promise<number> {
  const own = ownPhotoPaths(userId, paths)
  let removed = 0
  for (let i = 0; i < own.length; i += 100) {
    const chunk = own.slice(i, i + 100)
    const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).remove(chunk)
    if (error) console.error('photo cleanup: could not remove photos', error.message)
    else removed += data?.length ?? 0
  }
  return removed
}

/** Refreshes the cached pages that show a recipe, so a change shows at once rather than in five minutes. */
export async function refreshRecipePages(res: NextApiResponse, recipe: { slug?: string | null; username?: string | null }, options: { lists?: boolean } = {}) {
  await Promise.all(recipePagePaths(recipe, options).map((path) => res.revalidate(path).catch(() => undefined)))
}
