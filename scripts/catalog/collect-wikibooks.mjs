#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://en.wikibooks.org/w/api.php'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const OUTPUT = resolve(ROOT, 'content/launch-catalog/wikibooks-candidates.jsonl')
const MANIFEST = resolve(ROOT, 'content/launch-catalog/manifest.json')
const LIMIT = 500
const SEED = 'savry-launch-catalog-v1'
const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/'

const QUOTAS = {
  'Dinner & mains': 140,
  'Breakfast & brunch': 50,
  'Lunch & handhelds': 45,
  'Soups & stews': 45,
  'Sides & salads': 55,
  'Desserts & baking': 75,
  'Sauces & staples': 35,
  'Snacks & drinks': 55,
}

function apiURL(parameters) {
  const url = new URL(API)
  for (const [key, value] of Object.entries({ action: 'query', format: 'json', formatversion: '2', ...parameters })) {
    url.searchParams.set(key, String(value))
  }
  return url
}

async function getJSON(parameters) {
  const response = await fetch(apiURL(parameters), {
    headers: { 'user-agent': 'SavryCatalogBuilder/1.0 (https://savry.io)' },
  })
  if (!response.ok) throw new Error(`Wikibooks API returned ${response.status}`)
  return response.json()
}

async function listRecipePages() {
  const pages = []
  let cmcontinue
  do {
    const body = await getJSON({
      list: 'categorymembers',
      cmtitle: 'Category:Recipes',
      cmtype: 'page',
      cmnamespace: '102',
      cmlimit: '500',
      ...(cmcontinue ? { cmcontinue } : {}),
    })
    pages.push(...body.query.categorymembers)
    cmcontinue = body.continue?.cmcontinue
  } while (cmcontinue)
  return pages
}

async function loadPages(pageIDs) {
  const loaded = []
  for (let offset = 0; offset < pageIDs.length; offset += 50) {
    const pageids = pageIDs.slice(offset, offset + 50).join('|')
    const body = await getJSON({
      prop: 'revisions|categories',
      pageids,
      rvprop: 'ids|timestamp|content',
      rvslots: 'main',
      cllimit: 'max',
    })
    loaded.push(...body.query.pages)
    if (offset > 0 && offset % 500 === 0) {
      process.stderr.write(`Loaded ${offset}/${pageIDs.length} source pages\n`)
    }
  }
  return loaded
}

function replaceTemplates(value) {
  let text = value
  for (let pass = 0; pass < 8; pass += 1) {
    const next = text.replace(/\{\{([^{}]+)\}\}/g, (_, body) => {
      const parts = body.split('|').map((part) => part.trim())
      const name = parts.shift()?.toLowerCase() ?? ''
      const positional = parts.filter((part) => part && !part.includes('='))
      if (name === 'convert' && positional.length >= 2) return `${positional[0]} ${positional[1]}`
      if (name === 'frac' && positional.length === 2) return `${positional[0]}/${positional[1]}`
      if (name === 'frac' && positional.length >= 3) return `${positional[0]} ${positional[1]}/${positional[2]}`
      if (['nowrap', 'nobreak', 'small'].includes(name)) return positional.join(' ')
      return positional.join(' ')
    })
    if (next === text) break
    text = next
  }
  return text
}

function plainText(value) {
  return replaceTemplates(value)
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref\b[^/>]*\/>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\[(?:https?:\/\/\S+)\s+([^\]]+)\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/'{2,}/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function section(source, names) {
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const pattern = new RegExp(
    `^==+\\s*(?:${escaped})\\s*==+\\s*$([\\s\\S]*?)(?=^==+[^=]|(?![\\s\\S]))`,
    'im',
  )
  return source.match(pattern)?.[1] ?? ''
}

function bulletLines(source, marker) {
  const prefix = marker === '*' ? /^\*+\s*(.+)$/gm : /^#+\s*(.+)$/gm
  return [...source.matchAll(prefix)]
    .map((match) => plainText(match[1]))
    .filter((line) => line.length >= 2)
}

function summaryField(source, field) {
  const summary = source.match(/\{\{recipesummary\|([\s\S]*?)\}\}/i)?.[1] ?? ''
  return plainText(summary.match(new RegExp(`(?:^|\\|)\\s*${field}\\s*=\\s*([^|\\n}]+)`, 'i'))?.[1] ?? '')
}

function collectionFor(page) {
  const haystack = `${page.title} ${(page.categories ?? []).map((item) => item.title).join(' ')}`.toLowerCase()
  if (/pet recipe/.test(haystack)) return null
  if (/breakfast|brunch|omelette|porridge|pancake|waffle/.test(haystack)) return 'Breakfast & brunch'
  if (/dessert|cake|cookie|brownie|pie|tart|pastr|pudding|custard|candy|confection|ice cream|frosting|sweet bread|muffin|scone/.test(haystack)) return 'Desserts & baking'
  if (/soup|stew|chowder|bisque|gumbo/.test(haystack)) return 'Soups & stews'
  if (/salad|side dish|vegetable dish/.test(haystack)) return 'Sides & salads'
  if (/sauce|condiment|dressing|spice mix|seasoning|stock|broth|syrup|pickle|jam|jelly/.test(haystack)) return 'Sauces & staples'
  if (/snack|beverage|drink|tea|coffee|smoothie|juice|cocktail|dip recipe/.test(haystack)) return 'Snacks & drinks'
  if (/sandwich|wrap|burger|pizza|taco|burrito|quesadilla|lunch/.test(haystack)) return 'Lunch & handhelds'
  return 'Dinner & mains'
}

