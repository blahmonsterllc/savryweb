# 🚀 Server: Smart AI Optimization Guide

## Updated: Jan 26, 2026

Complete implementation guide for **Redis caching** and **smart model selection** to reduce AI costs by 80-90%.

---

## 📊 What You're Implementing

### **1. Redis Caching** 💾
- Cache AI responses for 30 days
- Reuse results for popular recipes
- **Savings: 70-80%** on repeated queries

### **2. Smart Model Selection** 🎯
- Simple validations → GPT-3.5 Turbo (10x cheaper)
- Complex validations → GPT-4o (more accurate)
- **Savings: 50%** on non-nutrition queries

### **Combined Savings: 80-90%** 🎉

---

## 📱 iOS App Changes (Already Done!)

The iOS app now sends:

```json
{
  "prompt": "Analyze this recipe...",
  "systemMessage": "You are an expert...",
  "maxTokens": 200,
  "model": "gpt-3.5-turbo",
  "validationType": "simple"  ← NEW!
}
```

**Validation Types:**
- `"simple"` - Just servings/type (use GPT-3.5)
- `"complex"` - Needs nutrition estimation (use GPT-4o)

---

## 🛠️ Server Implementation

### **Prerequisites:**

```bash
# Install Redis
npm install redis

# Or for serverless (Vercel):
npm install @vercel/kv
```

---

## 📝 Step 1: Update Your ChatGPT Endpoint

### **Current Endpoint:** `/api/app/chatgpt/generate`

**Replace your existing implementation with this optimized version:**

```javascript
// /api/app/chatgpt/generate.js (or .ts)

import { createClient } from 'redis';
import OpenAI from 'openai';
import crypto from 'crypto';

// Initialize Redis
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redis.on('error', (err) => console.log('Redis Client Error', err));
await redis.connect();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      prompt, 
      systemMessage, 
      maxTokens = 2000, 
      model,
      validationType  // NEW: "simple" or "complex"
    } = req.body;

    // 1. Authenticate user (your existing auth logic)
    const user = await authenticateUser(req);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      });
    }

    // 2. Check rate limits (your existing logic)
    const canMakeRequest = await checkRateLimit(user);
    if (!canMakeRequest) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        upgrade: user.tier === 'FREE',
        usageCount: user.usageThisMonth,
        limit: user.tier === 'FREE' ? 20 : 500
      });
    }

    // 3. Generate cache key
    const cacheKey = generateCacheKey(prompt, systemMessage, validationType);
    
    // 4. Check Redis cache
    const cachedResponse = await redis.get(cacheKey);
    if (cachedResponse) {
      console.log('✅ Cache hit:', cacheKey.substring(0, 20) + '...');
      
      const cached = JSON.parse(cachedResponse);
      
      // Still increment usage count (user benefits from cache, but we track it)
      await incrementUsageCount(user.id);
      
      return res.status(200).json({
        success: true,
        content: cached.content,
        cached: true,  // Let iOS know it was cached
        meta: {
          tier: user.tier,
          usageCount: user.usageThisMonth + 1,
          limit: user.tier === 'FREE' ? 20 : 500
        }
      });
    }

    console.log('❌ Cache miss - calling OpenAI');

    // 5. Smart model selection
    const selectedModel = selectOptimalModel(model, validationType);
    console.log(`🎯 Using model: ${selectedModel} (type: ${validationType || 'default'})`);

    // 6. Call OpenAI
    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.7
    });

    const content = completion.choices[0].message.content;

    // 7. Cache the response (30 days)
    const cacheData = {
      content: content,
      model: selectedModel,
      timestamp: Date.now()
    };
    await redis.setEx(cacheKey, 86400 * 30, JSON.stringify(cacheData));
    console.log('💾 Cached response for 30 days');

    // 8. Increment usage count
    await incrementUsageCount(user.id);

    // 9. Track analytics
    await trackUsage({
      userId: user.id,
      tier: user.tier,
      model: selectedModel,
      validationType: validationType,
      cached: false,
      tokensUsed: completion.usage.total_tokens,
      cost: estimateCost(selectedModel, completion.usage)
    });

    // 10. Return response
    return res.status(200).json({
      success: true,
      content: content,
      cached: false,
      meta: {
        tier: user.tier,
        usageCount: user.usageThisMonth + 1,
        limit: user.tier === 'FREE' ? 20 : 500
      }
    });

  } catch (error) {
    console.error('❌ ChatGPT API error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to generate response',
      message: error.message
    });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate cache key from request parameters
 */
function generateCacheKey(prompt, systemMessage, validationType) {
  // Hash the prompt + system message for consistent key
  const hash = crypto
    .createHash('sha256')
    .update(prompt + systemMessage + (validationType || ''))
    .digest('hex');
  
  return `ai:${validationType || 'default'}:${hash}`;
}

/**
 * Smart model selection based on validation type
 */
function selectOptimalModel(requestedModel, validationType) {
  // If app explicitly requested a model, respect it (for backward compatibility)
  if (requestedModel) {
    return requestedModel;
  }

  // Smart selection based on validation type
  if (validationType === 'simple') {
    // Simple validation: just servings/type → GPT-3.5 (10x cheaper)
    return 'gpt-3.5-turbo';
  } else if (validationType === 'complex') {
    // Complex validation: nutrition estimation → GPT-4o (more accurate)
    return 'gpt-4o';
  }

  // Default: AI Chef and other features → GPT-4o
  return 'gpt-4o';
}

/**
 * Estimate cost for analytics
 */
function estimateCost(model, usage) {
  const prices = {
    'gpt-4o': {
      input: 5 / 1_000_000,    // $5 per 1M tokens
      output: 15 / 1_000_000   // $15 per 1M tokens
    },
    'gpt-3.5-turbo': {
      input: 0.5 / 1_000_000,  // $0.50 per 1M tokens
      output: 1.5 / 1_000_000  // $1.50 per 1M tokens
    }
  };

  const modelPrices = prices[model] || prices['gpt-4o'];
  
  return (
    usage.prompt_tokens * modelPrices.input +
    usage.completion_tokens * modelPrices.output
  );
}

/**
 * Track usage analytics (optional but recommended)
 */
async function trackUsage(data) {
  // Log to your analytics service (PostHog, Mixpanel, etc.)
  console.log('📊 Usage:', {
    user: data.userId,
    tier: data.tier,
    model: data.model,
    type: data.validationType,
    cached: data.cached,
    cost: `$${data.cost.toFixed(4)}`
  });
  
  // Store in database for reporting
  // await db.analytics.create({ data });
}
```

