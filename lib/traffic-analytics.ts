import { db } from './firebase'

/**
 * Traffic Analytics Library
 * 
 * Tracks all requests to the server for monitoring and bot detection
 */

export interface RequestLog {
  timestamp: Date
  method: string
  path: string
  statusCode: number
  responseTime: number
  userAgent: string
  ip: string
  userId?: string
  endpoint: string
  isBot: boolean
  isSuspicious: boolean
}

export interface TrafficStats {
  totalRequests: number
  uniqueIPs: number
  uniqueUsers: number
  botRequests: number
  suspiciousRequests: number
  avgResponseTime: number
  requestsByEndpoint: Record<string, number>
  requestsByStatus: Record<string, number>
  topIPs: Array<{ ip: string; count: number }>
  topUserAgents: Array<{ userAgent: string; count: number }>
}

/**
 * Detect if request is from a bot
 */
export function detectBot(userAgent: string): boolean {
  if (!userAgent) return true // No user agent = suspicious
  
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /java(?!script)/i,
    /go-http/i,
    /postman/i,
    /insomnia/i,
    /slackbot/i,
    /facebookexternalhit/i,
    /facebookbot/i,
    /meta-externalagent/i,
    /metainspector/i,
    /whatsapp/i,
    /telegrambot/i,
    /twitterbot/i,
    /linkedinbot/i,
    /discordbot/i,
    /ahrefsbot/i,
    /semrushbot/i,
    /dotbot/i,
    /mj12bot/i,
    /petalbot/i,
    /bytespider/i, // TikTok/ByteDance bot
    /yandexbot/i,
    /bingbot/i,
    /baiduspider/i,
  ]
  
  return botPatterns.some(pattern => pattern.test(userAgent))
}

/**
 * Check if bot should be allowed (for SEO purposes)
 * Allow legitimate search engine bots on public pages only
 */
export function isLegitimateSearchBot(userAgent: string): boolean {
  const searchBots = [
    /googlebot/i,
    /bingbot/i,
    /slurp/i, // Yahoo
    /duckduckbot/i,
    /baiduspider/i,
  ]
  
  return searchBots.some(pattern => pattern.test(userAgent))
}

/**
 * Check if request should be blocked
 * Block bots on API endpoints, allow legitimate search bots on public pages
 */
export function shouldBlockBot(userAgent: string, path: string): boolean {
  const isBot = detectBot(userAgent)
  if (!isBot) return false
  
  // Always allow legitimate search engines on public pages
  if (isLegitimateSearchBot(userAgent) && !path.startsWith('/api')) {
    return false
  }
  
  // Block all bots on API endpoints
  if (path.startsWith('/api')) {
    return true
  }
  
  // Block non-search-engine bots everywhere
  if (isBot && !isLegitimateSearchBot(userAgent)) {
    return true
  }
  
  return false
}

/**
 * Detect suspicious activity
 */
export function detectSuspiciousActivity(
  ip: string,
  path: string,
  userAgent: string,
  recentRequests: number
): boolean {
  // Too many requests from same IP in short time
  if (recentRequests > 50) return true
  
  // Suspicious paths
  const suspiciousPaths = [
    '/admin',
    '/api/admin',
    '/.env',
    '/wp-admin',
    '/phpmyadmin',
    '/config',
    '/backup',
    '/.git',
  ]
  
  if (suspiciousPaths.some(p => path.startsWith(p)) && !userAgent.includes('Mozilla')) {
    return true
  }
  
  return false
}

/**
 * Get client IP from request headers
 */
export function getClientIP(headers: any): string {
  // Check various headers for real IP (Vercel, Cloudflare, etc.)
  const forwardedFor = headers['x-forwarded-for']
  const realIP = headers['x-real-ip']
  const cfConnectingIP = headers['cf-connecting-ip']
  
  if (cfConnectingIP) return cfConnectingIP
  if (realIP) return realIP
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list
    return forwardedFor.split(',')[0].trim()
  }
  
  return 'unknown'
}

