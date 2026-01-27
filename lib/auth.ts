/**
 * Authentication Helpers for iOS API
 */

import jwt from 'jsonwebtoken'

export interface JWTPayload {
  userId: string
  email: string
  tier: 'FREE' | 'PRO' | 'PREMIUM' // User subscription tier
  iat?: number
  exp?: number
}

/**
 * Verify JWT token from iOS app
 */
export async function verifyJWT(token: string): Promise<JWTPayload> {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any
    
    return {
      userId: decoded.userId || decoded.id || decoded.sub,
      email: decoded.email,
      tier: decoded.tier || 'FREE'
    }
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired')
    }
    throw new Error('Invalid token')
  }
}

/**
 * Generate JWT token (for login endpoint)
 */
export function generateJWT(userId: string, email: string, tier: 'FREE' | 'PRO' | 'PREMIUM'): string {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }

  return jwt.sign(
    {
      userId,
      email,
      tier,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '30d', // Token expires in 30 days
    }
  )
}

/**
 * Check if user has Pro tier access
 */
export function requireProTier(tier: string): boolean {
  return tier === 'PRO' || tier === 'PREMIUM'
}