---

## 🔧 For Vercel/Serverless (Using @vercel/kv)

If you're on Vercel or prefer serverless:

```javascript
// /api/app/chatgpt/generate.js
import { kv } from '@vercel/kv';
import OpenAI from 'openai';

export default async function handler(req, res) {
  // ... same auth and rate limit logic ...

  const cacheKey = generateCacheKey(prompt, systemMessage, validationType);
  
  // Check Vercel KV cache
  const cachedResponse = await kv.get(cacheKey);
  if (cachedResponse) {
    console.log('✅ Cache hit');
    return res.status(200).json({
      success: true,
      content: cachedResponse.content,
      cached: true
    });
  }

  // Call OpenAI with smart model selection
  const selectedModel = selectOptimalModel(model, validationType);
  const completion = await openai.chat.completions.create({
    model: selectedModel,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: prompt }
    ],
    max_tokens: maxTokens
  });

  const content = completion.choices[0].message.content;

  // Cache for 30 days
  await kv.set(cacheKey, { content, model: selectedModel }, { ex: 86400 * 30 });

  return res.status(200).json({
    success: true,
    content: content,
    cached: false
  });
}
```

---

## 📊 Expected Savings

### **Before Optimization:**

```
1,000 validations/day
├─ 500 simple (servings only)
│  └─ GPT-4o: $0.00525 × 500 = $2.625/day
└─ 500 complex (nutrition)
   └─ GPT-4o: $0.00525 × 500 = $2.625/day

Total: $5.25/day = $157.50/month 💸
```

### **After Smart Model Selection:**

```
1,000 validations/day
├─ 500 simple (servings only)
│  └─ GPT-3.5: $0.00053 × 500 = $0.265/day ✅
└─ 500 complex (nutrition)
   └─ GPT-4o: $0.00525 × 500 = $2.625/day

Total: $2.89/day = $86.70/month (45% savings)
```

### **After Smart Model + 80% Cache Hit Rate:**

```
1,000 validations/day
├─ 800 from cache = $0 ✅✅✅
└─ 200 new requests:
    ├─ 100 simple (GPT-3.5): $0.053
    └─ 100 complex (GPT-4o): $0.525

Total: $0.58/day = $17.40/month (89% savings!) 🎉
```

**Savings: $140/month ($1,680/year)**

---

## 🧪 Testing the Implementation

### **Test 1: Simple Validation (Should use GPT-3.5)**

**iOS App sends:**
```json
{
  "prompt": "Is this 8 cookies or serves 8?",
  "validationType": "simple",
  "model": "gpt-3.5-turbo"
}
```

