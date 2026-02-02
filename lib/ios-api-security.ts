/**
 * iOS API Security Layer
 * Protects OpenAI endpoints from abuse and expensive attacks
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { verifyJWT, JWTPayload } from './auth'
import { getClientIP, detectBot, shouldBlockIP } from './traffic-analytics'
import { checkRateLimit } from './api-logger'
import { db } from './firebase'

// ============================================
// PRODUCTION RATE LIMITS (SECURE)
// ============================================

// Per-user monthly limits (protects from stolen tokens)
export const RATE_LIMITS = {
  FREE_MONTHLY: 20,      // 20 requests/month for free users
  PRO_MONTHLY: 500,      // 500 requests/month for Pro users (effectively unlimited for most users)
}

// Per-IP hourly limits (protects from bot attacks)
export const IP_RATE_LIMITS = {
  REQUESTS_PER_HOUR: 50, // Max 50 requests per hour per IP
  REQUESTS_PER_DAY: 200, // Max 200 requests per day per IP
}

// OpenAI token limits (protects from expensive long responses)
export const TOKEN_LIMITS = {
  MAX_TOKENS_PER_REQUEST: 2000,  // Cap response length
  MAX_PROMPT_LENGTH: 4000,       // Cap input length
}

// Daily spending caps (hard stop on runaway costs)
export const SPENDING_CAPS = {
  DAILY_CAP_PER_USER: 5.00,    // $5/day per user max
  DAILY_CAP_TOTAL: 50.00,      // $50/day total max
  HOURLY_CAP_TOTAL: 10.00,     // $10/hour total max
}

// ============================================
// SECURITY CHECK RESULT
// ============================================

export interface SecurityCheckResult {
  allowed: boolean
  reason?: string
  statusCode?: number
  userId?: string
  userTier?: 'FREE' | 'PRO'
  ip?: string
}

// ============================================
// MAIN SECURITY VALIDATOR
// ============================================

/**
 * Comprehensive security check for iOS API requests
 * Checks: JWT auth, IP limits, bot detection, spending caps
 */
export async function validateIOSAPIRequest(
  req: NextApiRequest
): Promise<SecurityCheckResult> {
  const ip = getClientIP(req.headers)
  const userAgent = req.headers['user-agent'] || ''
  
  // ========================================
  // 1. CHECK IP BLOCK LIST
  // ========================================
  const isBlocked = await shouldBlockIP(ip)
  if (isBlocked) {
    return {
      allowed: false,
      reason: 'Your IP has been blocked due to suspicious activity',
      statusCode: 403,
      ip,
    }
  }
  
  // ========================================
  // 2. CHECK BOT DETECTION
  // ========================================
  const isBot = detectBot(userAgent)
  if (isBot) {
    console.log(`🤖 Bot detected on iOS API: ${userAgent}`)
    return {
      allowed: false,
      reason: 'Automated requests are not allowed. Please use the official iOS app.',
      statusCode: 403,
      ip,
    }
  }
  
  // ========================================
  // 3. CHECK IP RATE LIMITS (PER HOUR)
  // ========================================
  const ipRateLimitExceeded = checkRateLimit(
    ip,
    IP_RATE_LIMITS.REQUESTS_PER_HOUR,
    60 * 60 * 1000 // 1 hour window
  )
  
  if (ipRateLimitExceeded) {
    console.log(`⚠️ IP rate limit exceeded: ${ip}`)
    return {
      allowed: false,
      reason: 'Too many requests from your IP. Please try again in an hour.',
      statusCode: 429,
      ip,
    }
  }
  
  // ========================================
  // 4. VERIFY JWT AUTHENTICATION
  // ========================================
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      allowed: false,
      reason: 'No authorization token provided',
      statusCode: 401,
      ip,
    }
  }
  
  const token = authHeader.substring(7)
  let decoded: JWTPayload
  
  try {
    decoded = await verifyJWT(token)
  } catch (error: any) {
    return {
      allowed: false,
      reason: error.message || 'Invalid or expired token',
      statusCode: 401,
      ip,
    }
  }
  
  const userId = decoded.userId
  const userTier = decoded.tier || 'FREE'
  
  // ========================================
  // 5. CHECK USER RATE LIMITS (MONTHLY)
  // ========================================
  const currentMonth = new Date().toISOString().substring(0, 7)
  
  try {
    const usageRef = db.collection('ai_usage').doc(userId)
    const usageDoc = await usageRef.get()
    
    let usageCount = 0
    if (usageDoc.exists) {
      const data = usageDoc.data()
      if (data && data.month === currentMonth) {
        usageCount = data.count || 0
      }
    }
    
    // Get tier-specific limit (FREE or PRO only)
    let monthlyLimit = RATE_LIMITS.FREE_MONTHLY
    if (userTier === 'PRO') {
      monthlyLimit = RATE_LIMITS.PRO_MONTHLY
    }
    
    if (usageCount >= monthlyLimit) {
      return {
        allowed: false,
        reason: `Monthly limit reached (${monthlyLimit} requests). ${userTier === 'FREE' ? 'Upgrade to Pro for more!' : 'Please try again next month.'}`,
        statusCode: 403,
        userId,
        userTier,
        ip,
      }
    }
  } catch (error) {
    console.error('Error checking user rate limit:', error)
    // Allow request if rate limit check fails (don't break the app)
  }
  
  // ========================================
  // 6. CHECK DAILY SPENDING CAP (PER USER)
  // ========================================
  try {
    const today = new Date().toISOString().substring(0, 10)
    const spendingRef = db.collection('daily_spending').doc(`${userId}_${today}`)
    const spendingDoc = await spendingRef.get()
    
    if (spendingDoc.exists) {
      const data = spendingDoc.data()
      const dailySpend = data?.totalCost || 0
      
      if (dailySpend >= SPENDING_CAPS.DAILY_CAP_PER_USER) {
        return {
          allowed: false,
          reason: `Daily spending limit reached ($${SPENDING_CAPS.DAILY_CAP_PER_USER}). Please try again tomorrow.`,
          statusCode: 403,
          userId,
          userTier,
          ip,
        }
      }
    }
  } catch (error) {
    console.error('Error checking daily spending:', error)
  }
  
  // ========================================
  // 7. ALL CHECKS PASSED
  // ========================================
  return {
    allowed: true,
    userId,
    userTier,
    ip,
  }
}

