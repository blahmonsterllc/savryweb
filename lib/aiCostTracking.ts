import { db } from './firebase'
import { Timestamp } from 'firebase-admin/firestore'

/**
 * AI Cost Tracking System
 * Complete visibility into OpenAI API costs
 */

// Current OpenAI pricing (as of 2024)
// Update these if OpenAI changes pricing
export const AI_PRICING = {
  'gpt-4o': {
    input: 5.00 / 1_000_000,    // $5.00 per 1M input tokens
    output: 20.00 / 1_000_000   // $20.00 per 1M output tokens
  },
  'gpt-4o-mini': {
    input: 0.15 / 1_000_000,    // $0.15 per 1M input tokens
    output: 0.60 / 1_000_000    // $0.60 per 1M output tokens
  },
  'gpt-3.5-turbo': {
    input: 0.50 / 1_000_000,    // $0.50 per 1M input tokens
    output: 1.50 / 1_000_000    // $1.50 per 1M output tokens
  }
} as const

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface CostBreakdown {
  inputCost: number
  outputCost: number
  totalCost: number
  model: string
  tokens: TokenUsage
}

export interface AIRequestLog {
  userId: string
  userTier: 'FREE' | 'PRO'
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUSD: number
  inputCostUSD: number
  outputCostUSD: number
  requestType: 'generate' | 'modify' | 'smart_plan' | 'substitution' | 'unknown'
  promptLength: number
  success: boolean
  errorMessage?: string
  responseTimeMs: number
  endpoint: string
  appVersion?: string
  createdAt: Timestamp
}

/**
 * Calculate cost of an OpenAI API call
 */
export function calculateAICost(
  model: string,
  usage: TokenUsage
): CostBreakdown {
  const pricing = AI_PRICING[model as keyof typeof AI_PRICING] || AI_PRICING['gpt-4o-mini']
  
  const inputCost = usage.promptTokens * pricing.input
  const outputCost = usage.completionTokens * pricing.output
  const totalCost = inputCost + outputCost
  
  return {
    inputCost,
    outputCost,
    totalCost,
    model,
    tokens: usage
  }
}

/**
 * Format cost as human-readable string
 */
export function formatCost(costUSD: number): string {
  if (costUSD < 0.01) {
    return `$${(costUSD * 100).toFixed(4)}¢`
  }
  return `$${costUSD.toFixed(4)}`
}

/**
 * Estimate cost before making API call
 */
export function estimateCost(
  model: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): number {
  const pricing = AI_PRICING[model as keyof typeof AI_PRICING] || AI_PRICING['gpt-4o-mini']
  return (estimatedInputTokens * pricing.input) + (estimatedOutputTokens * pricing.output)
}

/**
 * Log AI request with cost tracking
 */
export async function logAIRequest(data: {
  userId: string
  userTier: 'FREE' | 'PRO'
  model: string
  usage: TokenUsage
  requestType: string
  promptLength: number
  success: boolean
  errorMessage?: string
  responseTimeMs: number
  endpoint: string
  appVersion?: string
}): Promise<void> {
  try {
    console.log('📝 Starting AI request logging...')
    console.log(`   User: ${data.userId}, Tier: ${data.userTier}`)
    console.log(`   Model: ${data.model}, Tokens: ${data.usage.totalTokens}`)
    
    // Calculate costs
    const cost = calculateAICost(data.model, data.usage)
    console.log(`   Cost calculated: $${cost.totalCost.toFixed(6)}`)
    
    // Create log entry
    const logEntry: AIRequestLog = {
      userId: data.userId,
      userTier: data.userTier,
      model: data.model,
      promptTokens: data.usage.promptTokens,
      completionTokens: data.usage.completionTokens,
      totalTokens: data.usage.totalTokens,
      costUSD: cost.totalCost,
      inputCostUSD: cost.inputCost,
      outputCostUSD: cost.outputCost,
      requestType: data.requestType as any,
      promptLength: data.promptLength,
      success: data.success,
      errorMessage: data.errorMessage,
      responseTimeMs: data.responseTimeMs,
      endpoint: data.endpoint,
      appVersion: data.appVersion,
      createdAt: Timestamp.now()
    }
    
    console.log('   Writing to Firestore ai_requests collection...')
    // Save to Firestore
    const docRef = await db.collection('ai_requests').add(logEntry)
    console.log(`✅ AI Cost logged successfully! Doc ID: ${docRef.id}`)
    console.log(`💰 ${formatCost(cost.totalCost)} (${data.model}, ${data.usage.totalTokens} tokens)`)
    
  } catch (error: any) {
    console.error('❌ Failed to log AI cost:', error)
    console.error('   Error details:', error.message)
    console.error('   Stack:', error.stack)
    // Don't throw - logging failures shouldn't break API
  }
}

