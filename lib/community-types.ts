/**
 * Community layer on top of published recipes: Made Its, comments, and
 * structured tweaks that the recipe's author can accept into a new version.
 *
 * Firestore:
 *   community_recipes/{id}                       (see community-recipes.ts)
 *     .madeCount, .commentCount, .version
 *   community_recipes/{id}/contributions/{cid}   Contribution (below)
 *   community_recipes/{id}/versions/{n}          snapshot of `recipe` before an accepted tweak
 *
 * The same shapes are mirrored in the iOS app (SavryCommunityService.swift).
 *
 * This file is client-safe (no Firebase). Server helpers live in community.ts.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Structured changes
// ---------------------------------------------------------------------------

export const CHANGE_KINDS = [
  'ingredient.replace', // index, from, to ("1 cup oat milk")
  'ingredient.amount', // index, from, to ("1/2 cup")
  'ingredient.add', // to ("1 tsp smoked paprika")
  'ingredient.remove', // index, from
  'step.edit', // index, from, to (new step text)
  'step.add', // index (insert after this step; -1 = at start), to
  'step.remove', // index, from
  'time', // to ("prep 10, cook 25")
  'servings', // to ("6")
  'other', // note only
] as const
export type ChangeKind = (typeof CHANGE_KINDS)[number]

export const changeSchema = z.object({
  kind: z.enum(CHANGE_KINDS),
  index: z.number().int().min(-1).max(200).optional(),
  from: z.string().max(500).optional(),
  to: z.string().max(2000).optional(),
  note: z.string().max(500).optional(),
})
export type RecipeChange = z.infer<typeof changeSchema>

export const contributionInputSchema = z.object({
  text: z.string().trim().max(2000).optional(),
  /** base64 JPEG of the finished dish. Required for a web Made It. */
  photoBase64: z.string().max(1_200_000).optional(),
  madeIt: z.boolean().default(false),
  source: z.enum(['app', 'web']).default('web'),
  /** How the app knows they cooked it. Ignored for web. */
  proof: z.enum(['cooking_mode', 'mark_made']).optional(),
  changes: z.array(changeSchema).max(20).optional(),
  /** "I made it with this tweak" */
  tweakId: z.string().max(64).optional(),
})
export type ContributionInput = z.infer<typeof contributionInputSchema>

export type ContributionType = 'made' | 'comment' | 'tweak'
export type TweakStatus = 'pending' | 'accepted' | 'declined'

export interface Contribution {
  id: string
  type: ContributionType
  userId: string
  userName: string
  text: string | null
  photoUrl: string | null
  madeIt: boolean
  source: 'app' | 'web'
  proof: string | null
  changes: RecipeChange[]
  /** Food-safety cautions raised by the server screen. Shown as a warning label. */
  safetyFlags: string[]
  tweakId: string | null
  status: TweakStatus | null
  madeCount: number
  acceptedInVersion: number | null
  createdAt: string
}

export function summarizeChange(c: RecipeChange): string {
  const arrow = ' → '
  switch (c.kind) {
    case 'ingredient.replace':
      return `Swap ${c.from ?? 'ingredient'}${arrow}${c.to ?? ''}`
    case 'ingredient.amount':
      return `${c.from ?? 'Amount'}${arrow}${c.to ?? ''}`
    case 'ingredient.add':
      return `Add ${c.to ?? ''}`
    case 'ingredient.remove':
      return `Leave out ${c.from ?? ''}`
    case 'step.edit':
      return `Step ${(c.index ?? 0) + 1}: ${c.to ?? ''}`
    case 'step.add':
      return `New step after ${(c.index ?? -1) + 1 || 'start'}: ${c.to ?? ''}`
    case 'step.remove':
      return `Skip step ${(c.index ?? 0) + 1}`
    case 'time':
      return `Timing: ${c.to ?? ''}`
    case 'servings':
      return `Servings: ${c.to ?? ''}`
    default:
      return c.note ?? c.to ?? 'Tweak'
  }
}

export interface CommunityFeed {
  recipe: { id: string; slug: string; title: string; version: number; madeCount: number; commentCount: number; authorId: string; authorName: string }
  tweaks: Contribution[] // accepted first, then pending by madeCount
  comments: Contribution[] // made-its and plain comments, newest first
  photos: string[]
}

