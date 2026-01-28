# AI Cost Tracking System - Complete Implementation

## 🎯 Why Track AI Costs?

1. **Monitor spending** - Know exactly how much OpenAI costs monthly
2. **Per-user costs** - Identify heavy users and optimize
3. **Pricing strategy** - Ensure subscription fees cover costs + profit
4. **Model performance** - Compare GPT-4o vs GPT-4o-mini ROI
5. **Budget alerts** - Get notified if costs spike unexpectedly

---

## 📊 What Data to Track

### Per Request:
- ✅ User ID (who made the request)
- ✅ Model used (gpt-4o, gpt-4o-mini)
- ✅ Tokens used (input + output)
- ✅ Calculated cost (in USD)
- ✅ Request type (generation, modification, etc.)
- ✅ Success/failure status
- ✅ Timestamp

### Aggregate Metrics:
- ✅ Total cost per day/month
- ✅ Cost per user
- ✅ Cost per model
- ✅ Average cost per request
- ✅ Free vs Pro user costs

---

## 🗄️ Firestore Schema

### Collection: `ai_requests`

```typescript
{
  // Request Info
  id: string,                    // Auto-generated document ID
  userId: string,                // User who made request
  userTier: "FREE" | "PRO",      // User subscription tier
  
  // Model & Tokens
  model: "gpt-4o" | "gpt-4o-mini",
  promptTokens: number,          // Input tokens
  completionTokens: number,      // Output tokens
  totalTokens: number,           // Total tokens used
  
  // Cost Calculation
  costUSD: number,               // Calculated cost in dollars
  inputCostUSD: number,          // Cost of input tokens
  outputCostUSD: number,         // Cost of output tokens
  
  // Request Details
  requestType: "generate" | "modify" | "smart_plan" | "substitution",
  promptLength: number,          // Character count of prompt
  success: boolean,              // Did request succeed?
  errorMessage?: string,         // If failed, why?
  
  // Timing
  responseTimeMs: number,        // How long did it take?
  createdAt: timestamp,          // When request was made
  
  // Optional Analytics
  endpoint: string,              // Which API endpoint
  appVersion?: string,           // iOS app version (if provided)
}
```

**Example Document:**
```json
{
  "id": "req_abc123",
  "userId": "user_xyz789",
  "userTier": "FREE",
  
  "model": "gpt-4o",
  "promptTokens": 450,
  "completionTokens": 800,
  "totalTokens": 1250,
  
  "costUSD": 0.0185,
  "inputCostUSD": 0.00225,
  "outputCostUSD": 0.0160,
  
  "requestType": "modify",
  "promptLength": 1250,
  "success": true,
  
  "responseTimeMs": 3450,
  "createdAt": "2026-01-26T10:30:00Z",
  "endpoint": "/api/app/chatgpt/generate"
}
```

---

## 💻 Server Implementation

### 1. Cost Calculation Helper

Create: `lib/aiCostTracking.ts`

```typescript
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
} as const;

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  model: string;
  tokens: TokenUsage;
}

/**
 * Calculate cost of an OpenAI API call
 */
export function calculateAICost(
  model: string,
  usage: TokenUsage
): CostBreakdown {
  const pricing = AI_PRICING[model as keyof typeof AI_PRICING] || AI_PRICING['gpt-4o-mini'];
  
  const inputCost = usage.promptTokens * pricing.input;
  const outputCost = usage.completionTokens * pricing.output;
  const totalCost = inputCost + outputCost;
  
  return {
    inputCost,
    outputCost,
    totalCost,
    model,
    tokens: usage
  };
}

/**
 * Format cost as human-readable string
 */
export function formatCost(costUSD: number): string {
  if (costUSD < 0.01) {
    return `$${(costUSD * 100).toFixed(4)}¢`;
  }
  return `$${costUSD.toFixed(4)}`;
}

/**
 * Estimate cost before making API call
 */
export function estimateCost(
  model: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): number {
  const pricing = AI_PRICING[model as keyof typeof AI_PRICING] || AI_PRICING['gpt-4o-mini'];
  return (estimatedInputTokens * pricing.input) + (estimatedOutputTokens * pricing.output);
}
```

---

### 2. Cost Tracking Service

Create: `lib/aiCostTracking.ts` (continued)

