import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type HealthResponse = {
  ok: boolean
  timestamp: string
  uptimeSec: number
  node: {
    version: string
    env: string
  }
  app: {
    version: string
  }
  memory: {
    rssBytes: number
    heapTotalBytes: number
    heapUsedBytes: number
  }
  env: Record<string, boolean>
  firestore: {
    ok: boolean
    latencyMs?: number
    details?: string
    sampleCounts?: {
      supermarketDiscounts?: number
      storeItemLocations?: number
    }
  }
}

function boolEnv(name: string): boolean {
  return Boolean(process.env[name] && String(process.env[name]).length > 0)
}

export async function GET() {
  const start = Date.now()

  const envFlags: Record<string, boolean> = {
    FIREBASE_PROJECT_ID: boolEnv('FIREBASE_PROJECT_ID'),
    FIREBASE_CLIENT_EMAIL: boolEnv('FIREBASE_CLIENT_EMAIL'),
    FIREBASE_PRIVATE_KEY: boolEnv('FIREBASE_PRIVATE_KEY'),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: boolEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
    NEXTAUTH_SECRET: boolEnv('NEXTAUTH_SECRET'),
    JWT_SECRET: boolEnv('JWT_SECRET'),
    OPENAI_API_KEY: boolEnv('OPENAI_API_KEY'),
    ADMIN_SEED_KEY: boolEnv('ADMIN_SEED_KEY'),
    ADMIN_SESSION_SECRET: boolEnv('ADMIN_SESSION_SECRET'),
    ADMIN_PASSWORD: boolEnv('ADMIN_PASSWORD'),
  }

  const memoryUsage = process.memoryUsage()

  let firestoreOk = false
  let firestoreLatencyMs: number | undefined
  let firestoreDetails: string | undefined
  let sampleCounts: HealthResponse['firestore']['sampleCounts'] | undefined

  try {
    // Lightweight read-only checks to confirm connectivity + permissions.
    // Keep limits low to minimize cost.
    const [discountsSnap, locationsSnap] = await Promise.all([
      db.collection('supermarketDiscounts').limit(1).get(),
      db.collection('storeItemLocations').limit(1).get(),
    ])

    firestoreOk = true
    firestoreLatencyMs = Date.now() - start
    sampleCounts = {
      supermarketDiscounts: discountsSnap.size,
      storeItemLocations: locationsSnap.size,
    }
  } catch (e: unknown) {
    firestoreOk = false
    firestoreLatencyMs = Date.now() - start
    firestoreDetails = e instanceof Error ? e.message : String(e)
  }

  const body: HealthResponse = {
    ok: firestoreOk,
    timestamp: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    node: {
      version: process.version,
      env: process.env.NODE_ENV || 'unknown',
    },
    app: {
      version: process.env.npm_package_version || 'unknown',
    },
    memory: {
      rssBytes: memoryUsage.rss,
      heapTotalBytes: memoryUsage.heapTotal,
      heapUsedBytes: memoryUsage.heapUsed,
    },
    env: envFlags,
    firestore: {
      ok: firestoreOk,
      latencyMs: firestoreLatencyMs,
      details: firestoreDetails,
      sampleCounts,
    },
  }

  return NextResponse.json(body, {
    status: body.ok ? 200 : 503,
    headers: {
      'cache-control': 'no-store, max-age=0',
    },
  })
}


