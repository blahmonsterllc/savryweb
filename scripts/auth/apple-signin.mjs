#!/usr/bin/env node
/**
 * Configure Sign in with Apple for the Savry Supabase project.
 *
 *   node scripts/auth/apple-signin.mjs secret --key ./AuthKey_ABC123.p8 --key-id ABC123 --team-id TEAMID --services-id io.savry.web
 *       Prints the Apple client secret (an ES256 JWT, valid 6 months).
 *
 *   node scripts/auth/apple-signin.mjs apply  --key ./AuthKey_ABC123.p8 --key-id ABC123 --team-id TEAMID --services-id io.savry.web --bundle-id recipe.foodprep
 *       Generates the secret and writes it plus the client ids to the Supabase
 *       project (Authentication → Providers → Apple) through the Management API.
 *
 * The Management API token comes from `supabase login` (read from the macOS
 * keychain) or SUPABASE_ACCESS_TOKEN. No dependencies beyond Node 18+.
 */
import { createPrivateKey, createSign } from 'node:crypto'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'qnpekzrchqftdoaebzuf'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/** Apple client secret: ES256 JWT signed with the Sign in with Apple key. */
export function appleClientSecret({ keyPem, keyId, teamId, servicesId, months = 6 }) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId }))
  const payload = base64url(JSON.stringify({ iss: teamId, iat: now, exp: now + months * 30 * 24 * 3600, aud: 'https://appleid.apple.com', sub: servicesId }))
  const signer = createSign('SHA256')
  signer.update(`${header}.${payload}`)
  const signature = signer.sign({ key: createPrivateKey(keyPem), dsaEncoding: 'ieee-p1363' })
  return `${header}.${payload}.${base64url(signature)}`
}

function accessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN
  try {
    const raw = execSync('security find-generic-password -s "Supabase CLI" -w', { encoding: 'utf8' }).trim()
    return raw.startsWith('go-keyring-base64:') ? Buffer.from(raw.slice('go-keyring-base64:'.length), 'base64').toString('utf8') : raw
  } catch {
    throw new Error('Run `supabase login` first or set SUPABASE_ACCESS_TOKEN')
  }
}

async function main() {
  const command = process.argv[2]
  const keyPath = arg('key')
  const keyId = arg('key-id')
  const teamId = arg('team-id')
  const servicesId = arg('services-id')
  const bundleId = arg('bundle-id', 'recipe.foodprep')
  if (!['secret', 'apply'].includes(command) || !keyPath || !keyId || !teamId || !servicesId) {
    console.error('usage: apple-signin.mjs <secret|apply> --key AuthKey.p8 --key-id KEYID --team-id TEAMID --services-id io.savry.web [--bundle-id recipe.foodprep]')
    process.exit(1)
  }
  const secret = appleClientSecret({ keyPem: readFileSync(keyPath, 'utf8'), keyId, teamId, servicesId })
  if (command === 'secret') {
    console.log(secret)
    return
  }

  const body = {
    external_apple_enabled: true,
    // Web sign-in uses the Services ID; the iPhone app sends id_tokens whose audience is the bundle id.
    external_apple_client_id: servicesId,
    external_apple_additional_client_ids: bundleId,
    external_apple_secret: secret,
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('Supabase rejected the update:', res.status, data)
    process.exit(1)
  }
  console.log('Apple sign-in configured on project', PROJECT_REF)
  console.log('  client id (web):', data.external_apple_client_id)
  console.log('  additional ids (app):', data.external_apple_additional_client_ids)
  console.log('  secret set; it expires in 6 months. Re-run this command before', new Date(Date.now() + 180 * 86400e3).toDateString())
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
