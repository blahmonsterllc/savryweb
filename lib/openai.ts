import OpenAI from 'openai'

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable')
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface RecipeGenerationParams {
  ingredients?: string[]
  cuisine?: string
  dietaryRestrictions?: string[]
  cookingTime?: number
  servings?: number
  difficulty?: string
  budget?: number
}

export async function generateRecipe(params: RecipeGenerationParams) {
  const prompt = buildRecipePrompt(params)
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a professional chef and recipe developer. Generate detailed, practical recipes in JSON format.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.8,
  })

  const response = completion.choices[0].message.content
  if (!response) throw new Error('No response from OpenAI')
  
  return JSON.parse(response)
}

/**
 * SMART Recipe Generator - Uses grocery deals
 * This is the enhanced version that incorporates current grocery deals
 * to help users save money while cooking.
 */
export interface SmartRecipeParams extends RecipeGenerationParams {
  deals?: Array<{
    itemName: string
    discountPrice: number
    storeName: string
    discountPercent: number
    aisle?: string
    section?: string
  }>
  zipCode?: string
  preferredStores?: string[]
}

export async function generateSmartRecipe(params: SmartRecipeParams) {
  const prompt = buildSmartRecipePrompt(params)
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o', // Premium model for meal planning & recipes with deals
    messages: [
      {
        role: 'system',
        content: 'You are a professional chef who creates delicious, creative, restaurant-quality recipes. You help users save money by incorporating grocery deals while maintaining high quality and variety. Always respond in valid JSON format.'
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

  const response = completion.choices[0].message.content
  if (!response) throw new Error('No response from OpenAI')
  
  return JSON.parse(response)
}

export async function generateMealPlan(params: {
  days: number
  budget?: number
  dietaryRestrictions?: string[]
  discounts?: Array<{ itemName: string; discountPrice: number; storeName: string }>
}) {
  const prompt = buildMealPlanPrompt(params)
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a meal planning expert who creates balanced, budget-friendly weekly meal plans. Always return valid JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const response = completion.choices[0].message.content
  if (!response) throw new Error('No response from OpenAI')
  
  return JSON.parse(response)
}

export async function generateGroceryList(recipes: any[]) {
  const prompt = `Generate a consolidated grocery list from these recipes: ${JSON.stringify(recipes)}. 
  Combine duplicate ingredients and organize by category (produce, dairy, meat, pantry, etc.).
  Return JSON with format: { "items": [{ "name": string, "quantity": string, "unit": string, "category": string }] }`
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a grocery shopping assistant. Organize ingredients efficiently.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  })

  const response = completion.choices[0].message.content
  if (!response) throw new Error('No response from OpenAI')
  
  return JSON.parse(response)
}

function buildRecipePrompt(params: RecipeGenerationParams): string {
  let prompt = 'Generate a detailed recipe with the following requirements:\n'
  
  if (params.ingredients?.length) {
    prompt += `- Use these ingredients: ${params.ingredients.join(', ')}\n`
  }
  if (params.cuisine) {
    prompt += `- Cuisine: ${params.cuisine}\n`
  }
  if (params.dietaryRestrictions?.length) {
    prompt += `- Dietary restrictions: ${params.dietaryRestrictions.join(', ')}\n`
  }
  if (params.cookingTime) {
    prompt += `- Maximum cooking time: ${params.cookingTime} minutes\n`
  }
  if (params.servings) {
    prompt += `- Servings: ${params.servings}\n`
  }
  if (params.difficulty) {
    prompt += `- Difficulty: ${params.difficulty}\n`
  }
  if (params.budget) {
    prompt += `- Budget: $${params.budget} per serving\n`
  }
  
  prompt += `\nReturn a JSON object with this structure:
{
  "name": "Recipe Name",
  "description": "Brief description",
  "ingredients": [
    { "name": "ingredient", "quantity": "1", "unit": "cup" }
  ],
  "instructions": [
    "Step 1 description",
    "Step 2 description"
  ],
  "prepTime": 15,
  "cookTime": 30,
  "servings": 4,
  "calories": 350,
  "difficulty": "medium",
  "cuisine": "Italian",
  "dietaryTags": ["vegetarian"]
}`
  
  return prompt
}

function buildMealPlanPrompt(params: {
  days: number
  budget?: number
  dietaryRestrictions?: string[]
  discounts?: Array<{ itemName: string; discountPrice: number; storeName: string }>
}): string {
  let prompt = `Create a ${params.days}-day meal plan with breakfast, lunch, and dinner.\n`
  
  if (params.budget) {
    prompt += `Total budget: $${params.budget}\n`
  }
  if (params.dietaryRestrictions?.length) {
    prompt += `Dietary restrictions: ${params.dietaryRestrictions.join(', ')}\n`
  }
  if (params.discounts?.length) {
    prompt += `\nAvailable discounts at local supermarkets:\n`
    params.discounts.forEach(d => {
      prompt += `- ${d.itemName} at $${d.discountPrice} (${d.storeName})\n`
    })
    prompt += `Please prioritize these discounted items to maximize savings.\n`
  }
  
  prompt += `\nReturn JSON with this structure:
{
  "mealPlan": {
    "name": "Weekly Meal Plan",
    "totalCost": 75.50,
    "days": [
      {
        "day": 0,
        "meals": {
          "breakfast": { "name": "...", "ingredients": [...], "instructions": [...], "cost": 3.50 },
          "lunch": { "name": "...", "ingredients": [...], "instructions": [...], "cost": 5.00 },
          "dinner": { "name": "...", "ingredients": [...], "instructions": [...], "cost": 8.00 }
        }
      }
    ]
  }
}`
  
  return prompt
}

function buildSmartRecipePrompt(params: SmartRecipeParams): string {
  let prompt = 'Generate a detailed, practical recipe with the following requirements:\n\n'
  
  if (params.ingredients?.length) {
    prompt += `- Use these ingredients: ${params.ingredients.join(', ')}\n`
  }
  if (params.cuisine) {
    prompt += `- Cuisine: ${params.cuisine}\n`
  }
  if (params.dietaryRestrictions?.length) {
    prompt += `- Dietary restrictions: ${params.dietaryRestrictions.join(', ')}\n`
  }
  if (params.cookingTime) {
    prompt += `- Maximum cooking time: ${params.cookingTime} minutes\n`
  }
  if (params.servings) {
    prompt += `- Servings: ${params.servings}\n`
  }
  if (params.difficulty) {
    prompt += `- Difficulty: ${params.difficulty}\n`
  }
  if (params.budget) {
    prompt += `- Budget: $${params.budget}\n`
  }

  // Add deals to prompt
  if (params.deals?.length) {
    prompt += `\n**Available Grocery Deals:**\n`
    prompt += 'Please incorporate these sale items to help save money:\n'
    params.deals.forEach(deal => {
      prompt += `- ${deal.itemName}: $${deal.discountPrice} (${deal.discountPercent}% off at ${deal.storeName})`
      if (deal.aisle && deal.section) {
        prompt += ` - Located in ${deal.aisle}, ${deal.section}`
      }
      prompt += '\n'
    })
    prompt += '\nUse as many of these deals as possible while maintaining recipe quality.\n'
  }
  
  prompt += `\nReturn a JSON object with this structure:
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
      "aisle": "Aisle 5",
      "section": "Spices"
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
    "Pro tip 1: Storage advice...",
    "Pro tip 2: Substitution options..."
  ]
}

Be specific with quantities and include aisle locations where applicable!`
  
  return prompt
}







