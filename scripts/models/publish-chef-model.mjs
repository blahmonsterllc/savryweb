#!/usr/bin/env node
/**
 * Publish an exported Core AI model folder to Savry's Supabase storage so the
 * iOS 27 app can download it on demand.
 *
 *   node scripts/models/publish-chef-model.mjs --dir ~/Desktop/savry-models/qwen3-0.6b-ios --version 2026.10.01 \
 *        [--name savry-chef] [--display "Savry Chef"] [--summary "..."] [--min-memory-gb 6] [--dry-run]
 *
 * Uploads every file under --dir to  models/<name>/<version>/<relative path>
 * and then writes  models/<name>/manifest.json  listing them with sizes and
 * SHA-256. Files larger than the storage upload cap are published in 40 MB
 * parts (<path>.part000, …); the app downloads the parts, joins them, and
 * verifies the whole file against its hash.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or
 * SUPABASE_SERVICE_ROLE_KEY) in the environment. Public read is granted by the
 * 20261001000000_models_bucket migration; only the service role can write.
 * Memory use stays under ~100 MB: files are hashed and split by streaming.
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { open, readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const PART_BYTES = 40 * 1024 * 1024

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

function sha256File(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path).on('data', (chunk) => hash.update(chunk)).on('end', () => resolve(hash.digest('hex'))).on('error', reject)
  })
}

/** Read one part of a file into memory (at most PART_BYTES). */
async function readPart(path, index) {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(PART_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, PART_BYTES, index * PART_BYTES)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
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
  let metadata
  try {
    metadata = JSON.parse(await readFile(join(dir, 'metadata.json'), 'utf8'))
  } catch {
    throw new Error(`${dir} has no metadata.json; point --dir at the exported model folder`)
  }

  // Plan: hash every file, and split the big ones into parts.
  const files = []
  for (const file of await walk(dir)) {
    const rel = relative(dir, file).split(sep).join('/')
    const { size } = await stat(file)
    const entry = { local: file, path: `${version}/${rel}`, bytes: size, sha256: await sha256File(file) }
    if (size > PART_BYTES) {
      entry.parts = []
      for (let index = 0; index * PART_BYTES < size; index++) {
        const data = await readPart(file, index)
        entry.parts.push({ path: `${entry.path}.part${String(index).padStart(3, '0')}`, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), index })
      }
    }
    files.push(entry)
  }
  const total = files.reduce((sum, f) => sum + f.bytes, 0)
  const uploads = files.reduce((sum, f) => sum + (f.parts ? f.parts.length : 1), 0)
  console.log(`${files.length} files, ${(total / 1048576).toFixed(0)} MB, ${uploads} uploads → models/${name}/${version}/`)

  const manifest = {
    name,
    version,
    displayName: arg('display', 'Savry Chef'),
    summary: arg(
      'summary',
      'A cooking model that runs entirely on your iPhone. Better recipes, substitutions, and plans than the general-purpose model, with nothing sent off the device.'
    ),
    minimumMemoryGB: Number(arg('min-memory-gb', '6')),
    model: metadata.name ?? null,
    source: metadata.source?.hf_model_id ?? null,
    publishedAt: new Date().toISOString(),
    files: files.map((f) => ({
      path: f.path,
      bytes: f.bytes,
      sha256: f.sha256,
      ...(f.parts ? { parts: f.parts.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })) } : {}),
    })),
  }
  if (dryRun) {
    console.log(JSON.stringify(manifest, null, 2))
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secret) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required')
  const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const bucket = supabase.storage.from('models')

  async function put(key, body, attempt = 1) {
    const { error } = await bucket.upload(key, body, { upsert: true, contentType: 'application/octet-stream', cacheControl: '31536000' })
    if (!error) return
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000))
      return put(key, body, attempt + 1)
    }
    throw new Error(`${key}: ${error.message}`)
  }

  let done = 0
  for (const file of files) {
    if (file.parts) {
      for (const part of file.parts) {
        await put(`${name}/${part.path}`, await readPart(file.local, part.index))
        console.log(`  [${++done}/${uploads}] ${part.path} (${(part.bytes / 1048576).toFixed(1)} MB)`)
      }
    } else {
      await put(`${name}/${file.path}`, await readFile(file.local))
      console.log(`  [${++done}/${uploads}] ${file.path} (${(file.bytes / 1048576).toFixed(1)} MB)`)
    }
  }

  // The manifest goes last so a half-finished upload is never advertised.
  const { error } = await bucket.upload(`${name}/manifest.json`, Buffer.from(JSON.stringify(manifest, null, 2)), {
    upsert: true,
    contentType: 'application/json',
    cacheControl: '300',
  })
  if (error) throw new Error(`manifest: ${error.message}`)
  console.log(`Published ${name} ${version}: ${url}/storage/v1/object/public/models/${name}/manifest.json`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
