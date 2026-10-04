import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { SITE_URL } from '@/lib/site-url'

/**
 * The weekly email. Content comes from the database (weekly_digest), the
 * message is built here, and Resend delivers it. Without RESEND_API_KEY the
 * run is a no-op that reports itself as unconfigured, never an error.
 */

export const FROM_ADDRESS = 'Savry <hello@savry.io>'
export const REPLY_TO = 'savryapp@gmail.com'

type Cook = { username: string | null; displayName: string; avatarUrl: string | null }
type Recipe = { id: string; slug: string; title: string; description: string | null; imageUrl: string | null; category: string | null; totalTime: number; madeCount: number; authorName: string }
export type Digest = {
  cook: Cook
  followingCount: number
  fromFollowed: Recipe[]
  madeByFollowed: { cook: Cook; note: string | null; photoUrl: string; recipe: { slug: string; title: string } }[]
  trending: Recipe[]
  yourWeek: { madeOfYours: number; notesOnYours: number; newFollowers: number; recipeCount: number }
}

export const isEmailConfigured = () => Boolean(process.env.RESEND_API_KEY)

/** Monday of the week containing `date`, as YYYY-MM-DD. The digest goes out once per week per cook. */
export function weekStart(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - day + 1)
  return d.toISOString().slice(0, 10)
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

/** True when there is something worth sending. Quiet weeks send nothing. */
export function hasContent(digest: Digest): boolean {
  return digest.fromFollowed.length > 0 || digest.madeByFollowed.length > 0 || digest.trending.length > 0
    || digest.yourWeek.madeOfYours > 0 || digest.yourWeek.notesOnYours > 0 || digest.yourWeek.newFollowers > 0
}