function stableScore(pageID) {
  return createHash('sha256').update(`${SEED}:${pageID}`).digest('hex')
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100)
}

function candidateFromPage(page) {
  const revision = page.revisions?.[0]
  const source = revision?.slots?.main?.content ?? ''
  const ingredients = bulletLines(section(source, ['Ingredients']), '*')
  const instructions = bulletLines(
    section(source, ['Procedure', 'Directions', 'Method', 'Preparation', 'Instructions']),
    '#',
  )
  const collection = collectionFor(page)
  if (!revision || !collection || ingredients.length < 2 || instructions.length < 1) return null

  const title = page.title.replace(/^Cookbook:/, '').trim()
  const sourceURL = `https://en.wikibooks.org/w/index.php?title=${encodeURIComponent(page.title)}&oldid=${revision.revid}`
  const servingsText = summaryField(source, 'servings')
  const servings = Number.parseInt(servingsText.match(/\d+/)?.[0] ?? '', 10)
  const difficultyCode = summaryField(source, 'difficulty')
  const difficulty = { '1': 'Easy', '2': 'Medium', '3': 'Hard' }[difficultyCode] ?? null
  const sourceContentHash = `sha256:${createHash('sha256').update(source).digest('hex')}`

  return {
    schemaVersion: 1,
    candidateID: `wikibooks-${page.pageid}-${revision.revid}`,
    slug: slugify(title),
    title,
    plannedCollection: collection,
    description: null,
    servings: Number.isFinite(servings) && servings > 0 ? servings : null,
    servingType: 'servings',
    timeSourceText: summaryField(source, 'time') || null,
    difficulty,
    ingredients: ingredients.map((text, position) => ({ position, sourceText: text })),
    instructions: instructions.map((instruction, position) => ({ position, instruction })),
    sourceCategories: (page.categories ?? []).map((item) => item.title.replace(/^Category:/, '')).sort(),
    provenance: {
      origin: 'licensed_creator',
      sourceName: 'Wikibooks Cookbook',
      sourceURL,
      sourcePageID: page.pageid,
      sourceRevisionID: revision.revid,
      sourceRevisionTimestamp: revision.timestamp,
      sourceContentHash,
      originalAuthor: 'Wikibooks contributors',
      licenseName: 'Creative Commons Attribution-ShareAlike 4.0 International',
      licenseURL: LICENSE_URL,
      attributionText: `Adapted from “${title}” by Wikibooks contributors, revision ${revision.revid}, licensed CC BY-SA 4.0.`,
    },
    rights: {
      commercialUseAllowed: true,
      adaptationAllowed: true,
      attributionRequired: true,
      shareAlikeRequired: true,
      textRightsConfirmed: true,
      photoRightsConfirmed: false,
    },
    review: {
      status: 'needs_review',
      measurementsChecked: false,
      instructionsChecked: false,
      allergenFlagsChecked: false,
      nutritionProvenanceChecked: false,
      foodSafetyChecked: false,
      attributionChecked: false,
      kitchenTested: false,
    },
    publicationStatus: 'draft',
  }
}

function selectBalanced(candidates) {
  const selected = []
  const counts = Object.fromEntries(Object.keys(QUOTAS).map((name) => [name, 0]))
  const ordered = [...candidates].sort((a, b) => stableScore(a.candidateID).localeCompare(stableScore(b.candidateID)))
  for (const candidate of ordered) {
    const collection = candidate.plannedCollection
    if (counts[collection] >= QUOTAS[collection]) continue
    selected.push(candidate)
    counts[collection] += 1
  }
  const missing = Object.entries(QUOTAS).filter(([name, quota]) => counts[name] < quota)
  if (missing.length) {
    throw new Error(`Not enough reviewable recipes for quotas: ${JSON.stringify({ counts, missing })}`)
  }
  return { selected, counts }
}

async function main() {
  const index = await listRecipePages()
  process.stderr.write(`Found ${index.length} Wikibooks recipe pages\n`)
  const pages = await loadPages(index.map((page) => page.pageid))
  const candidates = pages.map(candidateFromPage).filter(Boolean)
  const { selected, counts } = selectBalanced(candidates)
  if (selected.length !== LIMIT) throw new Error(`Expected ${LIMIT} candidates, received ${selected.length}`)

  await mkdir(dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, `${selected.map((item) => JSON.stringify(item)).join('\n')}\n`)
  const catalogHash = `sha256:${createHash('sha256').update(selected.map((item) => item.provenance.sourceContentHash).join('\n')).digest('hex')}`
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: 'candidate_review_queue',
    publishableRecipes: 0,
    candidateCount: selected.length,
    parsedCandidateCount: candidates.length,
    sourcePageCount: index.length,
    collections: counts,
    source: {
      name: 'Wikibooks Cookbook',
      categoryURL: 'https://en.wikibooks.org/wiki/Category:Recipes',
      licenseName: 'Creative Commons Attribution-ShareAlike 4.0 International',
      licenseURL: LICENSE_URL,
    },
    catalogHash,
    warning: 'Candidates are drafts. Editorial and rights checks are required before database import or publication.',
  }
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
