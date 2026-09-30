import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0')
  const checks = [
    { id: 'supabase-url', label: 'Supabase project URL', ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
    { id: 'supabase-key', label: 'Supabase publishable key', ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) },
    { id: 'admin-secret', label: 'Admin session signing secret', ok: Boolean(process.env.NEXTAUTH_SECRET) },
    { id: 'admin-google', label: 'Admin Google OAuth', ok: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) },
    { id: 'legacy-app', label: 'Legacy Firebase app API disabled', ok: process.env.ENABLE_LEGACY_APP_API !== 'true' },
    { id: 'model-key', label: 'Savry model service credential', ok: Boolean(process.env.SAVRY_MODEL_API_KEY), pending: true },
  ]

  return res.status(200).json({
    status: checks.every((check) => check.ok || check.pending) ? 'ready' : 'attention',
    checkedAt: new Date().toISOString(),
    checks,
  })
}
