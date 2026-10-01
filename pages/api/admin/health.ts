/**
 * Site health and security checks for /admin/security. middleware.ts and requireAdmin limit
 * /api/admin/* to Savry accounts on the admin list. Nothing here returns a secret value,
 * only whether each piece is configured and behaving.
 *
 * GET /api/admin/health → { status, checkedAt, groups: [{ id, label, checks: [{ id, label, ok, detail, pending? }] }] }
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveMx, resolveTxt } from 'node:dns/promises'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { SITE_URL } from '@/lib/site-url'
import { requireAdmin } from '@/lib/admin-session'

type Check = { id: string; label: string; ok: boolean; detail?: string; pending?: boolean }
type Group = { id: string; label: string; checks: Check[] }

const MAIL_DOMAIN = 'savry.io'

async function txt(name: string): Promise<string[]> {
  try {
    return (await resolveTxt(name)).map((chunks) => chunks.join(''))
  } catch {
    return []
  }
}

async function configuration(): Promise<Group> {
  const env = process.env
  return {
    id: 'config',
    label: 'Configuration',
    checks: [
      { id: 'supabase-url', label: 'Supabase project URL', ok: Boolean(env.NEXT_PUBLIC_SUPABASE_URL) },
      { id: 'supabase-key', label: 'Supabase publishable key', ok: Boolean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY) },
      { id: 'supabase-secret', label: 'Supabase secret key (server only)', ok: Boolean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY) },
      { id: 'site-url', label: 'Canonical site URL is savry.io', ok: SITE_URL === 'https://www.savry.io', detail: SITE_URL },
      { id: 'apple-revoke', label: 'Apple token revocation on account deletion', ok: Boolean(env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY), detail: env.APPLE_PRIVATE_KEY ? 'Configured' : 'Add APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY in Vercel' },
      { id: 'adsense', label: 'Google AdSense publisher id', ok: Boolean(env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID), detail: env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID ? 'Ads can serve' : 'Set NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID in Vercel once AdSense approves the site', pending: !env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID },
      {
        id: 'retired-env',
        label: 'No retired secrets in the environment',
        ok: !['FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'NEXT_PUBLIC_FIREBASE_API_KEY', 'OPENAI_API_KEY', 'JWT_SECRET', 'DATABASE_URL', 'ENABLE_LEGACY_APP_API', 'R2_ACCESS_KEY_ID', 'R2_BUCKET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'].some((key) => env[key]),
        detail: 'Firebase, OpenAI, legacy JWT, Prisma database, R2, and the old Google admin sign-in variables should be deleted from Vercel',
      },
    ],
  }
}

async function database(): Promise<Group> {
  const started = Date.now()
  try {
    const supabase = getSupabaseAdmin()
    const [{ data: audit, error: auditError }, { error: statsError }] = await Promise.all([supabase.rpc('admin_security_audit'), supabase.rpc('admin_stats')])
    const latency = Date.now() - started
    if (auditError || statsError) {
      return { id: 'database', label: 'Database', checks: [{ id: 'db-reach', label: 'Supabase reachable with admin credentials', ok: false, detail: (auditError ?? statsError)?.message }] }
    }
    const checks: Check[] = [{ id: 'db-reach', label: 'Supabase reachable with admin credentials', ok: latency < 4000, detail: `${latency} ms` }]
    const { count: adminCount } = await supabase.from('admin_users').select('user_id', { count: 'exact', head: true })
    checks.push({ id: 'admin-list', label: 'Admin list is short and not empty', ok: (adminCount ?? 0) >= 1 && (adminCount ?? 0) <= 5, detail: `${adminCount ?? 0} account(s)` })
    for (const check of (audit?.checks ?? []) as Check[]) checks.push({ id: `db-${check.id}`, label: check.label, ok: check.ok, detail: check.detail })
    return { id: 'database', label: 'Database security audit (live)', checks }
  } catch (error) {
    return { id: 'database', label: 'Database', checks: [{ id: 'db-reach', label: 'Supabase reachable with admin credentials', ok: false, detail: (error as Error).message }] }
  }
}

async function mail(): Promise<Group> {
  const [mx, dkim, dmarc, spf, resendDkim] = await Promise.all([
    resolveMx(MAIL_DOMAIN).catch(() => []),
    txt(`cf2024-1._domainkey.${MAIL_DOMAIN}`),
    txt(`_dmarc.${MAIL_DOMAIN}`),
    txt(MAIL_DOMAIN),
    txt(`resend._domainkey.${MAIL_DOMAIN}`),
  ])
  const spfRecord = spf.find((value) => value.startsWith('v=spf1')) ?? ''
  const dmarcRecord = dmarc.find((value) => value.startsWith('v=DMARC1')) ?? ''
  return {
    id: 'mail',
    label: 'Email',
    checks: [
      { id: 'mx', label: 'Inbound mail routes through Cloudflare to the team inbox', ok: mx.length > 0 && mx.every((r) => r.exchange.endsWith('mx.cloudflare.net')), detail: mx.map((r) => r.exchange).join(', ') || 'No MX records' },
      { id: 'resend-dkim', label: 'Resend can sign outbound auth mail (DKIM)', ok: resendDkim.some((v) => v.startsWith('p=')) },
      { id: 'cf-dkim', label: 'Cloudflare forwarding signature (DKIM)', ok: dkim.some((v) => v.startsWith('v=DKIM1')) },
      { id: 'spf', label: 'SPF is a single valid record', ok: spf.filter((v) => v.startsWith('v=spf1')).length === 1 && /include:_spf\.mx\.cloudflare\.net/.test(spfRecord) && !/→/.test(spfRecord), detail: spfRecord || 'Missing' },
      { id: 'dmarc', label: 'DMARC reports go to the team inbox', ok: /rua=mailto:savryapp@gmail\.com/.test(dmarcRecord), detail: dmarcRecord || 'Missing' },
    ],
  }
}

async function edge(): Promise<Group> {
  try {
    const response = await fetch(`${SITE_URL}/`, { method: 'HEAD', redirect: 'manual', cache: 'no-store' })
    const csp = response.headers.get('content-security-policy') ?? ''
    const hsts = response.headers.get('strict-transport-security') ?? ''
    return {
      id: 'edge',
      label: 'Live site headers',
      checks: [
        { id: 'site-up', label: 'Site responds', ok: response.status >= 200 && response.status < 400, detail: `HTTP ${response.status}` },
        { id: 'csp', label: 'Content Security Policy is set', ok: csp.includes("default-src 'self'") },
        { id: 'hsts', label: 'HTTPS is enforced (HSTS)', ok: /max-age=\d{6,}/.test(hsts) },
        { id: 'frame', label: 'Clickjacking blocked', ok: (response.headers.get('x-frame-options') ?? '').toUpperCase() === 'DENY' || /frame-ancestors 'none'/.test(csp) },
        { id: 'nosniff', label: 'MIME sniffing blocked', ok: (response.headers.get('x-content-type-options') ?? '').toLowerCase() === 'nosniff' },
        { id: 'referrer', label: 'Referrer policy set', ok: Boolean(response.headers.get('referrer-policy')) },
      ],
    }
  } catch (error) {
    return { id: 'edge', label: 'Live site headers', checks: [{ id: 'site-up', label: 'Site responds', ok: false, detail: (error as Error).message }] }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  const groups = await Promise.all([configuration(), database(), mail(), edge()])
  const attention = groups.flatMap((g) => g.checks).filter((c) => !c.ok && !c.pending).length
  return res.status(200).json({ status: attention === 0 ? 'ready' : 'attention', attention, checkedAt: new Date().toISOString(), groups })
}