```typescript
import { db } from './firestore';
import { Timestamp } from 'firebase-admin/firestore';

export interface AIRequestLog {
  userId: string;
  userTier: 'FREE' | 'PRO';
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSD: number;
  inputCostUSD: number;
  outputCostUSD: number;
  requestType: 'generate' | 'modify' | 'smart_plan' | 'substitution';
  promptLength: number;
  success: boolean;
  errorMessage?: string;
  responseTimeMs: number;
  endpoint: string;
  appVersion?: string;
  createdAt: Timestamp;
}

/**
 * Log AI request with cost tracking
 */
export async function logAIRequest(data: {
  userId: string;
  userTier: 'FREE' | 'PRO';
  model: string;
  usage: TokenUsage;
  requestType: string;
  promptLength: number;
  success: boolean;
  errorMessage?: string;
  responseTimeMs: number;
  endpoint: string;
  appVersion?: string;
}): Promise<void> {
  try {
    // Calculate costs
    const cost = calculateAICost(data.model, data.usage);
    
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
    };
    
    // Save to Firestore
    await db.collection('ai_requests').add(logEntry);
    
    console.log(`💰 AI Cost logged: ${formatCost(cost.totalCost)} (${data.model}, ${data.usage.totalTokens} tokens)`);
    
  } catch (error) {
    console.error('❌ Failed to log AI cost:', error);
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
  totalCost: number;
  requestCount: number;
  avgCostPerRequest: number;
  costByModel: Record<string, number>;
}> {
  const snapshot = await db.collection('ai_requests')
    .where('createdAt', '>=', Timestamp.fromDate(startDate))
    .where('createdAt', '<=', Timestamp.fromDate(endDate))
    .where('success', '==', true)
    .get();
  
  let totalCost = 0;
  const costByModel: Record<string, number> = {};
  
  snapshot.forEach(doc => {
    const data = doc.data();
    totalCost += data.costUSD || 0;
    
    if (!costByModel[data.model]) {
      costByModel[data.model] = 0;
    }
    costByModel[data.model] += data.costUSD || 0;
  });
  
  return {
    totalCost,
    requestCount: snapshot.size,
    avgCostPerRequest: snapshot.size > 0 ? totalCost / snapshot.size : 0,
    costByModel
  };
}

/**
 * Get user's cost breakdown
 */
export async function getUserCosts(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalCost: number;
  requestCount: number;
  costByType: Record<string, number>;
}> {
  const snapshot = await db.collection('ai_requests')
    .where('userId', '==', userId)
    .where('createdAt', '>=', Timestamp.fromDate(startDate))
    .where('createdAt', '<=', Timestamp.fromDate(endDate))
    .where('success', '==', true)
    .get();
  
  let totalCost = 0;
  const costByType: Record<string, number> = {};
  
  snapshot.forEach(doc => {
    const data = doc.data();
    totalCost += data.costUSD || 0;
    
    if (!costByType[data.requestType]) {
      costByType[data.requestType] = 0;
    }
    costByType[data.requestType] += data.costUSD || 0;
  });
  
  return {
    totalCost,
    requestCount: snapshot.size,
    costByType
  };
}
```

---

### 3. Update ChatGPT Endpoint with Tracking