export function renderDigest(digest: Digest, unsubscribeUrl: string): { subject: string; html: string; text: string } {
  const first = digest.fromFollowed[0] ?? digest.trending[0]
  const subject = first ? `${first.title}, and what the table cooked this week` : 'What the Savry table cooked this week'
  const link = (path: string) => `${SITE_URL}${path}`
  const recipeRow = (r: Recipe) => `
    <tr><td style="padding:10px 0;border-top:1px solid #ece3d2">
      <a href="${link(`/recipes/${r.slug}`)}" style="color:#101d2f;text-decoration:none;display:block">
        ${r.imageUrl ? `<img src="${escape(r.imageUrl)}" width="560" alt="" style="display:block;width:100%;max-width:560px;height:auto;border-radius:14px;margin-bottom:10px">` : ''}
        <strong style="font-size:18px;font-family:Georgia,serif;font-weight:500">${escape(r.title)}</strong><br>
        <span style="color:#596475;font-size:14px">${escape([r.authorName ? `by ${r.authorName}` : '', r.totalTime ? `${r.totalTime} min` : '', r.madeCount ? `${r.madeCount} made it` : ''].filter(Boolean).join(' · '))}</span>
      </a>
    </td></tr>`
  const section = (title: string, body: string) => body ? `
    <tr><td style="padding:26px 0 6px"><span style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#cb4730">${title}</span></td></tr>${body}` : ''

  const yourWeek = [
    digest.yourWeek.madeOfYours ? `${digest.yourWeek.madeOfYours} cook${digest.yourWeek.madeOfYours === 1 ? '' : 's'} made one of your recipes` : null,
    digest.yourWeek.notesOnYours ? `${digest.yourWeek.notesOnYours} new note${digest.yourWeek.notesOnYours === 1 ? '' : 's'} or tweak${digest.yourWeek.notesOnYours === 1 ? '' : 's'} on your recipes` : null,
    digest.yourWeek.newFollowers ? `${digest.yourWeek.newFollowers} new follower${digest.yourWeek.newFollowers === 1 ? '' : 's'}` : null,
  ].filter(Boolean) as string[]

  const html = `<!doctype html><html><body style="margin:0;background:#f7f2e8;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#101d2f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2e8"><tr><td align="center" style="padding:28px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fffdf8;border-radius:22px;padding:28px 24px">
    <tr><td><a href="${link('/feed')}" style="color:#101d2f;text-decoration:none;font-family:Georgia,serif;font-size:26px;font-weight:600">Savry</a>
      <span style="float:right;color:#596475;font-size:13px;padding-top:8px">Your table, this week</span></td></tr>
    <tr><td style="padding-top:18px;font-family:Georgia,serif;font-size:28px;font-weight:500;line-height:1.15;letter-spacing:-.02em">Hello, ${escape(digest.cook.displayName)}.</td></tr>
    <tr><td style="padding-top:8px;color:#596475;font-size:15px;line-height:1.55">${digest.followingCount > 0 ? 'Here is what the cooks you follow were up to, and what the whole table cooked.' : 'Here is what the table cooked this week. Follow a few cooks and this gets personal.'}</td></tr>
    ${section('From cooks you follow', digest.fromFollowed.map(recipeRow).join(''))}
    ${section('They made this', digest.madeByFollowed.map((m) => `
      <tr><td style="padding:10px 0;border-top:1px solid #ece3d2">
        <a href="${link(`/recipes/${m.recipe.slug}`)}" style="color:#101d2f;text-decoration:none;display:block">
          <img src="${escape(m.photoUrl)}" width="560" alt="" style="display:block;width:100%;max-width:560px;height:auto;border-radius:14px;margin-bottom:10px">
          <strong>${escape(m.cook.displayName)}</strong> made <strong>${escape(m.recipe.title)}</strong>
          ${m.note ? `<br><span style="color:#596475;font-size:14px">“${escape(m.note)}”</span>` : ''}
        </a>
      </td></tr>`).join(''))}
    ${section('On the table this week', digest.trending.map(recipeRow).join(''))}
    ${section('Your week', yourWeek.length ? `<tr><td style="padding:10px 0;border-top:1px solid #ece3d2;font-size:15px;line-height:1.7">${yourWeek.map(escape).join('<br>')}<br><a href="${link('/notifications')}" style="color:#cb4730;font-weight:700;text-decoration:none">See your notifications →</a></td></tr>` : '')}
    <tr><td style="padding-top:28px"><a href="${link('/feed')}" style="display:inline-block;background:#f06449;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">Open your table</a></td></tr>
    <tr><td style="padding-top:28px;color:#8a93a0;font-size:12px;line-height:1.6">You get this once a week because you turned on Savry email in your account. <a href="${unsubscribeUrl}" style="color:#8a93a0">Unsubscribe</a> · <a href="${link('/account')}" style="color:#8a93a0">Email settings</a><br>Savry · Recipes worth keeping</td></tr>
  </table></td></tr></table></body></html>`

  const text = [
    `Hello, ${digest.cook.displayName}.`,
    '',
    digest.fromFollowed.length ? `FROM COOKS YOU FOLLOW\n${digest.fromFollowed.map((r) => `- ${r.title} by ${r.authorName}: ${link(`/recipes/${r.slug}`)}`).join('\n')}\n` : '',
    digest.madeByFollowed.length ? `THEY MADE THIS\n${digest.madeByFollowed.map((m) => `- ${m.cook.displayName} made ${m.recipe.title}: ${link(`/recipes/${m.recipe.slug}`)}`).join('\n')}\n` : '',
    digest.trending.length ? `ON THE TABLE THIS WEEK\n${digest.trending.map((r) => `- ${r.title} by ${r.authorName}: ${link(`/recipes/${r.slug}`)}`).join('\n')}\n` : '',
    yourWeek.length ? `YOUR WEEK\n${yourWeek.map((line) => `- ${line}`).join('\n')}\n` : '',
    `Open your table: ${link('/feed')}`,
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].filter((part) => part !== '').join('\n')

  return { subject, html, text }
}

export function unsubscribeLink(token: string): string {
  return `${SITE_URL}/api/email/unsubscribe?t=${encodeURIComponent(token)}`
}