// ============================================
// SPENDING TRACKER
// ============================================

/**
 * Track spending for a request
 * Call this after successful OpenAI API call
 */
export async function trackSpending(
  userId: string,
  cost: number
): Promise<void> {
  try {
    const today = new Date().toISOString().substring(0, 10)
    const spendingRef = db.collection('daily_spending').doc(`${userId}_${today}`)
    
    const spendingDoc = await spendingRef.get()
    
    if (spendingDoc.exists) {
      const data = spendingDoc.data()
      await spendingRef.update({
        totalCost: (data?.totalCost || 0) + cost,
        requestCount: (data?.requestCount || 0) + 1,
        lastRequest: new Date(),
      })
    } else {
      await spendingRef.set({
        userId,
        date: today,
        totalCost: cost,
        requestCount: 1,
        createdAt: new Date(),
        lastRequest: new Date(),
      })
    }
    
    // Check if user exceeded daily cap (for alerting)
    const updatedDoc = await spendingRef.get()
    const totalCost = updatedDoc.data()?.totalCost || 0
    
    if (totalCost >= SPENDING_CAPS.DAILY_CAP_PER_USER) {
      console.warn(`🚨 User ${userId} exceeded daily spending cap: $${totalCost.toFixed(2)}`)
      // TODO: Send alert email/SMS
    }
  } catch (error) {
    console.error('Error tracking spending:', error)
  }
}

// ============================================
// TOTAL SPENDING CHECK (GLOBAL)
// ============================================

/**
 * Check if total system spending exceeded limits
 */
export async function checkGlobalSpendingCap(): Promise<boolean> {
  try {
    const today = new Date().toISOString().substring(0, 10)
    const snapshot = await db
      .collection('daily_spending')
      .where('date', '==', today)
      .get()
    
    let totalSpending = 0
    snapshot.forEach(doc => {
      const data = doc.data()
      totalSpending += data.totalCost || 0
    })
    
    if (totalSpending >= SPENDING_CAPS.DAILY_CAP_TOTAL) {
      console.error(`🚨 CRITICAL: Total daily spending cap exceeded: $${totalSpending.toFixed(2)}`)
      return true // Block all requests
    }
    
    return false
  } catch (error) {
    console.error('Error checking global spending:', error)
    return false // Don't block if check fails
  }
}

// ============================================
// SECURITY MIDDLEWARE FOR iOS APIs
// ============================================

/**
 * Express/Next.js middleware wrapper for iOS API security
 * Use this to wrap all iOS API handlers
 */
export function withIOSSecurity(
  handler: (req: NextApiRequest, res: NextApiResponse, userId: string, userTier: string) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Run security checks
    const securityCheck = await validateIOSAPIRequest(req)
    
    if (!securityCheck.allowed) {
      return res.status(securityCheck.statusCode || 403).json({
        success: false,
        error: securityCheck.reason || 'Access denied',
      })
    }
    
    // Check global spending cap
    const globalCapExceeded = await checkGlobalSpendingCap()
    if (globalCapExceeded) {
      return res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable. Please try again later.',
      })
    }
    
    // All checks passed - call the handler
    try {
      await handler(req, res, securityCheck.userId!, securityCheck.userTier!)
    } catch (error: any) {
      console.error('iOS API handler error:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      })
    }
  }
}

// ============================================
// ALERT SYSTEM
// ============================================

interface AlertData {
  type: 'SPENDING_CAP' | 'RATE_LIMIT' | 'BOT_ATTACK' | 'SUSPICIOUS_ACTIVITY'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  message: string
  userId?: string
  ip?: string
  cost?: number
  requestCount?: number
}

/**
 * Send alert (log to console and Firestore for now)
 * TODO: Integrate with email/SMS service
 */
export async function sendAlert(alert: AlertData): Promise<void> {
  console.warn(`🚨 SECURITY ALERT [${alert.severity}]: ${alert.message}`)
  
  try {
    await db.collection('security_alerts').add({
      ...alert,
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Failed to log alert:', error)
  }
  
  // TODO: Send email via SendGrid, SMS via Twilio, etc.
  // if (alert.severity === 'CRITICAL' || alert.severity === 'HIGH') {
  //   await sendEmailAlert(alert)
  // }
}
