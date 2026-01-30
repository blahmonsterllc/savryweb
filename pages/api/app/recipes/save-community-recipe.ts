import { NextApiRequest, NextApiResponse } from 'next'
import { verifyJWT } from '@/lib/auth'
import { db } from '@/lib/firebase'

/**
 * Save Community Recipe API
 * 
 * Saves recipes imported from videos to the community database
 * If recipe already exists (same sourceUrl), increments importCount
 * 
 * This builds a valuable recipe database over time!
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.replace('Bearer ', '')
    const decoded = await verifyJWT(token)

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const {
      recipe,
      sourceType,
      sourcePlatform,
      sourceUrl,
      sourceVideoId,
      userId,
      username,
      isPublic = true,
      extractionMethod,
      extractionConfidence,
    } = req.body

    // Validate required fields
    if (!recipe || !sourceUrl) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['recipe', 'sourceUrl'],
      })
    }

    if (!recipe.title || !recipe.ingredients || !recipe.instructions) {
      return res.status(400).json({
        error: 'Incomplete recipe data',
        required: ['recipe.title', 'recipe.ingredients', 'recipe.instructions'],
      })
    }

    console.log(`\n🍳 Saving community recipe:`)
    console.log(`  Title: ${recipe.title}`)
    console.log(`  Source: ${sourcePlatform} - ${sourceUrl}`)
    console.log(`  User: ${username || decoded.email}`)

    // Check if recipe already exists (by sourceUrl)
    const existingRecipesSnapshot = await db
      .collection('community_recipes')
      .where('sourceUrl', '==', sourceUrl)
      .limit(1)
      .get()

    if (!existingRecipesSnapshot.empty) {
      // Recipe already exists - increment import count
      const existingDoc = existingRecipesSnapshot.docs[0]
      const existingData = existingDoc.data()

      await existingDoc.ref.update({
        importCount: (existingData.importCount || 1) + 1,
        updatedAt: new Date(),
        viewCount: (existingData.viewCount || 0) + 1,
      })

      console.log(`✅ Recipe already exists. Incremented importCount to ${(existingData.importCount || 1) + 1}`)

      return res.status(200).json({
        success: true,
        recipeId: existingDoc.id,
        existed: true,
        importCount: (existingData.importCount || 1) + 1,
        message: 'Recipe already in database. Import count incremented.',
      })
    }

    // Create new recipe
    const now = new Date()
    const newRecipe = {
      // Recipe content
      title: recipe.title,
      description: recipe.description || '',
      cuisine: recipe.cuisine || '',
      difficulty: recipe.difficulty || 'Medium',

      // Ingredients
      ingredients: recipe.ingredients.map((ing: any, index: number) => ({
        id: ing.id || `ing_${index}`,
        name: ing.name || ing.ingredient,
        amount: ing.amount || ing.quantity || '',
        unit: ing.unit || '',
        preparation: ing.preparation || '',
      })),

      // Instructions
      instructions: recipe.instructions.map((inst: any, index: number) => ({
        step: inst.step || index + 1,
        text: inst.text || inst.instruction || inst,
      })),

      // Nutrition (optional)
      nutrition: recipe.nutrition || null,

      // Serving info
      servings: recipe.servings || 4,
      servingType: recipe.servingType || 'servings',
      yieldUnit: recipe.yieldUnit || null,
      prepTime: recipe.prepTime || 0,
      cookTime: recipe.cookTime || 0,
      totalTime: recipe.totalTime || recipe.prepTime + recipe.cookTime || 0,

      // Source tracking
      sourceType: sourceType || 'video',
      sourcePlatform: sourcePlatform || null,
      sourceUrl,
      sourceVideoId: sourceVideoId || null,

      // User who imported
      importedBy: userId || decoded.userId,
      importedByUsername: username || decoded.email.split('@')[0],

      // Metadata
      createdAt: now,
      updatedAt: now,
      importCount: 1,
      viewCount: 0,
      likeCount: 0,

      // Flags
      isPublic,
      isFeatured: false,
      isVerified: false,

      // Tags
      tags: recipe.tags || [],
      allergens: recipe.allergens || [],
      dietary: recipe.dietary || [],

      // AI metadata
      extractionMethod: extractionMethod || 'whisper_ai',
      extractionConfidence: extractionConfidence || 0,

      // Images
      imageUrl: recipe.imageUrl || null,
      thumbnailUrl: recipe.thumbnailUrl || null,
    }

    const docRef = await db.collection('community_recipes').add(newRecipe)

    console.log(`✅ New recipe created: ${docRef.id}`)
    console.log(`   Ingredients: ${newRecipe.ingredients.length}`)
    console.log(`   Steps: ${newRecipe.instructions.length}`)

    // Update daily stats
    try {
      const today = new Date().toISOString().split('T')[0]
      const statsDocId = `stats_${today}`
      const statsRef = db.collection('recipe_statistics').doc(statsDocId)

      const statsSnap = await statsRef.get()
      const existingStats = statsSnap.exists ? statsSnap.data() : {}

      // Update top cuisines
      const topCuisines = existingStats?.topCuisines || {}
      if (newRecipe.cuisine) {
        topCuisines[newRecipe.cuisine.toLowerCase()] =
          (topCuisines[newRecipe.cuisine.toLowerCase()] || 0) + 1
      }

      await statsRef.set(
        {
          date: today,
          topCuisines,
          updatedAt: new Date(),
        },
        { merge: true }
      )
    } catch (statsError) {
      console.error('Error updating recipe stats:', statsError)
      // Don't fail the request if stats update fails
    }

    return res.status(200).json({
      success: true,
      recipeId: docRef.id,
      existed: false,
      importCount: 1,
      message: 'Recipe saved to community database',
    })
  } catch (error: any) {
    console.error('❌ Save community recipe error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to save recipe',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
}
