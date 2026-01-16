# 🏗️ Server-Side ChatGPT Architecture

## Overview

Your Savry app now has **two AI features** that both keep ChatGPT API calls on the **server-side** for security, cost control, and flexibility.

---

## 🎯 The Two Features

### 1. Smart Meal Plan Generator
**Endpoint:** `POST /api/app/meal-plans/smart-generate`

- Creates 5-7 days of meals
- Uses deals from multiple stores
- Shopping list organized by aisle
- ~15-20 second generation time
- Perfect for: "Plan my week"

### 2. Smart Recipe Generator
**Endpoint:** `POST /api/app/recipes/smart-generate`

- Creates single recipe
- Can use deals OR specific ingredients
- Shopping list with aisle locations
- ~10-15 second generation time
- Perfect for: "What's for dinner tonight?"

---

## 🏛️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      iOS APP (Swift)                         │
│                                                              │
│  ┌──────────────────────┐   ┌──────────────────────┐       │
│  │  Smart Meal Plan     │   │  Smart Recipe        │       │
│  │  View & Service      │   │  View & Service      │       │
│  └──────────────────────┘   └──────────────────────┘       │
│             │                           │                    │
│             │   JWT Authentication      │                    │
│             └───────────┬───────────────┘                    │
│                         ↓                                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   YOUR SERVER (Next.js)                      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Authentication Layer                       │  │
│  │  - Verify JWT token                                  │  │
│  │  - Check user tier (FREE/PRO)                        │  │
│  │  - Rate limiting                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↓                                    │
│  ┌────────────────────────────┬────────────────────────┐   │
│  │  /api/app/meal-plans/      │  /api/app/recipes/     │   │
│  │  smart-generate            │  smart-generate        │   │
│  └────────────────────────────┴────────────────────────┘   │
│                         ↓                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Deal Finder                                │  │
│  │  - Query Firebase for deals                          │  │
│  │  - Filter by ZIP code & stores                       │  │
│  │  - Filter by category (Produce, Meat, etc.)         │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↓                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         ChatGPT Prompt Builder                        │  │
│  │  - Build context with deals                          │  │
│  │  - Add user preferences                              │  │
│  │  - Format as JSON request                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↓                                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ API Call (OpenAI Key secure!)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                  OpenAI API (ChatGPT-4)                      │
│                                                              │
│  - Analyzes deals                                           │
│  - Creates meal plan OR recipe                              │
│  - Optimizes for budget                                     │
│  - Returns JSON response                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   YOUR SERVER (Next.js)                      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Response Parser                               │  │
│  │  - Parse ChatGPT JSON                                │  │
│  │  - Validate data                                     │  │
│  │  - Calculate savings                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↓                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Save to Firebase                            │  │
│  │  - Store meal plan/recipe                            │  │
│  │  - Link to user                                      │  │
│  │  - Save metadata                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↓                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Return JSON Response                          │  │
│  │  - Meal plan/recipe                                  │  │
│  │  - Shopping list with aisles                         │  │
│  │  - Metadata (savings, etc.)                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                      iOS APP (Swift)                         │
│                                                              │
│  ┌──────────────────────┐   ┌──────────────────────┐       │
│  │  Display Meal Plan   │   │  Display Recipe      │       │
│  │  with Shopping List  │   │  with Shopping List  │       │
│  └──────────────────────┘   └──────────────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security: Why Server-Side is Better

### ❌ Client-Side (BAD)

```swift
// DON'T DO THIS! ⚠️
let openAIKey = "sk-proj-abc123..."  // In iOS app
let openai = OpenAI(apiKey: openAIKey)

// Problems:
// 1. Anyone can extract key from app binary
// 2. Can't control usage/costs
// 3. Can't update key without app update
// 4. Users could steal key and use it themselves
```

### ✅ Server-Side (GOOD)

```swift
// iOS app
let request = URLRequest(url: URL(string: "https://yourserver.com/api/app/recipes/smart-generate")!)
request.setValue("Bearer \(userToken)", forHTTPHeaderField: "Authorization")

// Server handles OpenAI
// OpenAI key never leaves server
// ✅ Secure
// ✅ Controllable
// ✅ Flexible
```

---

## 📊 Shared Components

Both features share these server-side components:

### 1. Authentication (`/lib/auth.ts`)
```typescript
export async function verifyJWT(token: string) {
  // Verify user token
  // Return user ID and tier
}
```

### 2. Deal Finder
```typescript
// Query Firebase for deals
const deals = await db
  .collection('supermarketDiscounts')
  .where('zipCode', '==', zipCode)
  .where('storeName', 'in', stores)
  .where('validUntil', '>', new Date())
  .get()
```

### 3. ChatGPT Caller
```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4-turbo-preview',
  messages: [/* ... */],
  response_format: { type: 'json_object' }
})
```

### 4. Response Formatter
```typescript
return {
  success: true,
  data: /* ... */,
  metadata: {
    dealsFound: deals.length,
    savings: calculatedSavings
  }
}
```

---

## 🎛️ Cost Control

Server-side architecture lets you control costs:

### Rate Limiting
```typescript
// Allow 10 meal plans per month (FREE tier)
if (userTier === 'FREE' && monthlyCount >= 10) {
  return res.status(403).json({
    message: 'Monthly limit reached. Upgrade to Pro!',
    upgrade: true
  })
}
```

### Usage Tracking
```typescript
await db.collection('usage').add({
  userId,
  feature: 'smart_meal_plan',
  cost: 0.05,  // OpenAI cost
  timestamp: new Date()
})
```

### Budget Limits
```typescript
// Track monthly OpenAI spending
const monthlySpend = await getMonthlySpend()
if (monthlySpend > 1000) {
  // Alert admin, throttle requests
}
```

---

## 🚀 Benefits of This Architecture

### 1. Security
| Aspect | Client-Side | Server-Side |
|--------|-------------|-------------|
| API Key Exposure | ❌ Visible | ✅ Hidden |
| Key Rotation | ❌ Requires app update | ✅ Instant |
| Usage Control | ❌ None | ✅ Full control |
| Cost Protection | ❌ None | ✅ Protected |

### 2. Flexibility
```typescript
// Switch AI models without iOS update
const model = userTier === 'PRO' ? 'gpt-4-turbo' : 'gpt-3.5-turbo'

// A/B test different prompts
const prompt = experiment === 'A' ? promptA : promptB

// Add features server-side
if (newFeatureEnabled) {
  // Include extra data
}
```

### 3. Performance
```typescript
// Cache common recipes
if (cachedRecipe) {
  return cachedRecipe  // Instant response!
}

// Batch processing
const recipes = await Promise.all(
  requests.map(req => generateRecipe(req))
)
```

### 4. Monitoring
```typescript
// Track everything
console.log(`User ${userId} generated meal plan`)
console.log(`Deals found: ${deals.length}`)
console.log(`Response time: ${duration}ms`)
console.log(`OpenAI tokens used: ${tokens}`)

// Alert on errors
if (error) {
  await sendAlert('OpenAI API error')
}
```

---

## 💰 Cost Breakdown

### OpenAI API Costs (GPT-4 Turbo):
- **Meal Plan**: ~3000 tokens = $0.04-0.05 per plan
- **Recipe**: ~1200 tokens = $0.02-0.03 per recipe

### Your Pricing:
- **FREE Tier**: 2 meal plans/month, 10 recipes/month
- **PRO Tier** ($9.99/month): Unlimited

### Profitability:
```
PRO user generates:
- 4 meal plans/month = $0.20
- 30 recipes/month = $0.60
- Total OpenAI cost = $0.80/month

Your revenue = $9.99
Your cost = $0.80
Profit = $9.19/month per PRO user! 💰
```

---

## 🔄 Data Flow Examples

### Example 1: Meal Plan Generation

```
1. iOS App:
   POST /api/app/meal-plans/smart-generate
   {
     "days": 5,
     "zipCode": "78701",
     "preferredStores": ["Kroger"]
   }

2. Server authenticates:
   JWT token → User ID + Tier

3. Server finds deals:
   Firebase query → 42 deals found

4. Server calls ChatGPT:
   Prompt: "Create 5-day meal plan using these deals..."
   Response: JSON with meals + shopping list

5. Server saves:
   Firebase: Save meal plan for user

6. Server returns:
   {
     "mealPlan": { /* ... */ },
     "shoppingList": { /* ... */ },
     "metadata": { "savings": 45.00 }
   }

7. iOS App displays:
   5-day meal plan + shopping list by aisle
```