Update: `pages/api/app/chatgpt/generate.ts`

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { verifyJWT } from '../../../lib/auth';
import { db } from '../../../lib/firestore';
import { logAIRequest, calculateAICost, formatCost } from '../../../lib/aiCostTracking';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = Date.now();
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify JWT
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verifyJWT(token);
    const userId = decoded.userId;
    const userTier = decoded.tier || 'FREE';

    // Get request data
    const { prompt, systemMessage, maxTokens, model, appVersion } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const isPro = userData?.isPro || userTier === 'PRO';

    // Model selection (same as before)
    const selectedModel = model || 'gpt-4o-mini';
    
    // Rate limiting check (same as before)
    const usageCount = userData?.aiRecipesThisMonth || 0;
    const monthlyLimit = isPro ? 999 : 2;

    if (!isPro && usageCount >= monthlyLimit) {
      // Log failed request (over limit)
      await logAIRequest({
        userId,
        userTier,
        model: selectedModel,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        requestType: 'generate',
        promptLength: prompt.length,
        success: false,
        errorMessage: 'Rate limit exceeded',
        responseTimeMs: Date.now() - startTime,
        endpoint: '/api/app/chatgpt/generate',
        appVersion
      });
      
      return res.status(200).json({
        success: false,
        upgrade: true,
        error: 'Rate limit exceeded',
        usageCount,
        limit: monthlyLimit
      });
    }

    // ===== CALL OPENAI =====
    
    console.log(`🤖 Calling OpenAI with ${selectedModel}...`);
    
    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages: [
        { role: 'system', content: systemMessage || 'You are a helpful cooking assistant.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens || 2000,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content || '';
    const usage = completion.usage;
    const responseTime = Date.now() - startTime;

    // ===== CALCULATE & LOG COST =====
    
    if (usage) {
      const cost = calculateAICost(selectedModel, {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      });
      
      console.log(`💰 Cost: ${formatCost(cost.totalCost)} (${usage.total_tokens} tokens)`);
      
      // Log to Firestore
      await logAIRequest({
        userId,
        userTier,
        model: selectedModel,
        usage: {
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0
        },
        requestType: 'generate',
        promptLength: prompt.length,
        success: true,
        responseTimeMs: responseTime,
        endpoint: '/api/app/chatgpt/generate',
        appVersion
      });
    }

    // ===== UPDATE USER USAGE =====
    
    await db.collection('users').doc(userId).update({
      aiRecipesThisMonth: (userData?.aiRecipesThisMonth || 0) + 1,
      lastAIRequestAt: new Date(),
      updatedAt: new Date()
    });

    // ===== RETURN RESPONSE =====
    
    return res.status(200).json({
      success: true,
      content: content,
      usage: {
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens
      },
      meta: {
        usageCount: usageCount + 1,
        limit: monthlyLimit,
        model: selectedModel
      }
    });

  } catch (error: any) {
    console.error('❌ ChatGPT API error:', error);
    
    // Log failed request
    try {
      await logAIRequest({
        userId: req.body.userId || 'unknown',
        userTier: 'FREE',
        model: req.body.model || 'gpt-4o-mini',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        requestType: 'generate',
        promptLength: req.body.prompt?.length || 0,
        success: false,
        errorMessage: error.message,
        responseTimeMs: Date.now() - startTime,
        endpoint: '/api/app/chatgpt/generate'
      });
    } catch (logError) {
      console.error('❌ Failed to log error:', logError);
    }
    
    return res.status(500).json({
      success: false,
      error: error.message || 'AI request failed',
      content: ''
    });
  }
}
```

---

## 📊 Analytics Dashboard API

Create: `pages/api/admin/ai-costs.ts`

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { verifyJWT } from '../../../lib/auth';
import { getTotalCosts, getUserCosts } from '../../../lib/aiCostTracking';
import { db } from '../../../lib/firestore';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verifyJWT(token);
    
    // TODO: Add admin check
    // if (!decoded.isAdmin) {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }

    const { period = 'month' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    // Get total costs
    const costs = await getTotalCosts(startDate, now);

    // Get user breakdown
    const usersSnapshot = await db.collection('users')
      .orderBy('aiRecipesThisMonth', 'desc')
      .limit(10)
      .get();

    const topUsers = await Promise.all(
      usersSnapshot.docs.map(async (doc) => {
        const userData = doc.data();
        const userCosts = await getUserCosts(doc.id, startDate, now);
        
        return {
          userId: doc.id,
          email: userData.email,
          tier: userData.isPro ? 'PRO' : 'FREE',
          requests: userCosts.requestCount,
          cost: userCosts.totalCost
        };
      })
    );

    return res.status(200).json({
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      summary: {
        totalCost: costs.totalCost,
        totalRequests: costs.requestCount,
        avgCostPerRequest: costs.avgCostPerRequest,
        costByModel: costs.costByModel
      },
      topUsers
    });

  } catch (error: any) {
    console.error('❌ AI costs API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

---

## 🚨 Cost Alerts

Create: `lib/costAlerts.ts`

```typescript
import { getTotalCosts } from './aiCostTracking';

/**
 * Check if costs exceeded threshold
 */
