import { NextApiRequest, NextApiResponse } from 'next'
import { logRequest, getClientIP, shouldBlockIP, detectBot } from './traffic-analytics'

/**
 * API Logger Wrapper
 * 
 * Wraps API route handlers to automatically log requests and detect bots
 */

export function withLogging(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const startTime = Date.now()
    const ip = getClientIP(req.headers)
    const userAgent = req.headers['user-agent'] || 'unknown'
    const rawPath = req.url || req.headers['x-invoke-path'] || 'unknown'
    const path = typeof rawPath === 'string' ? rawPath : 'unknown'
    
    // Check if IP should be blocked
    const isBlocked = await shouldBlockIP(ip)
    if (isBlocked) {
      console.log(`🚫 Blocked request from ${ip} to ${path}`)
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Your IP has been temporarily blocked due to excessive requests',
      })
    }
    
    // Check if it's a bot
    const isBot = detectBot(userAgent)
    
    // For bots accessing non-public endpoints, block them
    if (isBot && (path.startsWith('/api/app') || path.startsWith('/api/admin'))) {
      console.log(`🤖 Bot blocked from ${path}: ${userAgent.substring(0, 50)}`)
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Automated requests are not allowed',
      })
    }
    
    // Intercept res.json to capture status code
    const originalJson = res.json
    let statusCode = 200
    
    res.json = function (data: any) {
      statusCode = res.statusCode
      return originalJson.call(this, data)
    }
    
    // Intercept res.status to capture status code
    const originalStatus = res.status
    res.status = function (code: number) {
      statusCode = code
      return originalStatus.call(this, code)
    }
    
    try {
      // Call the actual handler
      await handler(req, res)
      
      // Log request
      const responseTime = Date.now() - startTime
      
      // Extract userId from JWT if present
      let userId: string | undefined
      try {
        const authHeader = req.headers.authorization
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7)
          // Don't verify, just decode to get userId
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
          userId = payload.userId
        }
      } catch (e) {
        // Ignore errors in userId extraction
      }
      
      // Log asynchronously (don't wait for it)
      logRequest(
        req.method || 'GET',
        path,
        statusCode,
        responseTime,
        userAgent,
        ip,
        userId
      ).catch(err => {
        console.error('Failed to log request:', err)
      })
      
    } catch (error) {
      // Log error request
      const responseTime = Date.now() - startTime
      logRequest(
        req.method || 'GET',
        path,
        500,
        responseTime,
        userAgent,
        ip
      ).catch(() => {})
      
      throw error
    }
  }
}

/**
 * Simple rate limiter for API endpoints
 * Returns true if rate limit exceeded
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  ip: string,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
): boolean {
  const now = Date.now()
  const key = ip
  
  const record = requestCounts.get(key)
  
  if (!record || now > record.resetTime) {
    // Start new window
    requestCounts.set(key, {
      count: 1,
      resetTime: now + windowMs,
    })
    return false
  }
  
  record.count++
  
  if (record.count > maxRequests) {
    return true // Rate limit exceeded
  }
  
  return false
}

/**
 * Clean up old rate limit records periodically
 */
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(key)
    }
  }
}, 60000) // Clean up every minute
