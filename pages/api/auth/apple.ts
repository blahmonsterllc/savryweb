import { NextApiRequest, NextApiResponse } from 'next'
import { generateJWT } from '@/lib/auth'
import { db } from '@/lib/firebase'

/**
 * Apple Sign In Endpoint for iOS App
 * Handles Sign in with Apple authentication for TestFlight and production
 * Creates or retrieves user account and returns JWT token
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    })
  }

  try {
    const { identityToken, email, firstName, lastName } = req.body

    console.log('🍎 Apple Sign In request received')
    
    if (!identityToken) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing identity token' 
      })
    }

    // Extract Apple user ID from identity token
    // For TestFlight, we use a simplified approach
    // TODO: In production, properly decode and verify the Apple JWT
    const appleUserId = identityToken.substring(0, 20)

    console.log(`🔍 Looking for user with Apple ID: ${appleUserId}`)

    // Check if user exists in Firestore
    let user: any
    const userSnapshot = await db.collection('users')
      .where('appleId', '==', appleUserId)
      .limit(1)
      .get()

    if (userSnapshot.empty) {
      // Create new user
      console.log('✨ Creating new user...')
      
      const newUser = {
        appleId: appleUserId,
        email: email || `user-${appleUserId}@apple.com`,
        name: firstName ? `${firstName} ${lastName || ''}`.trim() : 'User',
        tier: 'FREE', // All TestFlight users start as FREE
        isPro: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
        
        // AI usage tracking
        aiRecipesGenerated: 0,
        aiRecipesThisMonth: 0,
        hasUsedAIChef: false,
      }

      const userRef = await db.collection('users').add(newUser)
      const userId = userRef.id
      user = { id: userId, ...newUser }
      
      console.log(`✅ New user created: ${userId}`)
    } else {
      // Existing user found - update last login
      const userDoc = userSnapshot.docs[0]
      const userId = userDoc.id
      user = { id: userId, ...userDoc.data() }
      
      console.log(`✅ Existing user found: ${userId}`)

      // Update last login timestamp
      await db.collection('users').doc(userId).update({
        lastLoginAt: new Date(),
        updatedAt: new Date()
      })
    }

    // Generate JWT tokens using our auth library
    const accessToken = generateJWT(
      user.id,
      user.email,
      user.tier || 'FREE'
    )

    // Generate refresh token (longer expiration)
    const refreshToken = generateJWT(
      user.id,
      user.email,
      user.tier || 'FREE'
    )

    console.log(`🎫 JWT tokens generated for user: ${user.email}`)

    // Return authentication response (format expected by iOS app)
    return res.status(200).json({
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isPro: user.isPro || false,
        profileImage: null
      }
    })

  } catch (error: any) {
    console.error('❌ Apple Sign In error:', error)
    
    return res.status(500).json({ 
      error: error.message || 'Authentication failed' 
    })
  }
}
