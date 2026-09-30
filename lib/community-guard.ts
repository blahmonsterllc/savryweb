/**
 * Safeguards for everything people can write to Savry.io: publishing,
 * Made Its, comments, tweaks, and reports. Every write endpoint calls
 * `guardWrite` first, then the content screens that apply.
 *
 * Layers:
 *   1. Account standing   banned flag, verified email
 *   2. Daily limits       per user, counted in Firestore (serverless-safe)
 *   3. Content screens    links, spam, abusive words
 *   4. Tweak screens      structural sanity + food-safety flags
 *   5. Community reports  auto-hide after several distinct reports (report.ts)
 *   6. Author control     only the author accepts tweaks; every version is kept
 *                         and can be restored (accept.ts / revert.ts)
 */
import { FieldValue } from 'firebase-admin/firestore'
import { auth, db } from '@/lib/firebase'
import type { RecipeChange } from '@/lib/community-types'

// ---------------------------------------------------------------------------
// 1. Account standing
// ---------------------------------------------------------------------------

export type GuardResult = { ok: true; userName: string } | { ok: false; status: number; error: string; code: string }

export async function guardWrite(userId: string, email: string): Promise<GuardResult> {
  const userDoc = await db.collection('users').doc(userId).get()
  const user = userDoc.data() ?? {}
  if (user.banned) {
    return { ok: false, status: 403, code: 'banned', error: 'This account can no longer post on Savry.io.' }
  }
  // Verified email keeps throwaway accounts from flooding recipes. Accounts
  // that don't exist in Firebase Auth (older Apple sign-ins) are let through.
  try {
    const record = await auth.getUser(userId)
    if (record.disabled) {
      return { ok: false, status: 403, code: 'banned', error: 'This account is disabled.' }
    }
    if (!record.emailVerified) {
      return {
        ok: false,
        status: 403,
        code: 'email_unverified',
        error: 'Verify your email to post. Open the link we sent you, then try again.',
      }
    }
  } catch (error: any) {
    if (error?.code !== 'auth/user-not-found') console.warn('guardWrite: auth lookup failed', error?.code)
  }
  return { ok: true, userName: user.name || email.split('@')[0] }
}

// ---------------------------------------------------------------------------
// 2. Daily limits
// ---------------------------------------------------------------------------

export const DAILY_LIMITS = {
  publish: 10,
  contribution: 40,
  tweak: 10,
  report: 20,
} as const
export type LimitKind = keyof typeof DAILY_LIMITS

/** Atomically counts one action; returns false when today's limit is already used up. */
export async function takeDailyAllowance(userId: string, kind: LimitKind): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10)
  const ref = db.collection('rate_limits').doc(`${userId}_${day}`)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const used = Number(snap.data()?.[kind] ?? 0)
    if (used >= DAILY_LIMITS[kind]) return false
    tx.set(ref, { [kind]: FieldValue.increment(1), userId, day, updatedAt: new Date() }, { merge: true })
    return true
  })
}

// ---------------------------------------------------------------------------
// 3. Content screens
// ---------------------------------------------------------------------------

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|ru|cn|xyz|top|info|biz|co)\b)/i
const CONTACT = /(\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|@[a-z0-9_]{3,}|telegram|whatsapp|cashapp|venmo)/i
const REPEAT = /(.)\1{7,}/
// Deliberately short: slurs and the most common abuse. Reports catch the rest.
const ABUSIVE = /\b(fuck\w*|shit\w*|bitch\w*|cunt\w*|asshole\w*|nigg\w*|fag\w*|retard\w*|kill yourself|kys)\b/i

export type Screen = { ok: true } | { ok: false; error: string }

