'use client'

import Link from 'next/link'
import DigestTestButton from '@/components/admin/DigestTestButton'
import { useEffect, useState } from 'react'

type Stats = Record<string, number | string>
type Check = { id: string; label: string; ok: boolean; detail?: string; pending?: boolean }
type Health = { status: 'ready' | 'attention'; attention: number; checkedAt: string; groups: { id: string; label: string; checks: Check[] }[] }

function Tile({ label, value, hint, href, tone }: { label: string; value: number | string; hint?: string; href?: string; tone?: 'warn' | 'good' }) {
  const body = (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${tone === 'warn' ? 'border-amber-300' : 'border-gray-200'}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${tone === 'warn' ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
  return href ? <Link href={href} className="block transition hover:-translate-y-0.5">{body}</Link> : body
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/stats', { cache: 'no-store' })
      .then(async (r) => (r.ok ? (await r.json()).stats : Promise.reject(new Error('Could not load the numbers'))))
      .then(setStats)
      .catch((e) => setError(e.message))
    fetch('/api/admin/health', { cache: 'no-store' })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error('Could not run health checks'))))
      .then(setHealth)
      .catch(() => setHealth(null))
  }, [])

  const n = (key: string) => Number(stats?.[key] ?? 0)
  const failing = health?.groups.flatMap((g) => g.checks.filter((c) => !c.ok && !c.pending)) ?? []

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="mt-1 text-sm text-gray-500">The community at a glance. Numbers are live from Supabase.</p>
        </div>
        {health && (
          <Link href="/admin/security" className={`rounded-full px-4 py-2 text-sm font-bold ${health.status === 'ready' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>
            {health.status === 'ready' ? 'All health checks passing' : `${health.attention} check${health.attention === 1 ? '' : 's'} need attention`}
          </Link>
        )}
      </div>

      {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}

      {(n('moderationOpen') > 0 || failing.length > 0) && (
        <section className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-bold text-amber-900">Needs a look</h2>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {n('moderationOpen') > 0 && <li><Link href="/admin/moderation" className="underline">{n('moderationOpen')} item(s) in the moderation queue</Link>{n('moderationStale') > 0 ? `, ${n('moderationStale')} older than 48 hours` : ''}</li>}
            {failing.map((c) => <li key={c.id}><Link href="/admin/security" className="underline">{c.label}</Link>{c.detail ? ` · ${c.detail}` : ''}</li>)}
          </ul>
        </section>
      )}

      <h2 className="mt-10 text-sm font-bold uppercase tracking-wide text-gray-500">Community</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Members" value={n('members')} hint={`+${n('membersLast7Days')} in the last 7 days`} href="/admin/members" />
        <Tile label="Savry+ members" value={n('plusMembers')} hint="Renewing through Apple" />
        <Tile label="Public recipes" value={n('publicRecipes')} hint={`+${n('recipesLast7Days')} this week`} href="/admin/recipes" />
        <Tile label="Cooked this week" value={n('madeItsLast7Days')} hint={`${n('commentsLast7Days')} comments, ${n('pendingTweaks')} tweaks waiting on authors`} />
      </div>

      <h2 className="mt-10 text-sm font-bold uppercase tracking-wide text-gray-500">Safety</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Moderation queue" value={n('moderationOpen')} hint={n('moderationStale') ? `${n('moderationStale')} waiting over 48 h` : 'Nothing overdue'} href="/admin/moderation" tone={n('moderationOpen') ? 'warn' : undefined} />
        <Tile label="Reports this week" value={n('reportsLast7Days')} href="/admin/reports" />
        <Tile label="Recipes on hold" value={n('recipesOnHold')} hint="Unlisted after reports" href="/admin/recipes" tone={n('recipesOnHold') ? 'warn' : undefined} />
        <Tile label="Banned members" value={n('bannedMembers')} hint={`${n('unconfirmedMembers')} never confirmed email`} href="/admin/members" />
      </div>

      <h2 className="mt-10 text-sm font-bold uppercase tracking-wide text-gray-500">Storage and growth</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Photos stored" value={n('storageObjects')} hint={formatBytes(n('storageBytes'))} />
        <Tile label="Sign-in" value={health?.groups.find((g) => g.id === 'database')?.checks.find((c) => c.id === 'db-apple-secret')?.ok ? 'Apple OK' : 'Check'} hint="Apple secret rotates every 6 months" href="/admin/security" />
        <Tile label="Email" value={health?.groups.find((g) => g.id === 'mail')?.checks.every((c) => c.ok) ? 'Healthy' : 'Check'} hint="Resend out, Cloudflare in" href="/admin/security" />
      </div>

      <h2 className="mt-10 text-sm font-bold uppercase tracking-wide text-gray-500">Elsewhere</h2>
      <ul className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <li className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <a href="/api/admin/digest-preview" target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-900 hover:underline">This week&rsquo;s email ↗</a>
          <p className="mt-1 text-gray-500">Preview the Sunday digest as you would receive it.</p>
          <DigestTestButton />
        </li>
        {[
          ['https://supabase.com/dashboard/project/qnpekzrchqftdoaebzuf', 'Supabase', 'Database, auth users, storage, logs'],
          ['https://vercel.com', 'Vercel', 'Deployments and environment variables'],
          ['https://resend.com/emails', 'Resend', 'Auth email delivery log'],
          ['https://dash.cloudflare.com', 'Cloudflare', 'DNS and inbound email routing'],
          ['https://appstoreconnect.apple.com', 'App Store Connect', 'Savry+ subscriptions and TestFlight'],
          ['https://search.google.com/search-console', 'Search Console', 'Indexing and search traffic'],
          ['https://github.com/blahmonsterllc/savryweb/actions', 'GitHub Actions', 'Automated tests on every push'],
        ].map(([href, title, body]) => (
          <li key={href} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-900 hover:underline">{title} ↗</a>
            <p className="mt-1 text-gray-500">{body}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
