/**
 * Smart AI Recipe Generator with Grocery Deals
 * 
 * This endpoint generates recipes using available grocery deals
 * to help users save money while cooking.
 * 
 * Works alongside the Smart Meal Plan feature using the same
 * server-side ChatGPT approach.
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { verifyJWT } from '@/lib/auth'
import { db } from '@/lib/firebase'
import { openai } from '@/lib/openai'
import { buildAICacheKey, getAICache, recordAICacheHit, setAICache, sha256Stable, weekBucket } from '@/lib/ai-cache'

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
    const { userId, tier } = await verifyJWT(token)

    // ========================================
    // 2. VALIDATE REQUEST
    // ========================================
    const {
      ingredients = [],
      cuisine,
      dietaryRestrictions = [],
      cookingTime,
      servings = 4,
      difficulty,
      budget,
      useDeals = false,        // NEW: Use grocery deals
      preferredStores = [],    // NEW: User's stores
      zipCode,                 // NEW: User's location
    } = req.body

    // ========================================
    // 3. FIND RELEVANT DEALS (if requested)
    // ========================================
    let availableDeals: any[] = []
    
    if (useDeals && zipCode) {
      console.log(`🔍 Finding deals for recipe in ${zipCode}...`)
      
      const dealsSnapshot = await db
        .collection('supermarketDiscounts')
        .where('zipCode', '==', zipCode)
        .where('validUntil', '>', new Date())
        .orderBy('validUntil')
        .orderBy('discountPercent', 'desc')
        .limit(30)
        .get()

      availableDeals = dealsSnapshot.docs.map(doc => doc.data())

      // Filter by preferred stores if specified
      if (preferredStores.length > 0) {
        availableDeals = availableDeals.filter(deal => 
          preferredStores.includes(deal.storeName)
        )
      }

      // Filter to ingredients relevant for cooking
      availableDeals = availableDeals.filter(deal => 
        ['Produce', 'Meat', 'Seafood', 'Dairy', 'Pantry', 'Bakery', 'Spices'].includes(deal.category)
      )

      console.log(`✅ Found ${availableDeals.length} relevant deals`)
    }
    const dealsAvailable = Boolean(useDeals && zipCode && availableDeals.length > 0)

    // ========================================
    // 3.5 CACHE: REGION (deal-based) OR USER (ingredient-based)
    // ========================================
    const storesKey = (preferredStores || []).map((s: string) => s.trim()).filter(Boolean).sort()
    const restrictionsKey = (dietaryRestrictions || []).map((s: string) => String(s).trim()).filter(Boolean).sort()
    const ingredientsKey = (ingredients || []).map((s: string) => String(s).trim().toLowerCase()).filter(Boolean).sort()

    const isDealBasedRegional =
      Boolean(useDeals && zipCode && ingredientsKey.length === 0 && dealsAvailable) // only regional-cache when deals are actually present

    const dealsHash = availableDeals.length
      ? sha256Stable(
          availableDeals
            .map((d: any) => ({
              itemName: d.itemName,
              storeName: d.storeName,
              discountPrice: d.discountPrice,
              discountPercent: d.discountPercent,
              validUntil: d.validUntil,
            }))
            .sort((a: any, b: any) => String(a.itemName).localeCompare(String(b.itemName)))
        )
      : null

    const { key: cacheKey, docId: cacheDocId } = buildAICacheKey({
      scope: isDealBasedRegional ? 'REGION' : 'USER',
      namespace: 'smart_recipe',
      version: 1,
      parts: {
        scope: isDealBasedRegional ? 'REGION' : 'USER',
        userId: isDealBasedRegional ? null : userId,
        useDeals: Boolean(useDeals),
        zipCode: zipCode || null,
        stores: storesKey,
        dealsHash,
        dealsAvailable,
        ingredients: isDealBasedRegional ? [] : ingredientsKey,
        cuisine: cuisine || null,
        dietaryRestrictions: restrictionsKey,
        cookingTime: cookingTime || null,
        servings,
        difficulty: difficulty || null,
        budget: budget || null,
        weekBucket: weekBucket(),
      },
    })

    const cached = await getAICache<any>(cacheDocId)
    let result: any | null = null
    if (cached) {
      await recordAICacheHit(cacheDocId)
      result = cached.payload
      console.log(`🧠 Cache hit for ${cacheDocId}`)
    }

    // ========================================
    // 4. BUILD SMART PROMPT
    // ========================================
    let prompt = 'You are a professional chef and recipe developer. Generate a detailed, practical recipe.\n\n'
    
    prompt += '**Requirements:**\n'
    
    if (ingredients.length > 0) {
      prompt += `- Use these ingredients: ${ingredients.join(', ')}\n`
    }
    if (cuisine) {
      prompt += `- Cuisine: ${cuisine}\n`
    }
    if (dietaryRestrictions.length > 0) {
      prompt += `- Dietary restrictions: ${dietaryRestrictions.join(', ')}\n`
    }
    if (cookingTime) {
      prompt += `- Maximum cooking time: ${cookingTime} minutes\n`
    }
    if (servings) {
      prompt += `- Servings: ${servings}\n`
    }
    if (difficulty) {
      prompt += `- Difficulty: ${difficulty}\n`
    }
    if (budget) {
      prompt += `- Budget: $${budget} total\n`
    }

    // Add deals to prompt
    if (availableDeals.length > 0) {
      prompt += `\n**Available Grocery Deals:**\n`
      prompt += 'Please incorporate these sale items to help the user save money:\n'
      availableDeals.slice(0, 15).forEach(deal => {
        prompt += `- ${deal.itemName}: $${deal.discountPrice} (${deal.discountPercent}% off at ${deal.storeName})\n`
      })
      prompt += '\nUse as many of these deals as possible while maintaining recipe quality.\n'
    } else if (useDeals && zipCode) {
      prompt += `\n**Deals Requested:**\nNo verified deals were found for this ZIP right now. Do NOT claim items are on sale and do NOT invent deal pricing.\n`
    }

    prompt += `\n**Output Format (JSON):**
{
  "name": "Recipe Name",
  "description": "Brief description of the dish",
  "ingredients": [
    {
      "name": "ingredient name",
      "quantity": "1",
      "unit": "cup",
      "price": 2.99,
      "store": "Kroger",
      "onSale": true,
      "aisle": null,
      "section": null
    }
  ],
  "instructions": [
    "Step 1: Detailed instruction...",
    "Step 2: Detailed instruction..."
  ],
  "prepTime": 15,
  "cookTime": 30,
  "totalTime": 45,
  "servings": 4,
  "calories": 350,
  "difficulty": "medium",
  "cuisine": "Italian",
  "dietaryTags": ["vegetarian", "gluten-free"],
  "estimatedCost": 12.50,
  "savingsFromDeals": 5.00,
  "tips": [
    "Pro tip 1...",
    "Pro tip 2..."
  ]
}

Be specific with quantities. Do NOT include aisle locations (set aisle to null).`

    // ========================================
    // 5. CALL CHATGPT (SERVER-SIDE ONLY!)
    // ========================================
    if (!result) {
      console.log('🤖 Asking ChatGPT to generate recipe...')

      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a professional chef who creates delicious, practical recipes. You help users save money by incorporating grocery deals. Always respond in valid JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 2000,
      })

      result = JSON.parse(completion.choices[0].message.content || '{}')

      await setAICache({
        docId: cacheDocId,
        key: cacheKey,
        scope: isDealBasedRegional ? 'REGION' : 'USER',
        ttlSeconds: isDealBasedRegional ? 12 * 60 * 60 : 7 * 24 * 60 * 60,
        payload: result,
        meta: {
          zipCode: zipCode || null,
          stores: storesKey,
          dealsHash,
        },
      })
    }

    // ========================================
    // 6. SAVE TO DATABASE
    // ========================================
    console.log('💾 Saving recipe...')

    const recipeRef = await db.collection('recipes').add({
      userId,
      name: result.name,
      description: result.description,
      ingredients: result.ingredients,
      instructions: result.instructions,
      prepTime: result.prepTime,
      cookTime: result.cookTime,
      totalTime: result.totalTime || (result.prepTime || 0) + (result.cookTime || 0),
      servings: result.servings,
      calories: result.calories,
      difficulty: result.difficulty,
      cuisine: result.cuisine,
      dietaryTags: result.dietaryTags || [],
      estimatedCost: result.estimatedCost,
      savingsFromDeals: result.savingsFromDeals || 0,
      tips: result.tips || [],
      usedDeals: useDeals,
      dealsIncluded: availableDeals.length,
      autoGenerated: true,
      source: 'SMART_AI',
      aiCache: {
        key: cacheDocId,
        scope: isDealBasedRegional ? 'REGION' : 'USER',
        hit: Boolean(cached),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    console.log(`✅ Recipe saved with ID: ${recipeRef.id}`)

    // ========================================
    // 7. RETURN RESPONSE
    // ========================================
    return res.status(200).json({
      success: true,
      recipeId: recipeRef.id,
      recipe: result,
      metadata: {
        dealsUsed: availableDeals.length,
        estimatedCost: result.estimatedCost,
        savings: result.savingsFromDeals || 0,
        usedStores: preferredStores,
      }
    })

  } catch (error: any) {
    console.error('Smart recipe generation error:', error)

    // Handle OpenAI errors
    if (error.code === 'insufficient_quota') {
      return res.status(500).json({
        message: 'OpenAI API quota exceeded. Please contact support.',
        error: 'quota_exceeded'
      })
    }

    return res.status(500).json({
      message: 'Failed to generate recipe',
      error: error.message
    })
  }
}