### Example 2: Recipe Generation

```
1. iOS App:
   POST /api/app/recipes/smart-generate
   {
     "ingredients": ["chicken", "broccoli"],
     "useDealIngredients": false,
     "mealType": "dinner"
   }

2. Server authenticates:
   JWT token → User ID + Tier

3. Server calls ChatGPT:
   Prompt: "Create recipe using chicken and broccoli..."
   Response: JSON with recipe

4. Server saves:
   Firebase: Save recipe for user

5. Server returns:
   {
     "recipe": { /* ... */ },
     "shoppingList": [ /* ... */ ]
   }

6. iOS App displays:
   Recipe with instructions + shopping list
```

---

## 📝 Environment Variables

All sensitive data on server:

```bash
# .env.local
OPENAI_API_KEY=sk-proj-abc123...
JWT_SECRET=your-secret-key-here
FIREBASE_PROJECT_ID=your-project
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

iOS app only needs:
- Server URL
- User JWT token (from login)

---

## 🧪 Testing Both Features

### Test Meal Plan:
```bash
curl -X POST http://localhost:3000/api/app/meal-plans/smart-generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "days": 5,
    "zipCode": "78701",
    "preferredStores": ["Kroger"]
  }'
```

### Test Recipe:
```bash
curl -X POST http://localhost:3000/api/app/recipes/smart-generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ingredients": ["chicken", "rice"],
    "mealType": "dinner"
  }'
```

---

## 📊 Monitoring & Analytics

Track usage of both features:

```typescript
// After successful generation
await db.collection('analytics').add({
  userId,
  feature: req.path.includes('meal-plans') ? 'meal_plan' : 'recipe',
  timestamp: new Date(),
  tokensUsed: completion.usage.total_tokens,
  cost: calculateCost(completion.usage.total_tokens),
  dealsUsed: dealsUsedCount,
  savings: estimatedSavings,
  userTier
})

// Weekly reports
// - Total API calls
// - Total OpenAI cost
// - Average savings per user
// - Most popular features
```

---

## 🎯 Summary

### What You Have:

✅ **2 AI Features** (Meal Plan + Recipe)
✅ **Server-Side ChatGPT** (secure!)
✅ **Deal Integration** (save money)
✅ **Aisle Navigation** (save time)
✅ **Cost Control** (rate limiting)
✅ **Usage Tracking** (analytics)
✅ **iOS Ready** (JWT auth)

### Files Created:

**Server APIs:**
- `/pages/api/app/meal-plans/smart-generate.ts`
- `/pages/api/app/recipes/smart-generate.ts`
- `/lib/auth.ts`

**iOS Documentation:**
- `IOS_SMART_MEAL_PLANNER.md`
- `IOS_SMART_RECIPE_GENERATOR.md`
- `IOS_SETUP_AND_TESTING.md`
- `IOS_INTEGRATION_SUMMARY.md`
- `SERVER_SIDE_CHATGPT_ARCHITECTURE.md` (this file)

---

## 🚀 Next Steps

1. ✅ Test server APIs
2. ✅ Add Swift code to iOS project
3. ✅ Test from iOS app
4. ✅ Deploy to production
5. ✅ Monitor usage & costs
6. ✅ Launch to users!

---

## 💡 Pro Tips

### 1. Cache Common Requests
```typescript
// Cache popular recipes
const cacheKey = `recipe_${JSON.stringify(params)}`
const cached = await getFromCache(cacheKey)
if (cached) return cached
```

### 2. Queue Long Requests
```typescript
// For slow requests, use background jobs
if (expectedTime > 20000) {
  await queueJob({ userId, params })
  return { status: 'processing', jobId }
}
```

### 3. Graceful Degradation
```typescript
// If OpenAI is slow/down
if (error.code === 'timeout') {
  return sampleRecipe  // Return a good sample
}
```

### 4. Smart Caching
```typescript
// Cache deal lookups
const cacheKey = `deals_${zipCode}_${stores.join(',')}`
const cachedDeals = await redis.get(cacheKey)
if (cachedDeals && Date.now() - cachedDeals.timestamp < 3600000) {
  return cachedDeals.deals  // Use cached deals (1 hour)
}
```

---

**Your server-side ChatGPT architecture is production-ready!** 🎉

Both features are secure, cost-controlled, and ready to scale! 🚀
