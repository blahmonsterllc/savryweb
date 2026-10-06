import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('one weekly run pages through every recipient, stops before the time limit, and never sends twice', async () => {
  const digest = await source('lib/weekly-digest.ts')
  const run = digest.slice(digest.indexOf('export async function sendWeeklyDigests'), digest.indexOf('/** One message to one address'))
  assert.match(run, /while \(Date\.now\(\) < deadline\)/, 'keeps paging until done or out of time')
  assert.match(run, /result\.complete = !\(data as Recipient\[\] \| null\)\?\.length/, 'says when everyone has been reached')
  assert.ok(run.indexOf("send_status: 'sent'") < run.indexOf('await sendBatch(chunk)'), 'a cook is marked sent before the message goes, so a cut-off run cannot resend it')
  assert.match(run, /send_status: 'failed'/, 'a refused batch is recorded as failed')
  assert.match(run, /!seen\.has\(r\.userId\)/, 'a page of people already handled ends the run instead of looping')

  const cron = await source('pages/api/cron/weekly-email.ts')
  assert.doesNotMatch(cron, /limit: 300/, 'no fixed cap on how many cooks one run reaches')
  assert.match(cron, /export const config = \{ maxDuration: 300 \}/)
  assert.match(cron, /const SEND_WINDOW_MS = \(300 - 60\) \* 1000/, 'the run stops starting pages a minute before the function limit')
  assert.match(cron, /deadline: Date\.now\(\) \+ SEND_WINDOW_MS/)
})

test('unsubscribe: a GET only asks; the button and the one-click POST do it', async () => {
  const route = await source('pages/api/email/unsubscribe.ts')
  const getBranch = route.indexOf("if (req.method === 'GET')")
  assert.ok(getBranch > 0 && getBranch < route.indexOf("rpc('unsubscribe_by_token'"), 'GET returns its confirm page before anything changes')
  assert.match(route, /<form method="post" action="\/api\/email\/unsubscribe\?t=\$\{token\}">/)
  assert.ok(route.indexOf('TOKEN.test(token)') < getBranch, 'the token is checked before it is put in the page')

  const digest = await source('lib/weekly-digest.ts')
  assert.match(digest, /'List-Unsubscribe': `<\$\{m\.unsubscribe\}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'/, 'the header URL is the same address the POST is handled at')
  assert.match(digest, /\/api\/email\/unsubscribe\?t=\$\{encodeURIComponent\(token\)\}/)
})