/**
 * Log request to Firestore (aggregated by minute)
 */
export async function logRequest(
  method: string,
  path: string,
  statusCode: number,
  responseTime: number,
  userAgent: string,
  ip: string,
  userId?: string
): Promise<void> {
  try {
    // Aggregate by minute to reduce writes
    const now = new Date()
    const minuteTimestamp = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes()
    )
    
    const docId = `traffic_${minuteTimestamp.toISOString().replace(/:/g, '-').split('.')[0]}`
    
    // Detect bot and suspicious activity
    const isBot = detectBot(userAgent)
    const endpoint = path.split('?')[0] // Remove query params
    
    // Get recent request count for this IP (for suspicious detection)
    const recentRequests = await getRecentRequestCount(ip, 60000) // Last minute
    const isSuspicious = detectSuspiciousActivity(ip, path, userAgent, recentRequests)
    
    // Update aggregated stats
    const statsRef = db.collection('traffic_analytics').doc(docId)
    const statsDoc = await statsRef.get()
    
    if (statsDoc.exists) {
      const data = statsDoc.data() || {}
      
      // Update counts
      await statsRef.update({
        totalRequests: (data.totalRequests || 0) + 1,
        botRequests: isBot ? (data.botRequests || 0) + 1 : data.botRequests || 0,
        suspiciousRequests: isSuspicious ? (data.suspiciousRequests || 0) + 1 : data.suspiciousRequests || 0,
        
        // Update maps
        [`ips.${sanitizeKey(ip)}`]: ((data.ips && data.ips[sanitizeKey(ip)]) || 0) + 1,
        [`endpoints.${sanitizeKey(endpoint)}`]: ((data.endpoints && data.endpoints[sanitizeKey(endpoint)]) || 0) + 1,
        [`statuses.${statusCode}`]: ((data.statuses && data.statuses[statusCode]) || 0) + 1,
        [`userAgents.${sanitizeKey(userAgent.substring(0, 100))}`]: 
          ((data.userAgents && data.userAgents[sanitizeKey(userAgent.substring(0, 100))]) || 0) + 1,
        
        // Track users
        ...(userId ? { [`users.${userId}`]: true } : {}),
        
        // Update response time average
        totalResponseTime: (data.totalResponseTime || 0) + responseTime,
        updatedAt: new Date(),
      })
    } else {
      // Create new document
      await statsRef.set({
        timestamp: minuteTimestamp,
        totalRequests: 1,
        botRequests: isBot ? 1 : 0,
        suspiciousRequests: isSuspicious ? 1 : 0,
        ips: { [sanitizeKey(ip)]: 1 },
        endpoints: { [sanitizeKey(endpoint)]: 1 },
        statuses: { [statusCode]: 1 },
        userAgents: { [sanitizeKey(userAgent.substring(0, 100))]: 1 },
        users: userId ? { [userId]: true } : {},
        totalResponseTime: responseTime,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
    
    // If suspicious, log detailed record
    if (isSuspicious) {
      await db.collection('suspicious_activity').add({
        timestamp: new Date(),
        method,
        path,
        ip,
        userAgent,
        userId,
        statusCode,
        recentRequests,
        reason: recentRequests > 50 ? 'rate_limit' : 'suspicious_path',
      })
    }
  } catch (error) {
    console.error('Error logging request:', error)
    // Don't throw - logging failures shouldn't break the app
  }
}

/**
 * Get recent request count for an IP
 */
async function getRecentRequestCount(ip: string, timeWindowMs: number): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - timeWindowMs)
    
    const snapshot = await db
      .collection('traffic_analytics')
      .where('timestamp', '>=', cutoff)
      .get()
    
    let count = 0
    snapshot.forEach(doc => {
      const data = doc.data()
      if (data.ips && data.ips[sanitizeKey(ip)]) {
        count += data.ips[sanitizeKey(ip)]
      }
    })
    
    return count
  } catch (error) {
    return 0
  }
}

/**
 * Sanitize key for Firestore (no . or /)
 */
