import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/firebase'
import OpenAI from 'openai'
import { verifyJWT } from '@/lib/auth' // You'll need to add this helper
import { buildAICacheKey, getAICache, recordAICacheHit, setAICache, sha256Stable, weekBucket } from '@/lib/ai-cache'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * iOS-Specific Smart Meal Plan Generator
 * 
 * This endpoint is designed for your iOS app integration.
 * It requires JWT authentication and follows your existing iOS API patterns.
 * 
 * Endpoint: POST /api/app/meal-plans/smart-generate
 * Auth: Bearer token required
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // ========================================
    // 1. AUTHENTICATE USER
    // ========================================
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.substring(7)
    let userId: string
    let userTier: string

    try {
      const decoded = await verifyJWT(token)
      userId = decoded.userId
      userTier = decoded.tier || 'FREE'
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }

    // ========================================
    // 2. VALIDATE REQUEST
    // ========================================
    const { 
      days = 5, 
      budget, 
      servings = 4,
      dietaryRestrictions = [],
      preferredStores = ['Kroger', 'Walmart'],
      zipCode,
      allowNoDeals = true,
    } = req.body

    if (!zipCode) {
      return res.status(400).json({ message: 'zipCode is required' })
    }

    if (!preferredStores || preferredStores.length === 0) {
      return res.status(400).json({ message: 'preferredStores is required' })
    }

    if (days < 1 || days > 7) {
      return res.status(400).json({ message: 'days must be between 1 and 7' })
    }

    // Check if Pro feature is being used
    if (budget && userTier === 'FREE') {
      return res.status(403).json({ 
        message: 'Budget-based meal planning is a Pro feature',
        upgrade: true 
      })
    }

    // ========================================
    // 3. FIND DEALS FROM USER'S STORES
    // ========================================
    console.log(`🔍 Deal lookup disabled; generating without store deals.`)
    
    const deals: any[] = []
    const dealsAvailable = false
    if (!dealsAvailable && !allowNoDeals) {
      // allowNoDeals defaults true; keep behavior for completeness
      return res.status(200).json({
        success: true,
        dealsAvailable: false,
        message:
          'Deal lookup is currently disabled; generation continues without deals.',
        mealPlan: null,
        shoppingList: null,
        metadata: {
          dealsFound: 0,
          dealsUsed: 0,
          stores: preferredStores,
          zipCode,
        },
      })
    }

    console.log('⚠️ Generating without deals.')

    // Filter to meal-relevant categories (if we have deals)
    const relevantDeals = dealsAvailable
      ? deals.filter(deal => 
          ['Produce', 'Meat', 'Seafood', 'Dairy', 'Pantry', 'Bakery'].includes(deal.category)
        )
      : []

    console.log(`📊 ${relevantDeals.length} relevant meal ingredient deals`)

    // ========================================
    // 3.5 CACHE: REUSE AI OUTPUT FOR SAME REGION+DEALS
    // ========================================
    const dealsHash = sha256Stable(
      relevantDeals
        .map((d: any) => ({
          id: d.id,
          itemName: d.itemName,
          storeName: d.storeName,
          discountPrice: d.discountPrice,
          discountPercent: d.discountPercent,
          validUntil: d.validUntil,
        }))
        .sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)))
    )

    const storesKey = preferredStores.map((s: string) => s.trim()).filter(Boolean).sort()
    const restrictionsKey = (dietaryRestrictions || []).map((s: string) => String(s).trim()).filter(Boolean).sort()

    const { key: cacheKey, docId: cacheDocId } = buildAICacheKey({
      scope: 'REGION',
      namespace: 'smart_meal_plan',
      version: 1,
      parts: {
        zipCode,
        stores: storesKey,
        days,
        servings,
        budget: budget || null,
        dietaryRestrictions: restrictionsKey,
        weekBucket: weekBucket(),
        dealsHash,
        dealsAvailable,
      },
    })

    const cached = await getAICache<any>(cacheDocId)
    let result: any

    if (cached) {
      await recordAICacheHit(cacheDocId)
      result = cached.payload
      console.log(`🧠 Cache hit for ${cacheDocId}`)
    }

    // ========================================
    // 4. USE CHATGPT TO CREATE MEAL PLAN
    // ========================================
    if (!result) {
      console.log('🤖 Asking ChatGPT to create meal plan from deals...')

      const prompt = dealsAvailable
        ? `You are an expert meal planner and nutritionist. Create a ${days}-day meal plan for ${servings} people${budget ? ` with a budget of $${budget}` : ''}.

**Available Grocery Deals:**
${relevantDeals.slice(0, 30).map(d => 
  `- ${d.itemName} at ${d.storeName}: $${d.discountPrice} (${d.discountPercent}% off)`
).join('\n')}

**Requirements:**
${budget ? `- Budget: $${budget} total` : '- Stay budget-friendly'}
- Servings: ${servings} people
- Duration: ${days} days
${dietaryRestrictions.length > 0 ? `- Dietary restrictions: ${dietaryRestrictions.join(', ')}` : ''}
- Build meals around the available deals to maximize savings
- Use ingredients that are on sale
- Do NOT include aisle locations (set any "aisle" fields to null)

**Output Format (JSON):**
{
  "mealPlan": {
    "name": "Budget-Friendly Week",
    "totalCost": 95.50,
    "estimatedSavings": 45.00,
    "days": [
      {
        "day": 1,
        "meals": {
          "breakfast": {
            "name": "Scrambled Eggs & Toast",
            "ingredients": [
              { "item": "Eggs", "amount": "6 eggs", "store": "Kroger", "price": 3.99, "aisle": null, "section": null }
            ],
            "instructions": "1. Beat eggs in a bowl. 2. Heat pan with butter. 3. Cook eggs until fluffy.",
            "estimatedCost": 6.48
          },
          "lunch": {
            "name": "Chicken Caesar Salad",
            "ingredients": [...],
            "instructions": "...",
            "estimatedCost": 11.20
          },
          "dinner": {
            "name": "Chicken Fajitas",
            "ingredients": [...],
            "instructions": "...",
            "estimatedCost": 12.50
          }
        }
      }
    ]
  },
  "shoppingList": {
    "byAisle": {
      "Produce - Aisle 1": [
        { "item": "Lettuce", "amount": "1 head", "price": 1.99, "aisle": null, "section": null, "store": "Kroger" }
      ],
      "Dairy - Aisle 12": [...]
    },
    "byStore": {
      "Kroger": {
        "items": [
          { "item": "Chicken Breast", "amount": "2 lbs", "price": 7.99, "aisle": null, "section": null, "store": "Kroger" }
        ],
        "total": 45.50
      },
      "Walmart": {...}
    }
  }
}

Be specific with quantities and make sure the total stays within budget! Include all necessary ingredients. Remember: no aisle info (aisle must be null).`
        : `You are an expert meal planner. Create a ${days}-day meal plan for ${servings} people${budget ? ` with a budget of $${budget}` : ''}.

**Important:** No verified grocery deals are available. Do NOT claim items are on sale, and do NOT invent store-specific aisle locations.
Set any aisle fields to null and any store fields to null unless explicitly provided by the user.

**Requirements:**
${budget ? `- Budget: $${budget} total` : '- Stay budget-friendly'}
- Servings: ${servings} people
- Duration: ${days} days
${dietaryRestrictions.length > 0 ? `- Dietary restrictions: ${dietaryRestrictions.join(', ')}` : ''}
- Use common, affordable grocery staples
- Keep the ingredient list efficient and reusable across multiple meals

**Output Format (JSON):**
{
  "mealPlan": {
    "name": "Budget-Friendly Week",
    "totalCost": 95.50,
    "estimatedSavings": 0,
    "days": [
      {
        "day": 1,
        "meals": {
          "breakfast": {
            "name": "Oatmeal with Fruit",
            "ingredients": [
              { "item": "Oats", "amount": "2 cups", "store": null, "price": 2.00, "aisle": null, "section": "Pantry" }
            ],
            "instructions": "1. Cook oats. 2. Add fruit.",
            "estimatedCost": 4.00
          },
          "lunch": { "name": "…", "ingredients": [], "instructions": "…", "estimatedCost": 0 },
          "dinner": { "name": "…", "ingredients": [], "instructions": "…", "estimatedCost": 0 }
        }
      }
    ]
  },
  "shoppingList": {
    "byAisle": {},
    "byStore": {}
  }
}`

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o', // Premium model for iOS meal planning
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional chef and meal planning expert. Create diverse, exciting, budget-friendly meal plans based on available grocery deals. Always respond in valid JSON format.' 
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8, // Higher creativity for variety
        max_tokens: 4000,
      })

      result = JSON.parse(completion.choices[0].message.content || '{}')

      // Cache AI output for reuse across users in the same region+week+deal-set.
      await setAICache({
        docId: cacheDocId,
        key: cacheKey,
        scope: 'REGION',
        ttlSeconds: 12 * 60 * 60, // 12h (deals can change, but this avoids frequent re-generation)
        payload: result,
        meta: {
          zipCode,
          stores: storesKey,
          dealsHash,
          dealsAvailable,
        },
      })
    }

    // ========================================
    // 5. SAVE TO FIREBASE
    // ========================================
    console.log('💾 Saving meal plan to Firebase...')

    const mealPlanRef = await db.collection('mealPlans').add({
      userId,
      name: result.mealPlan.name,
      days,
      servings,
      budget: budget || null,
      totalCost: result.mealPlan.totalCost,
      estimatedSavings: result.mealPlan.estimatedSavings,
      dietaryRestrictions,
      preferredStores,
      zipCode,
      dealsUsed: relevantDeals.length,
      shoppingList: result.shoppingList,
      meals: result.mealPlan.days,
      aiCache: {
        key: cacheDocId,
        scope: 'REGION',
        hit: Boolean(cached),
      },
      dealsAvailable,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    console.log(`✅ Meal plan saved with ID: ${mealPlanRef.id}`)

    // ========================================
    // 6. RETURN RESPONSE
    // ========================================
    return res.status(200).json({
      success: true,
      mealPlanId: mealPlanRef.id,
      mealPlan: result.mealPlan,
      shoppingList: result.shoppingList,
      dealsAvailable,
      message: dealsAvailable
        ? undefined
        : 'No verified deals were found for your ZIP + selected stores. Generated a plan without deals.',
      metadata: {
        dealsFound: deals.length,
        dealsUsed: relevantDeals.length,
        stores: preferredStores,
        budget: budget || 0,
        totalCost: result.mealPlan.totalCost,
        savings: result.mealPlan.estimatedSavings,
        savingsPercent: Math.round(
          (result.mealPlan.estimatedSavings / 
          (result.mealPlan.totalCost + result.mealPlan.estimatedSavings)) * 100
        )
      }
    })

  } catch (error: any) {
    console.error('Smart meal plan generation error:', error)
    
    // Handle OpenAI errors
    if (error.code === 'insufficient_quota') {
      return res.status(500).json({ 
        message: 'OpenAI API quota exceeded. Please contact support.',
        error: 'quota_exceeded'
      })
    }

    return res.status(500).json({ 
      message: 'Failed to generate smart meal plan',
      error: error.message 
    })
  }
}

// ========================================
// HELPER: JWT Verification
// ========================================
// You may already have this in your auth lib.
// If not, here's a simple implementation:

/*
import jwt from 'jsonwebtoken'

export async function verifyJWT(token: string): Promise<{ userId: string; tier: string }> {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    return {
      userId: decoded.userId || decoded.id,
      tier: decoded.tier || 'FREE'
    }
  } catch (error) {
    throw new Error('Invalid token')
  }
}
*/