**Server logs should show:**
```
🎯 Using model: gpt-3.5-turbo (type: simple)
❌ Cache miss - calling OpenAI
💾 Cached response for 30 days
📊 Usage: { cost: '$0.0005' }
```

---

### **Test 2: Complex Validation (Should use GPT-4o)**

**iOS App sends:**
```json
{
  "prompt": "Estimate nutrition for chocolate chip cookies",
  "validationType": "complex",
  "model": "gpt-4o"
}
```

**Server logs should show:**
```
🎯 Using model: gpt-4o (type: complex)
❌ Cache miss - calling OpenAI
💾 Cached response for 30 days
📊 Usage: { cost: '$0.0052' }
```

---

### **Test 3: Cache Hit**

**Import the same recipe again:**

**Server logs should show:**
```
✅ Cache hit: ai:simple:abc123...
📊 Usage: { cached: true, cost: '$0' }
```

---

## 📈 Monitoring Dashboard

### **Key Metrics to Track:**

```javascript
// Example analytics query
SELECT 
  DATE(timestamp) as date,
  COUNT(*) as total_requests,
  SUM(CASE WHEN cached THEN 1 ELSE 0 END) as cache_hits,
  SUM(CASE WHEN model = 'gpt-3.5-turbo' THEN 1 ELSE 0 END) as gpt35_requests,
  SUM(CASE WHEN model = 'gpt-4o' THEN 1 ELSE 0 END) as gpt4o_requests,
  SUM(cost) as total_cost,
  AVG(cost) as avg_cost_per_request
FROM ai_usage
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

**What to watch:**
- 📊 **Cache hit rate** (target: 70-80%)
- 💰 **Daily cost** (should drop 80-90%)
- 🎯 **Model distribution** (simple vs complex)
- ⏱️ **Response time** (cache = instant)

---

## 🔧 Cache Management

### **Cache Invalidation:**

```javascript
// Clear cache for a specific recipe
async function invalidateRecipeCache(recipeTitle) {
  const pattern = `ai:*:*${recipeTitle}*`;
  const keys = await redis.keys(pattern);
  
  if (keys.length > 0) {
    await redis.del(keys);
    console.log(`🗑️ Invalidated ${keys.length} cache entries`);
  }
}

// Clear all simple validation cache (if you update the algorithm)
async function clearSimpleValidationCache() {
  const keys = await redis.keys('ai:simple:*');
  await redis.del(keys);
  console.log(`🗑️ Cleared ${keys.length} simple validation cache entries`);
}
```

### **Cache Statistics:**

```javascript
// Get cache stats
async function getCacheStats() {
  const simpleKeys = await redis.keys('ai:simple:*');
  const complexKeys = await redis.keys('ai:complex:*');
  
  return {
    simple: simpleKeys.length,
    complex: complexKeys.length,
    total: simpleKeys.length + complexKeys.length,
    memoryUsed: await redis.info('memory')
  };
}
```

---

## 🚨 Common Issues & Solutions

### **Issue 1: Redis Connection Fails**

**Error:** `Redis Client Error: ECONNREFUSED`

**Solution:**
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# If not running, start it:
redis-server

# Or use managed Redis (recommended for production):
# - Redis Cloud (free tier)
# - Upstash (serverless Redis)
# - Vercel KV
```

---

### **Issue 2: Cache Keys Too Long**

**Error:** `Key length exceeds maximum`

**Solution:**
```javascript
// Use shorter hash
function generateCacheKey(prompt, systemMessage, validationType) {
  const hash = crypto
    .createHash('sha256')
    .update(prompt + systemMessage)
    .digest('hex')
    .substring(0, 16);  // ← Use first 16 chars only
  
  return `ai:${validationType}:${hash}`;
}
```

---

### **Issue 3: Stale Cache Data**

**Symptom:** Old/incorrect AI responses being served

**Solution:**
```javascript
// Add version to cache key
function generateCacheKey(prompt, systemMessage, validationType) {
  const VERSION = 'v2';  // ← Increment when prompt changes
  const hash = crypto.createHash('sha256')
    .update(VERSION + prompt + systemMessage)
    .digest('hex');
  
  return `ai:${VERSION}:${validationType}:${hash}`;
}
```

---

### **Issue 4: Model Not Switching**

**Symptom:** Always using GPT-4o even for simple validations

**Debug:**
```javascript
function selectOptimalModel(requestedModel, validationType) {
  console.log('🔍 Model selection:', { requestedModel, validationType });
  
  if (requestedModel) {
    console.log('→ Using requested model:', requestedModel);
    return requestedModel;
  }
  
  const selected = validationType === 'simple' ? 'gpt-3.5-turbo' : 'gpt-4o';
  console.log('→ Smart selection:', selected);
  return selected;
}
```

