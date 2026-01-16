import crypto from 'crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { db } from '@/lib/firebase'

export type AICacheScope = 'REGION' | 'USER'

export type AICacheRecord<T> = {
  key: string
  scope: AICacheScope
  createdAt: Timestamp
  expiresAt: Timestamp
  hits: number
  lastHitAt: Timestamp | null
  payload: T
  meta?: Record<string, unknown>
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function sha256Stable(obj: unknown): string {
  return sha256Hex(stableJson(obj))
}

export function stableJson(obj: unknown): string {
  // Minimal stable stringify (sort object keys). Arrays preserved as-is.
  const seen = new WeakSet()

  const normalize = (v: any): any => {
    if (v === null || typeof v !== 'object') return v
    if (seen.has(v)) return '[Circular]'
    seen.add(v)
    if (Array.isArray(v)) return v.map(normalize)
    const keys = Object.keys(v).sort()
    const out: any = {}
    for (const k of keys) out[k] = normalize(v[k])
    return out
  }

  return JSON.stringify(normalize(obj))
}

export function buildAICacheKey(input: {
  scope: AICacheScope
  namespace: string
  version: number
  parts: Record<string, unknown>
}): { key: string; docId: string } {
  const key = stableJson(input)
  // Use hashed doc id so Firestore doc id is compact.
  const docId = `${input.namespace}_v${input.version}_${sha256Hex(key).slice(0, 32)}`
  return { key, docId }
}

export async function getAICache<T>(docId: string): Promise<AICacheRecord<T> | null> {
  const doc = await db.collection('aiCache').doc(docId).get()
  if (!doc.exists) return null
  const data = doc.data() as AICacheRecord<T>
  const expiresAt = data?.expiresAt?.toDate?.()
  if (!expiresAt || expiresAt.getTime() <= Date.now()) return null
  return data
}

export async function recordAICacheHit(docId: string): Promise<void> {
  const ref = db.collection('aiCache').doc(docId)
  // Firebase Admin exposes FieldValue via the firestore namespace
  const { FieldValue } = await import('firebase-admin/firestore')
  await ref.set(
    {
      hits: FieldValue.increment(1),
      lastHitAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  )
}

export async function setAICache<T>(params: {
  docId: string
  key: string
  scope: AICacheScope
  ttlSeconds: number
  payload: T
  meta?: Record<string, unknown>
}): Promise<void> {
  const now = Timestamp.now()
  const expiresAt = Timestamp.fromMillis(Date.now() + params.ttlSeconds * 1000)

  await db.collection('aiCache').doc(params.docId).set({
    key: params.key,
    scope: params.scope,
    createdAt: now,
    expiresAt,
    hits: 0,
    lastHitAt: null,
    payload: params.payload,
    meta: params.meta || {},
  })
}

export function weekBucket(): number {
  return Math.floor(Date.now() / 604_800_000) // 7 days in ms
}


