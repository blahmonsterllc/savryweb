/**
 * Server-side community helpers (Firestore). Types and pure helpers are in
 * community-types.ts so client components can import them without pulling
 * in firebase-admin.
 */
import { db, timestampToDate } from '@/lib/firebase'
import { COLLECTION } from '@/lib/community-recipes'
import type { CommunityFeed, Contribution, RecipeChange } from '@/lib/community-types'
export * from '@/lib/community-types'

// ---------------------------------------------------------------------------
// Applying changes to the stored recipe (author accepts a tweak)
// ---------------------------------------------------------------------------

const UNITS = new Set([
  'cup', 'cups', 'c', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons', 'oz', 'ounce', 'ounces',
  'lb', 'lbs', 'pound', 'pounds', 'g', 'gram', 'grams', 'kg', 'ml', 'l', 'liter', 'liters', 'clove', 'cloves',
  'can', 'cans', 'pinch', 'slice', 'slices', 'piece', 'pieces', 'stick', 'sticks', 'sprig', 'sprigs', 'bunch', 'large', 'medium', 'small',
])

/** "1 1/2 cups oat milk" -> { amount: "1 1/2", unit: "cups", name: "oat milk" } */
export function parseIngredientLine(line: string): { name: string; amount: string | null; unit: string | null } {
  const tokens = line.trim().split(/\s+/)
  const amountTokens: string[] = []
  while (tokens.length && /^[\d½⅓⅔¼¾⅛./-]+$/.test(tokens[0])) amountTokens.push(tokens.shift()!)
  let unit: string | null = null
  if (tokens.length && UNITS.has(tokens[0].toLowerCase().replace(/\.$/, ''))) unit = tokens.shift()!
  return { amount: amountTokens.join(' ') || null, unit, name: tokens.join(' ') || line.trim() }
}

type StoredIngredient = { name: string; amount: string | null; unit: string | null; section: string | null; isOptional: boolean }
type StoredStep = { step: number; text: string }

export function applyChanges(recipe: any, changes: RecipeChange[]): any {
  const ingredients: StoredIngredient[] = [...(recipe.ingredients ?? [])]
  let steps: StoredStep[] = [...(recipe.instructions ?? [])].map((s: any, i: number) => (typeof s === 'string' ? { step: i + 1, text: s } : s))
  let prepTime = recipe.prepTime ?? 0
  let cookTime = recipe.cookTime ?? 0
  let servings = recipe.servings ?? 1

  for (const c of changes) {
    const i = c.index ?? -1
    switch (c.kind) {
      case 'ingredient.replace':
        if (i >= 0 && i < ingredients.length && c.to) {
          const p = parseIngredientLine(c.to)
          ingredients[i] = { ...ingredients[i], name: p.name, amount: p.amount ?? ingredients[i].amount, unit: p.unit ?? ingredients[i].unit }
        }
        break
      case 'ingredient.amount':
        if (i >= 0 && i < ingredients.length && c.to) {
          const p = parseIngredientLine(`${c.to} ${ingredients[i].name}`)
          ingredients[i] = { ...ingredients[i], amount: p.amount, unit: p.unit ?? ingredients[i].unit }
        }
        break
      case 'ingredient.add':
        if (c.to) {
          const p = parseIngredientLine(c.to)
          ingredients.push({ name: p.name, amount: p.amount, unit: p.unit, section: null, isOptional: false })
        }
        break
      case 'ingredient.remove':
        if (i >= 0 && i < ingredients.length) ingredients.splice(i, 1)
        break
      case 'step.edit':
        if (i >= 0 && i < steps.length && c.to) steps[i] = { ...steps[i], text: c.to }
        break
      case 'step.add':
        if (c.to) steps.splice(Math.min(Math.max(i + 1, 0), steps.length), 0, { step: 0, text: c.to })
        break
      case 'step.remove':
        if (i >= 0 && i < steps.length) steps.splice(i, 1)
        break
      case 'time': {
        const prep = c.to?.match(/prep\D*(\d+)/i)?.[1]
        const cook = c.to?.match(/cook\D*(\d+)/i)?.[1]
        if (prep) prepTime = Number(prep)
        if (cook) cookTime = Number(cook)
        break
      }
      case 'servings': {
        const n = Number(c.to?.match(/\d+/)?.[0])
        if (n > 0) servings = n
        break
      }
      default:
        break
    }
  }
  steps = steps.map((s, idx) => ({ step: idx + 1, text: s.text }))
  return { ...recipe, ingredients, instructions: steps, prepTime, cookTime, totalTime: prepTime + cookTime, servings }
}

// ---------------------------------------------------------------------------
// Firestore access
// ---------------------------------------------------------------------------

/** Accepts either a slug or a document id. */
export async function findRecipeRef(key: string) {
  const bySlug = await db.collection(COLLECTION).where('slug', '==', key).limit(1).get()
  if (!bySlug.empty) return bySlug.docs[0].ref
  const byId = db.collection(COLLECTION).doc(key)
  return (await byId.get()).exists ? byId : null
}

export function toContribution(id: string, d: FirebaseFirestore.DocumentData): Contribution {
  const created = timestampToDate(d.createdAt)
  return {
    id,
    type: d.type,
    userId: d.userId,
    userName: d.userName ?? 'Savry cook',
    text: d.text ?? null,
    photoUrl: d.photoUrl ?? null,
    madeIt: !!d.madeIt,
    source: d.source ?? 'web',
    proof: d.proof ?? null,
    changes: d.changes ?? [],
    safetyFlags: d.safetyFlags ?? [],
    tweakId: d.tweakId ?? null,
    status: d.status ?? null,
    madeCount: Number(d.madeCount ?? 0),
    acceptedInVersion: d.acceptedInVersion ?? null,
    createdAt: created instanceof Date ? created.toISOString() : new Date().toISOString(),
  }
}

export async function loadFeed(ref: FirebaseFirestore.DocumentReference): Promise<CommunityFeed> {
  const [doc, snap] = await Promise.all([ref.get(), ref.collection('contributions').orderBy('createdAt', 'desc').limit(200).get()])
  const data = doc.data() ?? {}
  // Reported-and-hidden posts never reach readers; admins see them in moderation_queue.
  const all = snap.docs.filter((d) => !d.data().hidden).map((d) => toContribution(d.id, d.data()))
  const tweaks = all
    .filter((c) => c.type === 'tweak' && c.status !== 'declined')
    .sort((a, b) => (a.status === 'accepted' ? -1 : 0) - (b.status === 'accepted' ? -1 : 0) || b.madeCount - a.madeCount)
  const comments = all.filter((c) => c.type !== 'tweak')
  return {
    recipe: {
      id: doc.id,
      slug: data.slug ?? doc.id,
      title: data.title ?? data.recipe?.title ?? '',
      version: Number(data.version ?? 1),
      madeCount: Number(data.madeCount ?? 0),
      commentCount: Number(data.commentCount ?? 0),
      authorId: data.importedBy ?? '',
      authorName: data.importedByUsername ?? 'Savry cook',
    },
    tweaks,
    comments,
    photos: all.filter((c) => c.photoUrl).map((c) => c.photoUrl!) as string[],
  }
}
