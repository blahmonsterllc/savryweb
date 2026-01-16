import { NextApiRequest, NextApiResponse } from 'next'
import OpenAI from 'openai'
import { db } from '@/lib/firebase'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { location, storeName } = req.body

    if (!location) {
      return res.status(400).json({ message: 'Location is required' })
    }

    // Get current deals from Firestore
    const dealsSnapshot = await db.collection('supermarketDiscounts')
      .where('location', '==', location)
      .where('validUntil', '>=', new Date())
      .limit(50)
      .get()

    const deals = dealsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    if (deals.length === 0) {
      return res.status(404).json({ message: 'No active deals found for this location' })
    }

    // Use ChatGPT to analyze the deals and suggest meal ideas
    const prompt = `You are a meal planning assistant. Analyze these grocery store deals and suggest 3 budget-friendly meal ideas.

Store Deals:
${deals.map(deal => `- ${deal.itemName}: $${deal.discountPrice} (was $${deal.originalPrice}) - ${deal.discountPercent}% off`).join('\n')}

For each meal suggestion, include:
1. Meal name
2. Which sale items to use
3. Estimated cost for 4 servings
4. Brief cooking instructions (3-4 steps)

Format as JSON array with structure:
{
  "meals": [
    {
      "name": string,
      "ingredients": string[],
      "saleItems": string[],
      "estimatedCost": number,
      "servings": 4,
      "instructions": string[],
      "savingsNote": string
    }
  ]
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Basic model for deal analysis
      messages: [
        {
          role: 'system',
          content: 'You are a helpful meal planning assistant focused on budget-friendly cooking using sale items.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    })

    const analysis = JSON.parse(completion.choices[0].message.content || '{}')

    return res.status(200).json({
      deals: deals.length,
      location,
      analysis: analysis.meals || [],
      generatedAt: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('Deal analysis error:', error)
    return res.status(500).json({ 
      message: 'Failed to analyze deals',
      error: error.message 
    })
  }
}





