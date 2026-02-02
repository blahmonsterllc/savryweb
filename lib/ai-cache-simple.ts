/**
 * Simple AI Response Cache
 * Uses Vercel KV (Redis) or in-memory fallback
 */

import crypto from 'crypto'

// Try to use Vercel KV, fallback to in-memory
let kv: any = null
try {
  const vercelKv = require('@vercel/kv')
  kv = vercelKv.kv
} catch (error) {
  console.log('Vercel KV not available, using in-memory cache')
}

// In-memory cache fallback
const memoryCache = new Map<string, { data: any; expiresAt: number }>()

/**
 * Generate cache key from prompt and context
 */
export function generateAICacheKey(
  prompt: string,
  systemMessage: string,
  validationType?: string
): string {
  const VERSION = 'v1' // Increment to invalidate all cache
  
  const hash = crypto
    .createHash('sha256')
    .update(VERSION + prompt + systemMessage + (validationType || ''))
    .digest('hex')
    .substring(0, 16)
  
  return `ai:${validationType || 'default'}:${hash}`
}

/**
 * Get cached response
 */
export async function getAICachedResponse(cacheKey: string): Promise<any | null> {
  try {
    // Try Vercel KV first
    if (kv) {
      const cached = await kv.get(cacheKey)
      if (cached) {
        console.log('✅ KV cache hit:', cacheKey.substring(0, 30))
        return cached
      }
    } else {
      // Fallback to memory cache
      const cached = memoryCache.get(cacheKey)
      if (cached && cached.expiresAt > Date.now()) {
        console.log('✅ Memory cache hit:', cacheKey.substring(0, 30))
        return cached.data
      } else if (cached) {
        // Expired, remove it
        memoryCache.delete(cacheKey)
      }
    }
    
    return null
  } catch (error) {
    console.error('Cache get error:', error)
    return null
  }
}

/**
 * Set cached response
 */
export async function setAICachedResponse(
  cacheKey: string,
  data: any,
  ttlSeconds: number = 86400 * 30 // 30 days default
): Promise<void> {
  try {
    const cacheData = {
      content: data.content,
      model: data.model,
      timestamp: Date.now(),
    }
    
    // Try Vercel KV first
    if (kv) {
      await kv.set(cacheKey, cacheData, { ex: ttlSeconds })
      console.log('💾 Cached to KV for', ttlSeconds / 86400, 'days')
    } else {
      // Fallback to memory cache
      memoryCache.set(cacheKey, {
        data: cacheData,
        expiresAt: Date.now() + ttlSeconds * 1000,
      })
      console.log('💾 Cached to memory for', ttlSeconds / 86400, 'days')
      
      // Clean up expired entries periodically
      if (memoryCache.size > 1000) {
        cleanExpiredCache()
      }
    }
  } catch (error) {
    console.error('Cache set error:', error)
    // Don't throw - caching failures shouldn't break the app
  }
}

/**
 * Clean up expired memory cache entries
 */
function cleanExpiredCache() {
  const now = Date.now()
  let cleaned = 0
  
  for (const [key, value] of memoryCache.entries()) {
    if (value.expiresAt < now) {
      memoryCache.delete(key)
      cleaned++
    }
  }
  
  if (cleaned > 0) {
    console.log(`🗑️ Cleaned ${cleaned} expired cache entries`)
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  if (kv) {
    // For Vercel KV, we can't easily get stats
    return {
      type: 'vercel-kv',
      available: true,
    }
  } else {
    const now = Date.now()
    let activeEntries = 0
    let expiredEntries = 0
    
    for (const [, value] of memoryCache.entries()) {
      if (value.expiresAt > now) {
        activeEntries++
      } else {
        expiredEntries++
      }
    }
    
    return {
      type: 'memory',
      available: true,
      activeEntries,
      expiredEntries,
      totalSize: memoryCache.size,
    }
  }
}