function sanitizeKey(key: string): string {
  return key.replace(/\./g, '_').replace(/\//g, '_').replace(/\$/g, '_')
}

/**
 * Get traffic statistics for a time range
 */
export async function getTrafficStats(
  startDate: Date,
  endDate: Date
): Promise<TrafficStats> {
  try {
    const snapshot = await db
      .collection('traffic_analytics')
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<=', endDate)
      .orderBy('timestamp', 'asc')
      .get()
    
    let totalRequests = 0
    let botRequests = 0
    let suspiciousRequests = 0
    let totalResponseTime = 0
    
    const ipsMap: Record<string, number> = {}
    const endpointsMap: Record<string, number> = {}
    const statusesMap: Record<string, number> = {}
    const userAgentsMap: Record<string, number> = {}
    const usersSet = new Set<string>()
    
    snapshot.forEach(doc => {
      const data = doc.data()
      
      totalRequests += data.totalRequests || 0
      botRequests += data.botRequests || 0
      suspiciousRequests += data.suspiciousRequests || 0
      totalResponseTime += data.totalResponseTime || 0
      
      // Aggregate IPs
      if (data.ips) {
        Object.entries(data.ips).forEach(([ip, count]) => {
          ipsMap[ip] = (ipsMap[ip] || 0) + (count as number)
        })
      }
      
      // Aggregate endpoints
      if (data.endpoints) {
        Object.entries(data.endpoints).forEach(([endpoint, count]) => {
          endpointsMap[endpoint] = (endpointsMap[endpoint] || 0) + (count as number)
        })
      }
      
      // Aggregate statuses
      if (data.statuses) {
        Object.entries(data.statuses).forEach(([status, count]) => {
          statusesMap[status] = (statusesMap[status] || 0) + (count as number)
        })
      }
      
      // Aggregate user agents
      if (data.userAgents) {
        Object.entries(data.userAgents).forEach(([ua, count]) => {
          userAgentsMap[ua] = (userAgentsMap[ua] || 0) + (count as number)
        })
      }
      
      // Collect unique users
      if (data.users) {
        Object.keys(data.users).forEach(userId => usersSet.add(userId))
      }
    })
    
    // Get top IPs
    const topIPs = Object.entries(ipsMap)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    
    // Get top user agents
    const topUserAgents = Object.entries(userAgentsMap)
      .map(([userAgent, count]) => ({ userAgent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    
    return {
      totalRequests,
      uniqueIPs: Object.keys(ipsMap).length,
      uniqueUsers: usersSet.size,
      botRequests,
      suspiciousRequests,
      avgResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      requestsByEndpoint: endpointsMap,
      requestsByStatus: statusesMap,
      topIPs,
      topUserAgents,
    }
  } catch (error) {
    console.error('Error getting traffic stats:', error)
    throw error
  }
}

/**
 * Get suspicious activity logs
 */
export async function getSuspiciousActivity(limit: number = 50) {
  try {
    const snapshot = await db
      .collection('suspicious_activity')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    console.error('Error getting suspicious activity:', error)
    return []
  }
}

/**
 * Check if IP should be blocked
 */
export async function shouldBlockIP(ip: string): Promise<boolean> {
  try {
    // Check if IP is in blocklist
    const blockDoc = await db.collection('ip_blocklist').doc(sanitizeKey(ip)).get()
    if (blockDoc.exists) {
      return true
    }
    
    // Check recent suspicious activity
    const recentRequests = await getRecentRequestCount(ip, 60000) // Last minute
    
    // Block if more than 100 requests in a minute
    if (recentRequests > 100) {
      // Auto-add to blocklist
      await db.collection('ip_blocklist').doc(sanitizeKey(ip)).set({
        ip,
        reason: 'rate_limit_exceeded',
        blockedAt: new Date(),
        requestCount: recentRequests,
      })
      return true
    }
    
    return false
  } catch (error) {
    console.error('Error checking IP block:', error)
    return false
  }
}
