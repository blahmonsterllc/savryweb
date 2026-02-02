import { NextApiRequest, NextApiResponse } from 'next'
import { openai } from '@/lib/openai'
import { verifyJWT } from '@/lib/auth'
import { trackAPIUsage } from '@/lib/openai-tracker'
import { logAIRequest } from '@/lib/aiCostTracking'
import { db } from '@/lib/firebase'
import { validateIOSAPIRequest, trackSpending, RATE_LIMITS } from '@/lib/ios-api-security'
import { generateAICacheKey, getAICachedResponse, setAICachedResponse } from '@/lib/ai-cache-simple'

/**
 * Optimized ChatGPT Endpoint for iOS App
 * 
 * NEW FEATURES:
 * - Redis/KV caching (80% cost reduction)
 * - Smart model selection based on validationType
 * - Support for gpt-3.5-turbo (10x cheaper for simple tasks)
 * - Integrated with security system (rate limits, bot detection, spending caps)
 * 
 * SECURITY:
 * - JWT authentication
 * - Rate limiting: Free (20/month) vs Pro (500/month)
 * - IP rate limiting: 50/hour
 * - Daily spending caps: $5/user, $50/total
 * - Bot detection and blocking
 */

// Rate limits are now defined in lib/ios-api-security.ts
// FREE_TIER_MONTHLY_LIMIT = 20
// PRO_TIER_MONTHLY_LIMIT = 500

// Helper function to calculate API costs
function calculateCost(model: string, usage: any): number {
  if (!usage) return 0

  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o': {
      input: 5.00 / 1_000_000,    // $5 per 1M input tokens
      output: 20.00 / 1_000_000   // $20 per 1M output tokens
    },
    'gpt-4o-mini': {
      input: 0.15 / 1_000_000,    // $0.15 per 1M input tokens
      output: 0.60 / 1_000_000    // $0.60 per 1M output tokens
    },
    'gpt-3.5-turbo': {
      input: 0.50 / 1_000_000,    // $0.50 per 1M input tokens
      output: 1.50 / 1_000_000    // $1.50 per 1M output tokens
    }
  }

  const modelPricing = pricing[model] || pricing['gpt-4o-mini']
  
  const inputCost = (usage.prompt_tokens || 0) * modelPricing.input
  const outputCost = (usage.completion_tokens || 0) * modelPricing.output
  
  return inputCost + outputCost
}

/**
 * Smart model selection based on iOS validationType
 * NEW: Supports gpt-3.5-turbo for simple validations
 */