export function screenText(text: string | null | undefined): Screen {
  if (!text) return { ok: true }
  if (LINK.test(text)) return { ok: false, error: 'Links aren’t allowed in comments or tweaks.' }
  if (CONTACT.test(text)) return { ok: false, error: 'Please don’t share contact details or payment handles here.' }
  if (REPEAT.test(text)) return { ok: false, error: 'That looks like spam. Try rewording it.' }
  if (ABUSIVE.test(text)) return { ok: false, error: 'Please keep it friendly. That wording isn’t allowed.' }
  const letters = text.replace(/[^a-zA-Z]/g, '')
  if (letters.length > 40 && letters === letters.toUpperCase()) return { ok: false, error: 'Please don’t write in all caps.' }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// 4. Tweak screens
// ---------------------------------------------------------------------------

const RISKY_PROTEIN = /(chicken|turkey|poultry|pork|ground beef|ground meat|burger|sausage|egg|fish|shellfish|shrimp)/i
const RAW_OR_UNDER = /\b(raw|uncooked|undercook\w*|rare|skip (the )?cook\w*|don'?t cook|no need to cook|room temperature (overnight|for hours)|leave (it )?out overnight)\b/i
const CANNING = /\b(canning|home[- ]can\w*|pressure can\w*|water bath|shelf[- ]stable|botulism|preserv(e|ing) (it )?in jars?)\b/i

export interface TweakScreen {
  ok: boolean
  error?: string
  /** Shown as a caution label; flagged tweaks are never auto-promoted. */
  safetyFlags: string[]
}

export function screenChanges(recipe: any, changes: RecipeChange[]): TweakScreen {
  const ingredients: any[] = recipe?.ingredients ?? []
  const steps: any[] = recipe?.instructions ?? []
  const safetyFlags: string[] = []

  let removedIngredients = 0
  let removedSteps = 0
  for (const c of changes) {
    for (const field of [c.to, c.note, c.from]) {
      const s = screenText(field)
      if (!s.ok) return { ok: false, error: s.error, safetyFlags }
    }
    const i = c.index ?? -1
    const needsIngredient = ['ingredient.replace', 'ingredient.amount', 'ingredient.remove'].includes(c.kind)
    const needsStep = ['step.edit', 'step.remove'].includes(c.kind)
    if (needsIngredient && !(i >= 0 && i < ingredients.length)) return { ok: false, error: 'That tweak points at an ingredient that isn’t in the recipe.', safetyFlags }
    if (needsStep && !(i >= 0 && i < steps.length)) return { ok: false, error: 'That tweak points at a step that isn’t in the recipe.', safetyFlags }
    if (c.kind === 'ingredient.remove') removedIngredients++
    if (c.kind === 'step.remove') removedSteps++

    const stepText = needsStep ? String(steps[i]?.text ?? steps[i] ?? '') : ''
    const combined = `${c.to ?? ''} ${c.note ?? ''}`
    if (RAW_OR_UNDER.test(combined) && RISKY_PROTEIN.test(`${combined} ${stepText} ${recipe?.title ?? ''}`)) {
      safetyFlags.push('May undercook meat, poultry, eggs, or seafood')
    }
    if (c.kind === 'step.remove' && RISKY_PROTEIN.test(stepText) && /\b(cook|bake|roast|fry|grill|sear|boil|simmer|until)\b/i.test(stepText)) {
      safetyFlags.push('Removes a cooking step for meat, poultry, eggs, or seafood')
    }
    if (CANNING.test(combined)) safetyFlags.push('Home canning or preserving needs a tested method')
    const temp = combined.match(/(\d{2,3})\s*°?\s*f\b/i)
    if (temp && Number(temp[1]) < 140 && RISKY_PROTEIN.test(`${combined} ${stepText}`)) {
      safetyFlags.push('Cooking temperature looks too low to be safe')
    }
  }

  // A "tweak" that guts the recipe is vandalism, not a tweak.
  if (ingredients.length >= 4 && removedIngredients > ingredients.length / 2) {
    return { ok: false, error: 'A tweak can’t remove most of the ingredients. Publish your own version instead.', safetyFlags }
  }
  if (steps.length >= 4 && removedSteps > steps.length / 2) {
    return { ok: false, error: 'A tweak can’t remove most of the steps. Publish your own version instead.', safetyFlags }
  }
  return { ok: true, safetyFlags: Array.from(new Set(safetyFlags)) }
}

// ---------------------------------------------------------------------------
// 5. Reports
// ---------------------------------------------------------------------------

export const REPORTS_TO_HIDE_CONTRIBUTION = 3
export const REPORTS_TO_HIDE_RECIPE = 5
export const REPORT_REASONS = ['spam', 'abusive', 'unsafe', 'not_a_recipe', 'copied', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]
