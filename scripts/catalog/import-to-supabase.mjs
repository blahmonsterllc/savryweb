#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

const ROOT = resolve(import.meta.dirname, '../..')
const CANDIDATES = resolve(ROOT, 'content/launch-catalog/wikibooks-candidates.jsonl')
const MANIFEST = resolve(ROOT, 'content/launch-catalog/manifest.json')

function argument(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function projectRef(url) {
  return new URL(url).hostname.split('.')[0]
}

async function main() {
  const commit = process.argv.includes('--commit')
  const expectedProjectRef = argument('--project-ref')
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'))
  const candidates = (await readFile(CANDIDATES, 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))

  if (candidates.length !== 500 || manifest.candidateCount !== 500) {
    throw new Error(`Refusing catalog with ${candidates.length} rows; expected exactly 500`)
  }
  if (candidates.some((row) => row.publicationStatus !== 'draft' || row.review.status !== 'needs_review')) {
    throw new Error('Every imported candidate must remain a needs_review draft')
  }

  const summary = {
    mode: commit ? 'commit' : 'dry-run',
    catalogHash: manifest.catalogHash,
    candidateCount: candidates.length,
    collections: manifest.collections,
  }
  if (!commit) {
    console.log(JSON.stringify(summary, null, 2))
    console.log('Dry run only. Add --commit --project-ref <ref> after applying the staging migration.')
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secret) throw new Error('Supabase URL and secret/service-role key are required')
  if (!expectedProjectRef || projectRef(url) !== expectedProjectRef) {
    throw new Error(`Project guard failed. URL points to ${projectRef(url)}; expected ${expectedProjectRef ?? '<missing>'}`)
  }

  const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: batch, error: batchError } = await supabase
    .from('recipe_catalog_batches')
    .upsert(
      {
        catalog_hash: manifest.catalogHash,
        source_name: manifest.source.name,
        source_license_name: manifest.source.licenseName,
        source_license_url: manifest.source.licenseURL,
        candidate_count: candidates.length,
        manifest,
      },
      { onConflict: 'catalog_hash' },
    )
    .select('id')
    .single()
  if (batchError) throw batchError

  for (let offset = 0; offset < candidates.length; offset += 100) {
    const rows = candidates.slice(offset, offset + 100).map((candidate) => ({
      batch_id: batch.id,
      external_id: candidate.candidateID,
      source_content_hash: candidate.provenance.sourceContentHash,
      title: candidate.title,
      planned_collection: candidate.plannedCollection,
      source_url: candidate.provenance.sourceURL,
      source_revision_id: candidate.provenance.sourceRevisionID,
      license_name: candidate.provenance.licenseName,
      license_url: candidate.provenance.licenseURL,
      attribution_text: candidate.provenance.attributionText,
      source_payload: candidate,
      status: 'needs_review',
      text_rights_confirmed: candidate.rights.textRightsConfirmed,
    }))
    const { error } = await supabase
      .from('recipe_catalog_candidates')
      .upsert(rows, { onConflict: 'external_id', ignoreDuplicates: false })
    if (error) throw error
    console.log(`Imported ${Math.min(offset + rows.length, candidates.length)}/${candidates.length}`)
  }
  console.log(JSON.stringify({ ...summary, batchID: batch.id }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