function selectOptimalModel(requestedModel: string | undefined, validationType: string | undefined): string {
  // If iOS app explicitly requested a model, use it
  if (requestedModel) {
    console.log('📱 iOS requested model:', requestedModel)
    return requestedModel
  }

  // Smart selection based on validation type
  if (validationType === 'simple') {
    // Simple validation: just servings/type → GPT-3.5 (10x cheaper)
    console.log('🎯 Simple validation → gpt-3.5-turbo')
    return 'gpt-3.5-turbo'
  } else if (validationType === 'complex') {
    // Complex validation: nutrition estimation → GPT-4o (more accurate)
    console.log('🎯 Complex validation → gpt-4o')
    return 'gpt-4o'
  }

  // Default: AI Chef and recipe generation → GPT-4o-mini (good balance)
  console.log('🎯 Default generation → gpt-4o-mini')
  return 'gpt-4o-mini'
}

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
  const startTime = Date.now()
  
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    })
  }

  try {
    // ============================================
    // STEP 1: Security Validation (NEW!)
    // ============================================
    const securityCheck = await validateIOSAPIRequest(req)
    
    if (!securityCheck.allowed) {
      return res.status(securityCheck.statusCode || 403).json({
        success: false,
        error: securityCheck.reason || 'Access denied',
      })
    }

    const userId = securityCheck.userId!
    const userTier = securityCheck.userTier!

    console.log(`🤖 ChatGPT request from user ${userId} (${userTier})`)

    // ============================================
    // STEP 2: Get Request Data + NEW iOS Parameters
    // ============================================
    const { 
      prompt, 
      systemMessage, 
      maxTokens, 
      model: requestedModel, 
      validationType,  // NEW: "simple" or "complex" from iOS
      appVersion 
    } = req.body

    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: prompt' 
      })
    }

    // ============================================
    // STEP 3: Check Cache (NEW! 80% cost savings)
    // ============================================
    const cacheKey = generateAICacheKey(prompt, systemMessage || '', validationType)
    const cachedResponse = await getAICachedResponse(cacheKey)
    
    if (cachedResponse) {
      console.log('✅ Cache hit - returning cached response')
      
      // Still count towards user's monthly usage
      const currentMonth = new Date().toISOString().substring(0, 7)
      const usageRef = db.collection('ai_usage').doc(userId)
      const usageDoc = await usageRef.get()
      
      let usageData: UsageRecord = usageDoc.exists
        ? usageDoc.data() as UsageRecord
        : { userId, count: 0, month: currentMonth, lastUsed: new Date() }

      if (usageData.month !== currentMonth) {
        usageData = { userId, count: 0, month: currentMonth, lastUsed: new Date() }
      }

      usageData.count += 1
      usageData.lastUsed = new Date()
      await usageRef.set(usageData)
      
      // Log cached request (no cost!)
      await logAIRequest({
        userId,
        userTier,
        model: cachedResponse.model,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        requestType: 'generate',
        promptLength: prompt.length,
        success: true,
        cached: true,
        responseTimeMs: Date.now() - startTime,
        endpoint: '/api/app/chatgpt/generate',
        appVersion
      })

      return res.status(200).json({
        success: true,
        content: cachedResponse.content,
        cached: true,
        meta: {
          model: cachedResponse.model,
          tier: userTier,
          usageCount: usageData.count,
          limit: userTier === 'PRO' ? RATE_LIMITS.PRO_MONTHLY : RATE_LIMITS.FREE_MONTHLY,
          remainingThisMonth: Math.max(0, (userTier === 'PRO' ? RATE_LIMITS.PRO_MONTHLY : RATE_LIMITS.FREE_MONTHLY) - usageData.count)
        }
      })
    }

    console.log('❌ Cache miss - calling OpenAI')

    // ============================================
    // STEP 4: Check Monthly Rate Limits
    // ============================================
    const currentMonth = new Date().toISOString().substring(0, 7)
    const usageRef = db.collection('ai_usage').doc(userId)
    const usageDoc = await usageRef.get()
    
    let usageData: UsageRecord = usageDoc.exists
      ? usageDoc.data() as UsageRecord
      : { userId, count: 0, month: currentMonth, lastUsed: new Date() }

    if (usageData.month !== currentMonth) {
      usageData = {
        userId,
        count: 0,
        month: currentMonth,
        lastUsed: new Date()
      }
    }

    const monthlyLimit = userTier === 'PRO' ? RATE_LIMITS.PRO_MONTHLY : RATE_LIMITS.FREE_MONTHLY

    if (usageData.count >= monthlyLimit) {
      await logAIRequest({
        userId,
        userTier,
        model: 'gpt-4o-mini',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        requestType: 'generate',
        promptLength: prompt.length,
        success: false,
        errorMessage: 'Rate limit exceeded',
        responseTimeMs: Date.now() - startTime,
        endpoint: '/api/app/chatgpt/generate',
        appVersion
      })
      
      return res.status(403).json({ 
        success: false, 
        error: userTier === 'FREE' 
          ? `You've used all ${monthlyLimit} free AI recipes this month. Upgrade to Pro for 500/month!`
          : `You've reached your monthly limit of ${monthlyLimit} requests. Please try again next month.`,
        upgrade: userTier === 'FREE',
        usageCount: usageData.count,
        limit: monthlyLimit
      })
    }

    // ============================================
    // STEP 5: Smart Model Selection (OPTIMIZED!)
    // ============================================
    
    const selectedModel = selectOptimalModel(requestedModel, validationType)

    console.log('📝 Prompt length:', prompt.length)
    console.log('🎯 Selected model:', selectedModel)
    console.log('🏷️ Validation type:', validationType || 'default')

    // ============================================
    // STEP 6: Call OpenAI
    // ============================================
    const completion = await openai.chat.completions.create({
      model: selectedModel,
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
      max_tokens: Math.min(maxTokens || 2000, 2000), // Cap at 2000 for security
      temperature: 0.7,
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
      throw new Error('OpenAI returned empty response')
    }

    // ============================================
    // STEP 7: Cache Response (NEW! Saves 80%)
    // ============================================
    await setAICachedResponse(cacheKey, {
      content,
      model: selectedModel,
    }, 86400 * 30) // 30 days

    // Calculate actual cost for this request
    const requestCost = calculateCost(selectedModel, completion.usage)

    // Track spending for daily caps (NEW!)
    await trackSpending(userId, requestCost)

    // Track usage for admin dashboard
    if (completion.usage) {
      trackAPIUsage(
        selectedModel,
        completion.usage.prompt_tokens,
        completion.usage.completion_tokens,
        'chatgpt/generate'
      )
    }

    console.log('✅ OpenAI response received')
    console.log('📊 Tokens used:', completion.usage?.total_tokens)
    console.log('💰 Request cost:', `$${requestCost.toFixed(4)}`)
    console.log('💾 Cached for 30 days')

    // ============================================
    // STEP 8: Update Usage Counter
    // ============================================
    usageData.count += 1
    usageData.lastUsed = new Date()
    
    await usageRef.set(usageData)

    console.log(`📈 Usage updated: ${usageData.count}/${monthlyLimit}`)

    // ============================================
    // STEP 9: Log Request
    // ============================================
    await logAIRequest({
      userId,
      userTier,
      model: selectedModel,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0
      },
      requestType: 'generate',
      promptLength: prompt.length,
      success: true,
      cached: false,
      validationType: validationType,
      cost: requestCost,
      responseTimeMs: Date.now() - startTime,
      endpoint: '/api/app/chatgpt/generate',
      appVersion
    })

    // ============================================
    // STEP 10: Return Response
    // ============================================
    return res.status(200).json({
      success: true,
      content: content,
      cached: false, // NEW: Let iOS know if cached or fresh
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens
      },
      meta: {
        model: selectedModel,  // Tell client which model was used
        tier: userTier,
        usageCount: usageData.count,
        limit: userTier === 'PRO' ? RATE_LIMITS.PRO_MONTHLY : RATE_LIMITS.FREE_MONTHLY,
        remainingThisMonth: Math.max(0, (userTier === 'PRO' ? RATE_LIMITS.PRO_MONTHLY : RATE_LIMITS.FREE_MONTHLY) - usageData.count),
        validationType: validationType, // Echo back for confirmation
      }
    })

  } catch (error: any) {
    console.error('❌ ChatGPT endpoint error:', error)

    // Log failed request
    try {
      const authHeader = req.headers.authorization
      let userId = 'unknown'
      let userTier: 'FREE' | 'PRO' = 'FREE'
      
      if (authHeader) {
        const token = authHeader.substring(7)
        const decoded = await verifyJWT(token)
        if (decoded) {
          userId = decoded.userId
          const decodedTier = decoded.tier || 'FREE'
          userTier = ((decodedTier as string) === 'PREMIUM' || decodedTier === 'PRO') ? 'PRO' : 'FREE'
        }
      }
      
      await logAIRequest({
        userId,
        userTier,
        model: req.body.model || 'gpt-4o-mini',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        requestType: 'generate',
        promptLength: req.body.prompt?.length || 0,
        success: false,
        errorMessage: error.message,
        responseTimeMs: Date.now() - startTime,
        endpoint: '/api/app/chatgpt/generate',
        appVersion: req.body.appVersion
      })
    } catch (logError) {
      console.error('⚠️ Failed to log error:', logError)
    }

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
