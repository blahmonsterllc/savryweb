import { NextApiRequest, NextApiResponse } from 'next'
import { openai } from '@/lib/openai'
import { verifyJWT } from '@/lib/auth'
import { trackAPIUsage } from '@/lib/openai-tracker'

/**
 * ChatGPT Endpoint for iOS App
 * Provides a generic ChatGPT interface for the iOS AI Chef and other features
 */
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
    // Verify authentication
    const authHeader = req.headers.authorization
    
    // Allow dev-token in development for easier testing
    let userId = 'dev-user'
    if (process.env.NODE_ENV === 'development' && authHeader === 'Bearer dev-token') {
      console.log('🔓 Using dev-token for development')
    } else {
      // Verify real JWT in production
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

      userId = decoded.userId

      // Optional: Check user tier for rate limiting
      // You can add rate limiting logic here based on user tier
    }

    // Get request body
    const { prompt, systemMessage, maxTokens, model } = req.body

    // Validate request
    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: prompt' 
      })
    }

    // Select model (default to gpt-4o-mini for cost efficiency)
    const selectedModel = model || 'gpt-4o-mini'
    const tokenLimit = maxTokens || 2000

    console.log('🤖 ChatGPT API called')
    console.log('👤 User:', userId)
    console.log('📝 Prompt length:', prompt.length)
    console.log('🎯 Max tokens:', tokenLimit)
    console.log('🧠 Model:', selectedModel)

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages: [
        {
          role: 'system',
          content: systemMessage || 'You are an expert chef who creates delicious, practical recipes. Always provide clear, detailed instructions.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: tokenLimit,
      temperature: 0.7,
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
      throw new Error('OpenAI returned empty response')
    }

    // Track usage
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

    // Return response in format iOS app expects
    return res.status(200).json({
      success: true,
      content: content,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0
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
          error: 'Rate limit exceeded. Please try again later.' 
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