export async function checkCostAlerts(): Promise<void> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const costs = await getTotalCosts(startOfMonth, now);
  
  const monthlyBudget = parseFloat(process.env.AI_MONTHLY_BUDGET || '100');
  const alertThreshold = monthlyBudget * 0.8; // Alert at 80%
  
  if (costs.totalCost >= alertThreshold) {
    console.warn(`⚠️ AI COST ALERT: $${costs.totalCost.toFixed(2)} / $${monthlyBudget} (${((costs.totalCost / monthlyBudget) * 100).toFixed(1)}%)`);
    
    // TODO: Send email/SMS alert
    // await sendAlert({
    //   subject: 'AI Cost Alert',
    //   message: `AI costs are at $${costs.totalCost.toFixed(2)} this month (${((costs.totalCost / monthlyBudget) * 100).toFixed(1)}% of budget)`
    // });
  }
}

/**
 * Run this as a cron job daily
 * Vercel: https://vercel.com/docs/cron-jobs
 */
export async function dailyCostCheck() {
  try {
    await checkCostAlerts();
  } catch (error) {
    console.error('❌ Daily cost check failed:', error);
  }
}
```

---

## 📈 Sample Analytics Queries

### Get monthly costs:
```typescript
const costs = await getTotalCosts(
  new Date(2026, 0, 1),  // Jan 1, 2026
  new Date(2026, 0, 31)  // Jan 31, 2026
);

console.log(`Total: $${costs.totalCost.toFixed(2)}`);
console.log(`Requests: ${costs.requestCount}`);
console.log(`Avg/request: $${costs.avgCostPerRequest.toFixed(4)}`);
console.log(`By model:`, costs.costByModel);
```

### Get top spenders:
```typescript
const snapshot = await db.collection('ai_requests')
  .where('createdAt', '>=', startOfMonth)
  .orderBy('costUSD', 'desc')
  .limit(10)
  .get();

snapshot.forEach(doc => {
  const data = doc.data();
  console.log(`${data.userId}: $${data.costUSD.toFixed(4)}`);
});
```

### Compare Free vs Pro costs:
```typescript
const freeSnapshot = await db.collection('ai_requests')
  .where('userTier', '==', 'FREE')
  .where('createdAt', '>=', startOfMonth)
  .get();

const proSnapshot = await db.collection('ai_requests')
  .where('userTier', '==', 'PRO')
  .where('createdAt', '>=', startOfMonth)
  .get();

let freeCost = 0;
freeSnapshot.forEach(doc => freeCost += doc.data().costUSD);

let proCost = 0;
proSnapshot.forEach(doc => proCost += doc.data().costUSD);

console.log(`Free users: $${freeCost.toFixed(2)} (${freeSnapshot.size} requests)`);
console.log(`Pro users: $${proCost.toFixed(2)} (${proSnapshot.size} requests)`);
```

---

## ✅ Deployment Checklist

### Code Files to Create:
- [ ] `lib/aiCostTracking.ts` - Cost calculation & tracking
- [ ] `pages/api/admin/ai-costs.ts` - Analytics API
- [ ] `lib/costAlerts.ts` - Budget alerts

### Environment Variables:
```env
AI_MONTHLY_BUDGET=100  # Alert when costs approach this
```

### Firestore Indexes:
```
Collection: ai_requests
- createdAt (descending)
- userId + createdAt (compound)
- userTier + createdAt (compound)
- success + createdAt (compound)
```

### Testing:
- [ ] Make test AI request
- [ ] Verify cost logged to Firestore
- [ ] Check cost calculation accuracy
- [ ] Test analytics endpoint
- [ ] Verify cost alerts work

---

## 🎯 Summary

**What to Track:**
- ✅ Every AI request with full details
- ✅ Token usage (input + output)
- ✅ Calculated costs per request
- ✅ User tier and request type
- ✅ Success/failure status

**Benefits:**
- ✅ Know exactly how much AI costs
- ✅ Identify expensive users/features
- ✅ Optimize model selection
- ✅ Set profitable pricing
- ✅ Get budget alerts

**Implementation:**
- ✅ Log every request to Firestore
- ✅ Calculate costs using token usage
- ✅ Query costs via admin API
- ✅ Set up budget alerts

**Deploy this tracking system and you'll have complete visibility into AI costs!** 📊
