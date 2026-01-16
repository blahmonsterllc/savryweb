import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { db } from '@/lib/firebase'
import { Timestamp } from 'firebase-admin/firestore'

/**
 * Admin-only (middleware protected):
 * Fetch a weekly-ad URL and import deals ONLY if they can be extracted deterministically.
 *
 * This endpoint will NEVER fabricate deals/prices. If the page is JS-only (no embedded JSON),
 * it returns an explanatory error so you can fall back to manual verified import.
 */

const reqSchema = z.object({
  storeName: z.string().min(1),
  zipCode: z.string().min(1),
  location: z.string().optional().nullable(),
  sourceUrl: z.string().url(),
  // optional override for validity; otherwise defaults to 7 days from now
  validUntil: z.string().datetime().optional(),
})

type ExtractedDeal = {
  itemName: string
  category: string | null
  originalPrice: number | null
  discountPrice: number
  aisle: string | null
  section: string | null
  imageUrl: string | null
  description: string | null
}

function parseNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.]/g, '')
    const n = Number.parseFloat(cleaned)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function tryExtractNextData(html: string): any | null {
  const $ = cheerio.load(html)
  const text = $('#__NEXT_DATA__').first().text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function tryExtractJsonFromScripts(html: string): any[] {
  const $ = cheerio.load(html)
  const out: any[] = []

  // Common patterns used by React apps / SSR frameworks
  const candidates: Array<{ selector: string; attr?: string }> = [
    { selector: '#__NEXT_DATA__' },
    { selector: 'script[type="application/json"]' },
    { selector: 'script[type="application/ld+json"]' },
  ]

  for (const c of candidates) {
    $(c.selector).each((_, el) => {
      const txt = $(el).text()
      if (!txt) return
      try {
        const parsed = JSON.parse(txt)
        out.push(parsed)
      } catch {
        // ignore
      }
    })
  }

  return out
}

function treeExtractDeals(root: any): ExtractedDeal[] {
  const deals: ExtractedDeal[] = []

  const visit = (node: any) => {
    if (!node) return
    if (Array.isArray(node)) {
      for (const n of node) visit(n)
      return
    }
    if (typeof node !== 'object') return

    const title = node.title || node.name || node.itemName || node.productName
    const current = node.currentPrice || node.price || node.salePrice || node.sale_price || node.offerPrice
    const reg = node.regularPrice || node.originalPrice || node.wasPrice || node.regular_price

    const titleStr = typeof title === 'string' ? title.trim() : ''
    const discountPrice = parseNumber(current)
    const originalPrice = parseNumber(reg)

    if (titleStr && discountPrice != null && discountPrice > 0) {
      deals.push({
        itemName: titleStr,
        category: typeof node.category === 'string' ? node.category : null,
        originalPrice,
        discountPrice,
        aisle: null,
        section: null,
        imageUrl:
          typeof node.imageUrl === 'string'
            ? node.imageUrl
            : typeof node.image_url === 'string'
              ? node.image_url
              : null,
        description: typeof node.description === 'string' ? node.description : null,
      })
      return
    }

    for (const v of Object.values(node)) visit(v)
  }

  visit(root)

  const seen = new Set<string>()
  const uniq: ExtractedDeal[] = []
  for (const d of deals) {
    const k = `${d.itemName.toLowerCase()}|${d.discountPrice}`
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(d)
  }
  return uniq
}

/**
 * Target weekly-ad pages are often JS-driven. When they embed __NEXT_DATA__,
 * we can try to locate offer items in the JSON tree.
 *
 * This is intentionally conservative: if we can't find a clear array of items
 * with name+price, we return an empty list (no guessing).
 */
function extractDealsFromTargetNextData(nextData: any): ExtractedDeal[] {
  return treeExtractDeals(nextData)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { storeName, zipCode, location, sourceUrl, validUntil } = reqSchema.parse(req.body)

    const response = await axios.get(sourceUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    })

    const html = String(response.data || '')
    const nextData = tryExtractNextData(html)
    const scriptJsonBlobs = tryExtractJsonFromScripts(html)

    if (!nextData && scriptJsonBlobs.length === 0) {
      return res.status(422).json({
        success: false,
        message:
          'Could not find embedded JSON on this page (likely JS-rendered). For top-notch accuracy, use /api/deals/import with verified data for now.',
        storeName,
        zipCode,
        sourceUrl,
      })
    }

    let extracted: ExtractedDeal[] = []
    if (storeName.toLowerCase().includes('target')) {
      extracted = nextData ? extractDealsFromTargetNextData(nextData) : []
      if (extracted.length === 0) {
        // Try other JSON blobs if __NEXT_DATA__ isn't sufficient
        for (const blob of scriptJsonBlobs) {
          extracted = treeExtractDeals(blob)
          if (extracted.length > 0) break
        }
      }
    } else if (
      storeName.toLowerCase().includes('stop') ||
      storeName.toLowerCase().includes('shop')
    ) {
      // Stop & Shop circular appears to be JS-driven. We attempt extraction from any embedded JSON.
      // If the page doesn't contain embedded data, we will return 422 (no guessing).
      if (nextData) extracted = treeExtractDeals(nextData)
      if (extracted.length === 0) {
        for (const blob of scriptJsonBlobs) {
          extracted = treeExtractDeals(blob)
          if (extracted.length > 0) break
        }
      }
    } else {
      // Placeholder: add other store-specific extractors here (Stop & Shop, etc.)
      extracted = []
    }

    if (extracted.length === 0) {
      return res.status(422).json({
        success: false,
        message:
          'Page was fetched, but no deterministic deals could be extracted. This endpoint will not guess. Use /api/deals/import with verified data.',
        storeName,
        zipCode,
        sourceUrl,
      })
    }

    const now = Timestamp.now()
    const validUntilDate = validUntil ? new Date(validUntil) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const batch = db.batch()
    for (const deal of extracted) {
      const ref = db.collection('supermarketDiscounts').doc()
      const discountPercent =
        deal.originalPrice && deal.originalPrice > 0
          ? Math.round(((deal.originalPrice - deal.discountPrice) / deal.originalPrice) * 100)
          : null

      batch.set(ref, {
        storeName,
        location: location ?? null,
        zipCode,
        itemName: deal.itemName,
        itemNameLower: deal.itemName.toLowerCase(),
        category: deal.category,
        originalPrice: deal.originalPrice,
        discountPrice: deal.discountPrice,
        discountPercent,
        validUntil: validUntilDate,
        aisle: deal.aisle,
        section: deal.section,
        aisleSource: deal.aisle ? 'PROVIDED' : 'UNKNOWN',
        dealSource: 'URL_IMPORT',
        sourceProvider: storeName,
        sourceUrl,
        verifiedAt: now,
        imageUrl: deal.imageUrl,
        description: deal.description,
        createdAt: now,
        updatedAt: now,
      })
    }

    await batch.commit()

    return res.status(200).json({
      success: true,
      imported: extracted.length,
      storeName,
      zipCode,
      sourceUrl,
      validUntil: validUntilDate.toISOString(),
      note:
        'Imported only deterministically extracted items. If you see missing deals, use manual verified import until a dedicated store extractor is implemented.',
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', errors: error.errors })
    }
    console.error('Import-from-url error:', error)
    return res.status(500).json({ message: 'Server error' })
  }
}