type Recipient = { userId: string; email: string; displayName: string; username: string | null; emailToken: string }

/** Builds one cook's digest from the database, or null when the cook is gone. */
export async function buildDigest(userId: string, since: Date): Promise<Digest | null> {
  const { data, error } = await getSupabaseAdmin().rpc('weekly_digest', { target: userId, since: since.toISOString() })
  if (error) throw new Error(error.message)
  return (data as Digest | null) ?? null
}

async function sendBatch(messages: { to: string; subject: string; html: string; text: string; unsubscribe: string }[]): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(messages.map((m) => ({
      from: FROM_ADDRESS, to: [m.to], reply_to: REPLY_TO, subject: m.subject, html: m.html, text: m.text,
      headers: { 'List-Unsubscribe': `<${m.unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }))),
  })
  if (response.ok) return { ok: true }
  return { ok: false, error: `Resend ${response.status}: ${(await response.text()).slice(0, 300)}` }
}

/**
 * Sends this week's email to everyone who has not had it. Idempotent: each
 * cook gets at most one per week, quiet weeks are recorded as skipped.
 */
export async function sendWeeklyDigests(options: { dryRun?: boolean; limit?: number } = {}): Promise<{ configured: boolean; week: string; sent: number; skipped: number; failed: number; errors: string[] }> {
  const week = weekStart()
  const result = { configured: isEmailConfigured(), week, sent: 0, skipped: 0, failed: 0, errors: [] as string[] }
  if (!result.configured && !options.dryRun) return result

  const supabase = getSupabaseAdmin()
  const since = new Date(Date.now() - 7 * 86_400_000)
  const { data, error } = await supabase.rpc('digest_recipients', { week_start: week, batch_size: options.limit ?? 100 })
  if (error) throw new Error(error.message)
  const recipients = (data as Recipient[] | null) ?? []

  const outgoing: { userId: string; to: string; subject: string; html: string; text: string; unsubscribe: string }[] = []
  for (const recipient of recipients) {
    const digest = await buildDigest(recipient.userId, since)
    if (!digest || !hasContent(digest)) {
      result.skipped += 1
      if (!options.dryRun) await supabase.rpc('record_digest_send', { target: recipient.userId, week_start: week, send_status: 'skipped' })
      continue
    }
    const unsubscribe = unsubscribeLink(recipient.emailToken)
    outgoing.push({ userId: recipient.userId, to: recipient.email, unsubscribe, ...renderDigest(digest, unsubscribe) })
  }

  if (options.dryRun) {
    result.sent = outgoing.length
    return result
  }

  // Resend takes up to 100 messages per batch call.
  for (let i = 0; i < outgoing.length; i += 100) {
    const chunk = outgoing.slice(i, i + 100)
    const sent = await sendBatch(chunk)
    for (const message of chunk) {
      await supabase.rpc('record_digest_send', { target: message.userId, week_start: week, send_status: sent.ok ? 'sent' : 'failed' })
    }
    if (sent.ok) result.sent += chunk.length
    else {
      result.failed += chunk.length
      result.errors.push(sent.error ?? 'send failed')
    }
  }
  return result
}

/** One message to one address, for the admin's "send me a test". */
export async function sendTestDigest(userId: string, to: string, emailToken: string): Promise<{ ok: boolean; error?: string; empty?: boolean }> {
  if (!isEmailConfigured()) return { ok: false, error: 'RESEND_API_KEY is not set' }
  const digest = await buildDigest(userId, new Date(Date.now() - 7 * 86_400_000))
  if (!digest) return { ok: false, error: 'No profile' }
  const unsubscribe = unsubscribeLink(emailToken)
  const message = renderDigest(digest, unsubscribe)
  const sent = await sendBatch([{ to, unsubscribe, ...message, subject: `[Test] ${message.subject}` }])
  return { ...sent, empty: !hasContent(digest) }
}