---

## 📋 Deployment Checklist

### **Before Deploying:**

- [ ] Redis/KV service set up and accessible
- [ ] `REDIS_URL` environment variable configured
- [ ] `OPENAI_API_KEY` environment variable configured
- [ ] Tested locally with both cache hit and miss
- [ ] Verified model selection logic
- [ ] Set up monitoring/analytics

### **After Deploying:**

- [ ] Test with iOS app (simple validation)
- [ ] Test with iOS app (complex validation)
- [ ] Verify cache is working (check logs)
- [ ] Monitor costs for 24 hours
- [ ] Check cache hit rate after 7 days
- [ ] Adjust cache TTL if needed

---

## 🎓 Advanced Optimizations

### **1. Predictive Caching:**

Pre-cache popular recipes:

```javascript
// Daily cron job
async function preCachePopularRecipes() {
  const popular = await getPopularRecipes(100);
  
  for (const recipe of popular) {
    const cacheKey = generateCacheKey(recipe.prompt, recipe.systemMessage, 'simple');
    const exists = await redis.exists(cacheKey);
    
    if (!exists) {
      // Pre-generate and cache
      const result = await callOpenAI(recipe.prompt);
      await redis.setEx(cacheKey, 86400 * 30, JSON.stringify(result));
    }
  }
  
  console.log(`✅ Pre-cached ${popular.length} recipes`);
}
```

---

### **2. Batch Processing:**

Process multiple validations together:

```javascript
// Queue validations
const queue = [];

function queueValidation(request) {
  queue.push(request);
  
  // Process every 2 seconds or when queue reaches 5
  if (queue.length >= 5) {
    processBatch();
  }
}

async function processBatch() {
  const batch = queue.splice(0, 5);
  
  // Create combined prompt
  const combinedPrompt = batch.map((req, i) => 
    `Recipe ${i + 1}: ${req.prompt}`
  ).join('\n\n');
  
  // Single API call for all 5
  const result = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: combinedPrompt }
    ]
  });
  
  // Parse and return individual results
  // ...
}
```

---

### **3. Compression:**

Compress cached data to save memory:

```javascript
import zlib from 'zlib';

async function cacheCompressed(key, data, ttl) {
  const compressed = zlib.gzipSync(JSON.stringify(data));
  await redis.setEx(key, ttl, compressed.toString('base64'));
}

async function getCompressed(key) {
  const compressed = await redis.get(key);
  if (!compressed) return null;
  
  const decompressed = zlib.gunzipSync(Buffer.from(compressed, 'base64'));
  return JSON.parse(decompressed.toString());
}
```

---

## ✅ Summary

### **What You're Implementing:**

1. ✅ **Redis caching** - Reuse AI responses (70-80% savings)
2. ✅ **Smart model selection** - GPT-3.5 for simple, GPT-4o for complex (50% savings)
3. ✅ **Analytics** - Track costs and optimize over time

### **Expected Results:**

- 💰 **89% cost reduction** ($157/month → $17/month)
- ⚡ **Faster responses** (cached = instant)
- 🎯 **Better accuracy** (right model for each task)
- 📊 **Usage insights** (know what users are validating)

### **Next Steps:**

1. ✅ iOS app already updated (done!)
2. 🔧 Implement server changes (this guide)
3. 🧪 Test with a few recipes
4. 📊 Monitor for 1 week
5. 🎉 Enjoy 89% savings!

---

## 🆘 Need Help?

**Common questions:**

**Q: Is caching safe for recipe validation?**  
A: Yes! Recipes are deterministic - same ingredients always give same nutrition.

**Q: What if I update the validation logic?**  
A: Increment the cache version in `generateCacheKey()` to invalidate old cache.

**Q: Should I cache AI Chef recipes too?**  
A: No - those are creative/unique. Only cache validation/analysis.

**Q: How much Redis memory do I need?**  
A: ~100KB per recipe × 10,000 recipes = ~1GB (very affordable)

---

**You're all set!** This implementation will save you **~$140/month** with minimal effort. 🚀💰

---

## 📞 Summary for Your Dev Team

**"We're adding two optimizations to the ChatGPT endpoint:**
1. **Redis caching** - Cache AI responses for 30 days
2. **Smart models** - Use GPT-3.5 for simple tasks, GPT-4o for complex

**Expected result: 89% cost reduction ($157/mo → $17/mo)**

**iOS app already updated. Just need to update the server endpoint."**

✅ Ready to implement!
