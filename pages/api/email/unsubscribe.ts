/**
 * Unsubscribe from the weekly email. The link in every message (and its
 * List-Unsubscribe header) carries the cook's private token; using it turns
 * the email off and burns the token. No sign-in needed, by design.
 *
 * GET only shows a page with an Unsubscribe button and changes nothing: mail
 * security scanners open every link in a message, and a GET that acted would
 * unsubscribe people who never clicked. POST does it: the button's form, and
 * the RFC 8058 one-click POST mail clients send from the List-Unsubscribe-Post
 * header (body `List-Unsubscribe=One-Click`) set in lib/weekly-digest.ts.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { SITE_URL } from '@/lib/site-url'

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} | Savry</title>
<style>body{margin:0;background:#f7f2e8;color:#101d2f;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif}main{max-width:520px;margin:12vh auto;padding:32px 24px;background:#fffdf8;border-radius:22px}h1{font-family:Georgia,serif;font-weight:500;font-size:28px;margin:0 0 12px}p{color:#596475;line-height:1.6}a{color:#cb4730;font-weight:700}button{background:#f06449;color:#fff;border:0;border-radius:999px;padding:12px 22px;font:700 16px -apple-system,Segoe UI,Helvetica,Arial,sans-serif;cursor:pointer}</style></head>
<body><main><h1>${title}</h1>${body}</main></body></html>`

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).end()
  }
  const token = typeof req.query.t === 'string' ? req.query.t : ''
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  if (!TOKEN.test(token)) {
    return res.status(400).send(page('That link has expired', `<p>Unsubscribe links work once. You can turn Savry email off any time from <a href="${SITE_URL}/account">your account</a>.</p>`))
  }
  if (req.method === 'GET') {
    // The token is a UUID (checked above), so it is safe in the form's address as written.
    return res.status(200).send(page('Unsubscribe from Savry email?', `<p>You will stop getting the weekly email. Your account and recipes are untouched.</p>
<form method="post" action="/api/email/unsubscribe?t=${token}"><button type="submit">Unsubscribe</button></form>
<p><a href="${SITE_URL}/account">Keep it, take me to my account</a></p>`))
  }
  const { data, error } = await getSupabaseAdmin().rpc('unsubscribe_by_token', { token })
  if (error) return res.status(500).send(page('Something went wrong', `<p>Please try again, or turn Savry email off from <a href="${SITE_URL}/account">your account</a>.</p>`))
  if (!(data as { found?: boolean } | null)?.found) {
    return res.status(200).send(page('You are already unsubscribed', `<p>This link was used before. Nothing more to do. <a href="${SITE_URL}/account">Email settings</a></p>`))
  }
  return res.status(200).send(page('Unsubscribed', `<p>No more weekly email. Your account and recipes are untouched, and you can turn it back on any time from <a href="${SITE_URL}/account">your account</a>.</p>`))
}
