#!/usr/bin/env node
/**
 * Point the Savry Supabase project's auth emails (confirmations, password
 * resets, email changes) at Resend, and give them Savry subjects.
 *
 *   node scripts/auth/smtp.mjs check  --key-file ~/Downloads/resend.key
 *       Confirms the sending domain's Resend DKIM record is published.
 *
 *   node scripts/auth/smtp.mjs apply  --key-file ~/Downloads/resend.key [--from hello@savry.io] [--name Savry]
 *       Writes the SMTP settings + subjects to Supabase (Authentication → SMTP).
 *
 * The Resend key comes from --key-file or RESEND_API_KEY. Give the key
 * "Sending access" only; it is stored by Supabase as the SMTP password.
 * The Supabase Management API token comes from `supabase login`.
 */
import { execSync } from 'node:child_process'
import { resolveTxt } from 'node:dns/promises'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'qnpekzrchqftdoaebzuf'
const SMTP = { host: 'smtp.resend.com', port: 465, user: 'resend' }

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}

function resendKey() {
  const file = arg('key-file')
  const key = file ? readFileSync(file, 'utf8').trim() : process.env.RESEND_API_KEY
  if (!key || !key.startsWith('re_')) throw new Error('Provide a Resend API key via --key-file or RESEND_API_KEY (it starts with re_)')
  return key
}

function supabaseToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN
  try {
    const raw = execSync('security find-generic-password -s "Supabase CLI" -w', { encoding: 'utf8' }).trim()
    return raw.startsWith('go-keyring-base64:') ? Buffer.from(raw.slice('go-keyring-base64:'.length), 'base64').toString('utf8') : raw
  } catch {
    throw new Error('Run `supabase login` first or set SUPABASE_ACCESS_TOKEN')
  }
}

/** Subjects and bodies for the auth emails. Supabase fills the template variables. */
export function emailSettings({ from, name }) {
  const wrap = (heading, body, cta) => `
<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1f2937">
  <p style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#0e7490;margin:0 0 16px">Savry</p>
  <h1 style="font-size:22px;margin:0 0 12px">${heading}</h1>
  <p style="font-size:16px;line-height:1.5;margin:0 0 24px">${body}</p>
  <p style="margin:0 0 24px"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#0e7490;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">${cta}</a></p>
  <p style="font-size:13px;line-height:1.5;color:#6b7280;margin:0">If you didn’t ask for this, you can ignore this email. The link expires in an hour.</p>
</div>`
  return {
    smtp_admin_email: from,
    smtp_sender_name: name,
    mailer_subjects_confirmation: 'Confirm your Savry account',
    mailer_templates_confirmation_content: wrap('Welcome to Savry', 'Confirm your email to start sharing recipes, tweaks, and “I made it” photos with other home cooks.', 'Confirm my email'),
    mailer_subjects_recovery: 'Reset your Savry password',
    mailer_templates_recovery_content: wrap('Reset your password', 'Tap the button to choose a new password for your Savry account.', 'Choose a new password'),
    mailer_subjects_email_change: 'Confirm your new email for Savry',
    mailer_templates_email_change_content: wrap('Confirm your new email', 'Confirm that you want to use this address for your Savry account.', 'Confirm new email'),
    mailer_subjects_magic_link: 'Your Savry sign-in link',
    mailer_templates_magic_link_content: wrap('Sign in to Savry', 'Tap the button to sign in. No password needed.', 'Sign in'),
  }
}

/**
 * A sending-only key (the kind we want) cannot list domains, so verification
 * is read from DNS: Resend publishes DKIM at resend._domainkey.<domain> once
 * the records are in place, and refuses to send until they are.
 */
async function domainVerified(domain) {
  try {
    const records = await resolveTxt(`resend._domainkey.${domain}`)
    return records.some((chunks) => chunks.join('').startsWith('p='))
  } catch {
    return false
  }
}

async function main() {
  const command = process.argv[2]
  const from = arg('from', 'hello@savry.io')
  const name = arg('name', 'Savry')
  if (!['check', 'apply'].includes(command)) {
    console.error('usage: smtp.mjs <check|apply> --key-file resend.key [--from hello@savry.io] [--name Savry]')
    process.exit(1)
  }
  const key = resendKey()
  const sendingDomain = from.split('@')[1]
  if (!(await domainVerified(sendingDomain))) {
    console.error(`${sendingDomain} has no Resend DKIM record yet. Add the domain at https://resend.com/domains, publish its DNS records, and wait for "Verified".`)
    process.exit(2)
  }
  console.log(`${sendingDomain}: Resend DKIM record found`)
  if (command === 'check') {
    console.log('Ready to apply.')
    return
  }

  const body = {
    smtp_host: SMTP.host,
    smtp_port: SMTP.port,
    smtp_user: SMTP.user,
    smtp_pass: key,
    smtp_max_frequency: 60,
    rate_limit_email_sent: 60,
    ...emailSettings({ from, name }),
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${supabaseToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('Supabase rejected the update:', res.status, data)
    process.exit(1)
  }
  console.log('Auth email configured on project', PROJECT_REF)
  console.log('  smtp:', data.smtp_host, data.smtp_port, 'as', data.smtp_user)
  console.log('  sender:', data.smtp_sender_name, `<${data.smtp_admin_email}>`)
  console.log('  emails per hour:', data.rate_limit_email_sent)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