/**
 * Get total costs for time period
 */
export async function getTotalCosts(
  startDate: Date,
  endDate: Date
): Promise<{
  totalCost: number
  requestCount: number
  avgCostPerRequest: number
  costByModel: Record<string, number>
  tokensByModel: Record<string, number>
}> {
  // Query with only createdAt filter (no composite index needed)
  const snapshot = await db.collection('ai_requests')
    .where('createdAt', '>=', Timestamp.fromDate(startDate))
    .where('createdAt', '<=', Timestamp.fromDate(endDate))
    .get()
  
  let totalCost = 0
  let successCount = 0
  const costByModel: Record<string, number> = {}
  const tokensByModel: Record<string, number> = {}
  
  // Filter for success in memory
  snapshot.forEach(doc => {
    const data = doc.data()
    
    // Only count successful requests
    if (data.success === true) {
      successCount++
      totalCost += data.costUSD || 0
      
      if (!costByModel[data.model]) {
        costByModel[data.model] = 0
        tokensByModel[data.model] = 0
      }
      costByModel[data.model] += data.costUSD || 0
      tokensByModel[data.model] += data.totalTokens || 0
    }
  })
  
  return {
    totalCost,
    requestCount: successCount,
    avgCostPerRequest: successCount > 0 ? totalCost / successCount : 0,
    costByModel,
    tokensByModel
  }
}

/**
 * Get user's cost breakdown
 */
export async function getUserCosts(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalCost: number
  requestCount: number
  costByType: Record<string, number>
}> {
  // Query without success filter (no composite index needed)
  const snapshot = await db.collection('ai_requests')
    .where('userId', '==', userId)
    .where('createdAt', '>=', Timestamp.fromDate(startDate))
    .where('createdAt', '<=', Timestamp.fromDate(endDate))
    .get()
  
  let totalCost = 0
  let successCount = 0
  const costByType: Record<string, number> = {}
  
  // Filter for success in memory
  snapshot.forEach(doc => {
    const data = doc.data()
    
    if (data.success === true) {
      successCount++
      totalCost += data.costUSD || 0
      
      if (!costByType[data.requestType]) {
        costByType[data.requestType] = 0
      }
      costByType[data.requestType] += data.costUSD || 0
    }
  })
  
  return {
    totalCost,
    requestCount: successCount,
    costByType
  }
}

/**
 * Get daily cost breakdown for charts
 */
export async function getDailyCosts(
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string; cost: number; requests: number }>> {
  // Query without success filter (no composite index needed)
  const snapshot = await db.collection('ai_requests')
    .where('createdAt', '>=', Timestamp.fromDate(startDate))
    .where('createdAt', '<=', Timestamp.fromDate(endDate))
    .get()
  
  const dailyData: Record<string, { cost: number; requests: number }> = {}
  
  // Filter for success in memory
  snapshot.forEach(doc => {
    const data = doc.data()
    
    if (data.success === true) {
      const date = data.createdAt.toDate().toISOString().split('T')[0]
      
      if (!dailyData[date]) {
        dailyData[date] = { cost: 0, requests: 0 }
      }
      
      dailyData[date].cost += data.costUSD || 0
      dailyData[date].requests += 1
    }
  })
  
  return Object.entries(dailyData)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
