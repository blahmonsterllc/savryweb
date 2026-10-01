#!/usr/bin/env node
/**
 * Publish an exported Core AI model folder to Savry's Supabase storage so the
 * iOS 27 app can download it on demand.
 *
 *   node scripts/models/publish-chef-model.mjs --dir ./export/Qwen3-0.6B --version 2026.10.01 \
 *        [--name savry-chef] [--display "Savry Chef"] [--summary "..."] [--min-memory-gb 6] [--dry-run]
 *
 * Uploads every file under --dir to  models/<name>/<version>/<relative path>
 * and writes  models/<name>/manifest.json  listing them with sizes and SHA-256,
 * which the app verifies file by file. Needs NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in the environment, as
 * for the other server-side scripts. Public read is granted by the
 * 20261001000000_models_bucket migration.
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full)))
    else if (!entry.name.startsWith('.')) out.push(full)
  }
  return out
}

function sha256(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path).on('data', (chunk) => hash.update(chunk)).on('end', () => resolve(hash.digest('hex'))).on('error', reject)
  })
}

async function main() {
  const dir = arg('dir')
  const version = arg('version')
  const name = arg('name', 'savry-chef')
  const dryRun = process.argv.includes('--dry-run')
  if (!dir || !version || !/^[A-Za-z0-9._-]+$/.test(version)) {
    console.error('usage: publish-chef-model.mjs --dir <export folder> --version <YYYY.MM.DD or semver> [--name savry-chef] [--dry-run]')
    process.exit(1)
  }
  let metadata = null
  try {
    metadata = JSON.parse(await readFile(join(dir, 'metadata.json'), 'utf8'))
  } catch {
    throw new Error(`${dir} has no metadata.json; point --dir at the exported model folder`)
  }
  const files = await walk(dir)
  const entries = []
  for (const file of files) {
    const rel = relative(dir, file).split(sep).join('/')
    const info = await stat(file)
    entries.push({ path: rel, bytes: info.size, sha256: await sha256(file) })
  }
  const manifest = {
    name,
    version,
    displayName: arg('display', 'Savry Chef'),
    summary: arg('summary', `Savry's cooking model (${metadata?.name ?? 'Core AI'}), running entirely on your iPhone. Better recipes, substitutions, and plans than the general model, with nothing sent off the device.`),
    minimumMemoryGB: Number(arg('min-memory-gb', '6')),
    model: metadata?.name ?? null,
    publishedAt: new Date().toISOString(),
    files: entries.map((e) => ({ ...e, path: `${version}/${e.path}` })),
  }
  const total = entries.reduce((sum, e) => sum + e.bytes, 0)
  console.log(`${entries.length} files, ${(total / 1048576).toFixed(0)} MB → models/${name}/${version}/`)
  if (dryRun) {
    console.log(JSON.stringify(manifest, null, 2))
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secret) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required')
  const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })

  for (const [index, entry] of entries.entries()) {
    const body = await readFile(join(dir, entry.path))
    const key = `${name}/${version}/${entry.path}`
    const { error } = await supabase.storage.from('models').upload(key, body, { upsert: true, contentType: 'application/octet-stream', cacheControl: '31536000' })
    if (error) throw new Error(`${key}: ${error.message}`)
    console.log(`  [${index + 1}/${entries.length}] ${key} (${(entry.bytes / 1048576).toFixed(1)} MB)`)
  }
  // The manifest goes last so a half-finished upload is never advertised.
  const { error } = await supabase.storage.from('models').upload(`${name}/manifest.json`, Buffer.from(JSON.stringify(manifest, null, 2)), {
    upsert: true,
    contentType: 'application/json',
    cacheControl: '300',
  })
  if (error) throw error
  console.log(`Published ${name} ${version}. Manifest: ${url}/storage/v1/object/public/models/${name}/manifest.json`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
