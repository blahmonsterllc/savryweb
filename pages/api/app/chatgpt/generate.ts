import { NextApiRequest, NextApiResponse } from 'next'
import { openai } from '@/lib/openai'
import { verifyJWT } from '@/lib/auth'
import { trackAPIUsage } from '@/lib/openai-tracker'
import { db } from '@/lib/firebase'

/**
 * Production ChatGPT Endpoint for iOS App
 * Features:
 * - JWT authentication (no dev-token)
 * - Rate limiting: Free (2/month) vs Pro (unlimited)
 * - Smart model selection: GPT-4o for complex, GPT-4o-mini for simple
 * - Usage tracking synced with iOS
 */

// Rate limits
// TESTFLIGHT: Generous limits for testing (change to 2 for production)
const FREE_TIER_MONTHLY_LIMIT = 999
const PRO_TIER_MONTHLY_LIMIT = 999999 // Effectively unlimited

// Keywords that indicate recipe complexity
const COMPLEX_KEYWORDS = [
  'gluten-free', 'vegan', 'vegetarian', 'keto', 'paleo', 'dairy-free',
  'nut-free', 'allergen', 'allergy', 'dietary', 'restriction',
  'kosher', 'halal', 'low-carb', 'sugar-free', 'diabetic',
  'french', 'thai', 'indian', 'japanese', 'molecular', 'gourmet',
  'advanced', 'complicated', 'multi-step', 'technique'
]

interface UsageRecord {
  userId: string
  count: number
  month: string // Format: "2026-01"
  lastUsed: Date
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    })
  }

  try {
    // ============================================
    // STEP 1: Verify JWT Authentication
    // ============================================
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'No authorization token provided' 
      })
    }

    const token = authHeader.substring(7)
    const decoded = await verifyJWT(token)
    
    if (!decoded) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      })
    }

    const userId = decoded.userId
    const userTier = decoded.tier || 'FREE' // "FREE" or "PRO"

    console.log(`🤖 ChatGPT request from user ${userId} (${userTier})`)

    // ============================================
    // STEP 2: Check Rate Limits
    // ============================================
    const currentMonth = new Date().toISOString().substring(0, 7) // "2026-01"
    
    // Get user's usage record from Firestore
    const usageRef = db.collection('ai_usage').doc(userId)
    const usageDoc = await usageRef.get()
    
    let usageData: UsageRecord = usageDoc.exists
      ? usageDoc.data() as UsageRecord
      : { userId, count: 0, month: currentMonth, lastUsed: new Date() }

    // Reset counter if new month
    if (usageData.month !== currentMonth) {
      usageData = {
        userId,
        count: 0,
        month: currentMonth,
        lastUsed: new Date()
      }
    }

    // Check rate limit for free users
    if (userTier === 'FREE' && usageData.count >= FREE_TIER_MONTHLY_LIMIT) {
      return res.status(403).json({ 
        success: false, 
        error: `You've used ${FREE_TIER_MONTHLY_LIMIT} free AI recipes this month. Upgrade to Pro for unlimited access!`,
        upgrade: true,
        usageCount: usageData.count,
        limit: FREE_TIER_MONTHLY_LIMIT
      })
    }

    // ============================================
    // STEP 3: Smart Model Selection
    // ============================================
    const { prompt, systemMessage, maxTokens } = req.body

    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: prompt' 
      })
    }

    // Detect complexity from prompt
    const promptLower = prompt.toLowerCase()
    const isComplex = COMPLEX_KEYWORDS.some(keyword => 
      promptLower.includes(keyword)
    )

    // Choose model based on tier and complexity
    let model = 'gpt-4o-mini' // Default: fast and cheap
    
    if (userTier === 'PRO' && isComplex) {
      model = 'gpt-4o' // Premium model for complex requests
      console.log(`✨ Using GPT-4o (Pro user + complex recipe)`)
    } else if (userTier === 'PRO') {
      console.log(`⚡ Using GPT-4o-mini (Pro user + simple recipe)`)
    } else {
      console.log(`🆓 Using GPT-4o-mini (Free user)`)
    }

    console.log('📝 Prompt length:', prompt.length)
    console.log('🎯 Model:', model)

    // ============================================
    // STEP 4: Call OpenAI
    // ============================================
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: systemMessage || 'You are an expert chef who creates delicious recipes. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: maxTokens || 2000,
      temperature: 0.7,
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
      throw new Error('OpenAI returned empty response')
    }

    // Track usage for admin dashboard
    if (completion.usage) {
      trackAPIUsage(
        model,
        completion.usage.prompt_tokens,
        completion.usage.completion_tokens,
        'chatgpt/generate'
      )
    }

    console.log('✅ OpenAI response received')
    console.log('📊 Tokens used:', completion.usage?.total_tokens)

    // ============================================
    // STEP 5: Update Usage Counter
    // ============================================
    usageData.count += 1
    usageData.lastUsed = new Date()
    
    await usageRef.set(usageData)

    console.log(`📈 Usage updated: ${usageData.count}/${userTier === 'PRO' ? '∞' : FREE_TIER_MONTHLY_LIMIT}`)

    // ============================================
    // STEP 6: Return Response
    // ============================================
    return res.status(200).json({
      success: true,
      content: content,
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens
      },
      meta: {
        model: model,
        tier: userTier,
        usageCount: usageData.count,
        limit: userTier === 'PRO' ? null : FREE_TIER_MONTHLY_LIMIT,
        remainingThisMonth: userTier === 'PRO' ? null : Math.max(0, FREE_TIER_MONTHLY_LIMIT - usageData.count)
      }
    })

  } catch (error: any) {
    console.error('❌ ChatGPT endpoint error:', error)

    // Handle specific OpenAI errors
    if (error.response) {
      const status = error.response.status
      const message = error.response.data?.error?.message || 'OpenAI API error'

      if (status === 401) {
        return res.status(500).json({ 
          success: false, 
          error: 'OpenAI API key is invalid or missing' 
        })
      }

      if (status === 429) {
        return res.status(429).json({ 
          success: false, 
          error: 'Too many requests. Please try again in a moment.' 
        })
      }

      return res.status(500).json({ 
        success: false, 
        error: `OpenAI error: ${message}` 
      })
    }

    // Generic error
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to generate content' 
    })
  }
}
