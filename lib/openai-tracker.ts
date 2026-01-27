/**
 * OpenAI API Usage Tracker
 * Tracks API calls, tokens, and estimated costs
 */

export interface APIUsageEntry {
  timestamp: number
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCost: number
  endpoint: string
}

export interface UsageStats {
  totalCalls: number
  totalTokens: number
  totalCost: number
  last24Hours: {
    calls: number
    tokens: number
    cost: number
  }
  last7Days: {
    calls: number
    tokens: number
    cost: number
  }
  byModel: Record<string, {
    calls: number
    tokens: number
    cost: number
  }>
  recentCalls: APIUsageEntry[]
  hourlyData: Array<{
    hour: string
    calls: number
    tokens: number
    cost: number
  }>
}

// In-memory storage (resets on server restart)
// For persistence, move this to Firebase or a database
const usageLog: APIUsageEntry[] = []
const MAX_LOG_SIZE = 10000 // Keep last 10k entries

// Pricing per 1M tokens (as of 2024)
const MODEL_PRICING = {
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.150, output: 0.600 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
}

/**
 * Calculate cost based on model and tokens
 */
function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING] || MODEL_PRICING['gpt-4o-mini']
  const inputCost = (promptTokens / 1000000) * pricing.input
  const outputCost = (completionTokens / 1000000) * pricing.output
  return inputCost + outputCost
}

/**
 * Track an API call
 */
export function trackAPIUsage(
  model: string,
  promptTokens: number,
  completionTokens: number,
  endpoint: string
): void {
  const entry: APIUsageEntry = {
    timestamp: Date.now(),
    model,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCost: calculateCost(model, promptTokens, completionTokens),
    endpoint,
  }

  usageLog.push(entry)

  // Trim log if too large
  if (usageLog.length > MAX_LOG_SIZE) {
    usageLog.splice(0, usageLog.length - MAX_LOG_SIZE)
  }
}

/**
 * Get usage statistics
 */
export function getUsageStats(): UsageStats {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const week = 7 * day
  const last24h = now - day
  const last7d = now - week

  // Overall stats
  let totalCalls = usageLog.length
  let totalTokens = 0
  let totalCost = 0

  // Time-based stats
  let calls24h = 0
  let tokens24h = 0
  let cost24h = 0
  let calls7d = 0
  let tokens7d = 0
  let cost7d = 0

  // Model breakdown
  const byModel: Record<string, { calls: number; tokens: number; cost: number }> = {}

  // Hourly data for graph (last 24 hours)
  const hourlyMap = new Map<string, { calls: number; tokens: number; cost: number }>()

  usageLog.forEach((entry) => {
    totalTokens += entry.totalTokens
    totalCost += entry.estimatedCost

    // Last 24 hours
    if (entry.timestamp >= last24h) {
      calls24h++
      tokens24h += entry.totalTokens
      cost24h += entry.estimatedCost

      // Hourly breakdown
      const hour = new Date(entry.timestamp).toISOString().slice(0, 13) + ':00'
      const hourData = hourlyMap.get(hour) || { calls: 0, tokens: 0, cost: 0 }
      hourData.calls++
      hourData.tokens += entry.totalTokens
      hourData.cost += entry.estimatedCost
      hourlyMap.set(hour, hourData)
    }

    // Last 7 days
    if (entry.timestamp >= last7d) {
      calls7d++
      tokens7d += entry.totalTokens
      cost7d += entry.estimatedCost
    }

    // By model
    if (!byModel[entry.model]) {
      byModel[entry.model] = { calls: 0, tokens: 0, cost: 0 }
    }
    byModel[entry.model].calls++
    byModel[entry.model].tokens += entry.totalTokens
    byModel[entry.model].cost += entry.estimatedCost
  })

  // Convert hourly map to array and sort
  const hourlyData = Array.from(hourlyMap.entries())
    .map(([hour, data]) => ({ hour, ...data }))
    .sort((a, b) => a.hour.localeCompare(b.hour))

  // Get recent calls (last 10)
  const recentCalls = usageLog.slice(-10).reverse()

  return {
    totalCalls,
    totalTokens,
    totalCost,
    last24Hours: {
      calls: calls24h,
      tokens: tokens24h,
      cost: cost24h,
    },
    last7Days: {
      calls: calls7d,
      tokens: tokens7d,
      cost: cost7d,
    },
    byModel,
    recentCalls,
    hourlyData,
  }
}

/**
 * Clear all usage data (admin only)
 */
export function clearUsageData(): void {
  usageLog.length = 0
}
