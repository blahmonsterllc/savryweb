# GPT-4o for Recipe Modifications - Implementation Guide

## 🎯 Strategy: Smart Model Selection

### Use Cases:

**GPT-4o (Premium Model):**
- ✅ Recipe modifications ("make it dairy-free", "add more protein")
- ✅ Complex dietary adaptations
- ✅ Ingredient substitutions with specific requirements
- ✅ Detailed recipe adjustments

**GPT-4o-mini (Efficient Model):**
- ✅ Simple recipe generation (Italian meal, Mexican dinner)
- ✅ Basic ingredient-based recipes
- ✅ Quick meal ideas
- ✅ General cooking questions

---

## 💰 Cost Analysis

### GPT-4o-mini (Current for everything):
- **Input:** $0.15 per 1M tokens
- **Output:** $0.60 per 1M tokens
- **Recipe generation:** ~$0.002 per recipe
- **Monthly cost (100 users, 5 recipes each):** ~$1

### GPT-4o (For modifications):
- **Input:** $5.00 per 1M tokens (~33x more)
- **Output:** $20.00 per 1M tokens (~33x more)
- **Recipe modification:** ~$0.01-0.02 per modification
- **Monthly cost (100 users, 2 modifications each):** ~$2-4

### Combined Strategy (Recommended):
- Simple generation: GPT-4o-mini (~70% of requests)
- Modifications: GPT-4o (~30% of requests)
- **Estimated monthly cost (100 active users):** ~$3-5
- **With 1000 users:** ~$30-50/month

**Very affordable for significantly better user experience!** ✅

---

## 📱 iOS App Changes (Already Applied)

### 1. Updated Request Struct

```swift
struct ChatGPTRequest: Codable {
    let prompt: String
    let systemMessage: String
    let maxTokens: Int
    let model: String?  // ← NEW: Optional model selection
}
```

### 2. Updated callOpenAI Function

```swift
private func callOpenAI(
    prompt: String,
    systemMessage: String = "...",
    maxTokens: Int = 2000,
    model: String? = nil  // ← NEW: Model parameter
) async throws -> String {
    
    let requestBody = ChatGPTRequest(
        prompt: prompt,
        systemMessage: systemMessage,
        maxTokens: maxTokens,
        model: model  // ← Passed to server
    )
    
    // Server receives model preference
}
```

### 3. Recipe Modifications Use GPT-4o

```swift
func modifyExistingRecipe(_ recipe: RecipeModel, withInstructions instructions: String) async throws -> RecipeModel {
    let prompt = buildModificationPrompt(recipe: recipe, instructions: instructions)
    
    // Use GPT-4o for better accuracy ✅
    let response = try await callOpenAI(
        prompt: prompt,
        systemMessage: "...",
        model: "gpt-4o"  // ← Premium model for modifications
    )
    
    return try parseRecipeFromResponse(response, ...)
}
```

### 4. Simple Generation Uses GPT-4o-mini (Default)

```swift
func generateRecipe(...) async throws -> RecipeModel {
    let prompt = buildPrompt(...)
    
    // No model specified = server uses gpt-4o-mini (default) ✅
    let response = try await callOpenAI(prompt: prompt)
    
    return try parseRecipeFromResponse(response, ...)
}
```

---

## 🖥️ Server-Side Implementation

### Update: `pages/api/app/chatgpt/generate.ts`

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { verifyJWT } from '../../../lib/auth';
import { db } from '../../../lib/firestore';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify JWT token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verifyJWT(token);
    const userId = decoded.userId;
    const userTier = decoded.tier || 'FREE';

    // Get request body
    const { prompt, systemMessage, maxTokens, model } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    // Get user from database
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    // ===== SMART MODEL SELECTION =====
    
    // If client specifies model, use it (e.g., "gpt-4o" for modifications)
    // Otherwise, intelligently choose based on prompt complexity
    let selectedModel = model;
    
    if (!selectedModel) {
      // Check if prompt suggests modification or complexity
      const complexityIndicators = [
        'modify', 'change', 'substitute', 'replace', 'adapt',
        'make it', 'without', 'allergen', 'dietary restriction',
        'vegan', 'gluten-free', 'keto', 'paleo', 'low-carb'
      ];
      
      const promptLower = prompt.toLowerCase();
      const isComplex = complexityIndicators.some(indicator => 
        promptLower.includes(indicator)
      );
      
      // Use GPT-4o for complex requests, GPT-4o-mini for simple ones
      selectedModel = isComplex ? 'gpt-4o' : 'gpt-4o-mini';
    }

    console.log(`🤖 Using model: ${selectedModel}`);

    // ===== RATE LIMITING =====
    
    const isPro = userData?.isPro || userTier === 'PRO';
    const usageCount = userData?.aiRecipesThisMonth || 0;
    const monthlyLimit = isPro ? 999 : 2; // Free: 2/month, Pro: unlimited

    if (!isPro && usageCount >= monthlyLimit) {
      return res.status(200).json({
        success: false,
        upgrade: true,
        error: 'You\'ve used all your free AI recipes this month. Upgrade to Pro for unlimited!',
        usageCount: usageCount,
        limit: monthlyLimit
      });
    }

    // ===== CALL OPENAI =====

    const completion = await openai.chat.completions.create({
      model: selectedModel,  // ← Dynamic model selection
      messages: [
        { role: 'system', content: systemMessage || 'You are a helpful cooking assistant.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens || 2000,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content || '';

    // ===== UPDATE USAGE =====

    await db.collection('users').doc(userId).update({
      aiRecipesThisMonth: (userData?.aiRecipesThisMonth || 0) + 1,
      lastAIRequestAt: new Date(),
      updatedAt: new Date()
    });

    // Log request for analytics
    await db.collection('ai_requests').add({
      userId: userId,
      model: selectedModel,  // ← Track which model was used
      promptLength: prompt.length,
      tokensUsed: completion.usage?.total_tokens || 0,
      cost: calculateCost(selectedModel, completion.usage),  // Calculate actual cost
      success: true,
      createdAt: new Date()
    });

    // ===== RETURN RESPONSE =====

    return res.status(200).json({
      success: true,
      content: content,
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens
      },
      meta: {
        usageCount: usageCount + 1,
        limit: monthlyLimit,
        model: selectedModel  // ← Tell client which model was used
      }
    });

  } catch (error: any) {
    console.error('❌ ChatGPT API error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'AI request failed',
      content: ''
    });
  }
}

// ===== COST CALCULATION HELPER =====

function calculateCost(model: string, usage: any): number {
  if (!usage) return 0;

  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o': {
      input: 5.00 / 1_000_000,    // $5 per 1M input tokens
      output: 20.00 / 1_000_000   // $20 per 1M output tokens
    },
    'gpt-4o-mini': {
      input: 0.15 / 1_000_000,    // $0.15 per 1M input tokens
      output: 0.60 / 1_000_000    // $0.60 per 1M output tokens
    }
  };

  const modelPricing = pricing[model] || pricing['gpt-4o-mini'];
  
  const inputCost = (usage.prompt_tokens || 0) * modelPricing.input;
  const outputCost = (usage.completion_tokens || 0) * modelPricing.output;
  
  return inputCost + outputCost;
}
```

---

## 📊 Model Selection Logic

### Client-Specified Model (Highest Priority):

```typescript
// iOS app explicitly requests GPT-4o for modifications
const { model } = req.body;  // "gpt-4o"
selectedModel = model;  // Use what client requests
```

### Server-Side Intelligence (Fallback):

```typescript
// If no model specified, check prompt complexity
const complexityIndicators = [
  'modify', 'change', 'substitute', 'replace',
  'dietary restriction', 'allergen-free', etc.
];

const isComplex = complexityIndicators.some(
  indicator => prompt.includes(indicator)
);

selectedModel = isComplex ? 'gpt-4o' : 'gpt-4o-mini';
```

---

## 🎯 Which Requests Use Which Model?

### GPT-4o (Premium) ✨

**From iOS:**
1. `modifyExistingRecipe()` - Always GPT-4o
2. Complex dietary requests (detected by server)
3. Multi-step modifications

**Example prompts:**
- "Make this recipe vegan and gluten-free"
- "Replace chicken with tofu and adjust cooking time"
- "Adapt for someone with nut allergy"

**Cost:** ~$0.01-0.02 per request

### GPT-4o-mini (Efficient) ⚡

**From iOS:**
1. `generateRecipe()` - Simple generation
2. `generateRecipeFromPrompt()` - Quick meals
3. Basic questions

**Example prompts:**
- "Generate an Italian dinner recipe"
- "Create a Mexican meal for 4 people"
- "Recipe using chicken and rice"

**Cost:** ~$0.002 per request

---

## 🧪 Testing Model Selection

### Test 1: Simple Generation (Should Use GPT-4o-mini)

```bash
curl -X POST https://savryweb.vercel.app/api/app/chatgpt/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "prompt": "Create a simple Italian pasta recipe",
    "maxTokens": 2000
  }'

# Expected: Uses gpt-4o-mini
# Response includes: "meta": { "model": "gpt-4o-mini" }
```

### Test 2: Modification (Should Use GPT-4o)

```bash
curl -X POST https://savryweb.vercel.app/api/app/chatgpt/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "prompt": "Modify this recipe to be dairy-free and add more protein",
    "model": "gpt-4o",
    "maxTokens": 2000
  }'

# Expected: Uses gpt-4o
# Response includes: "meta": { "model": "gpt-4o" }
```

### Test 3: Server Auto-Detection

```bash
curl -X POST https://savryweb.vercel.app/api/app/chatgpt/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "prompt": "Make this recipe gluten-free and keto-friendly",
    "maxTokens": 2000
  }'

# Expected: Server detects complexity, uses gpt-4o
# Response includes: "meta": { "model": "gpt-4o" }
```

---

## 📈 Cost Monitoring

### Add Cost Tracking Dashboard

Track costs in Firestore:

```typescript
// ai_requests collection schema
{
  userId: string,
  model: "gpt-4o" | "gpt-4o-mini",
  tokensUsed: number,
  cost: number,  // Calculated cost in USD
  promptLength: number,
  success: boolean,
  createdAt: timestamp
}

// Query total costs
const totalCost = await db.collection('ai_requests')
  .where('createdAt', '>=', startOfMonth)
  .get()
  .then(snapshot => {
    let total = 0;
    snapshot.docs.forEach(doc => {
      total += doc.data().cost || 0;
    });
    return total;
  });

console.log(`Monthly AI cost: $${totalCost.toFixed(2)}`);
```

---

## ✅ Deployment Checklist

### iOS App:
- [x] Add `model` parameter to `ChatGPTRequest`
- [x] Update `callOpenAI` to accept `model`
- [x] Set `modifyExistingRecipe` to use `gpt-4o`
- [x] Keep simple generation using `gpt-4o-mini` (default)

### Server:
- [ ] Update `pages/api/app/chatgpt/generate.ts`
- [ ] Add model selection logic
- [ ] Add `calculateCost()` function
- [ ] Add cost tracking to Firestore
- [ ] Deploy to Vercel
- [ ] Test both models

### Testing:
- [ ] Test simple recipe generation (should use mini)
- [ ] Test recipe modification (should use GPT-4o)
- [ ] Test cost calculation
- [ ] Monitor actual costs in production

---

## 🎊 Benefits

### User Experience:
- ✅ Better modification accuracy
- ✅ More precise dietary adaptations
- ✅ Higher quality recipe changes
- ✅ Still fast for simple generation

### Cost Efficiency:
- ✅ 70% of requests use cheap model
- ✅ 30% use premium where it matters
- ✅ Only ~$0.01 more per modification
- ✅ Overall monthly cost stays low

### Competitive Advantage:
- ✅ Best-in-class recipe modifications
- ✅ Accurate dietary adaptations
- ✅ Professional-quality results

---

## 🚀 Summary

**Change:** Use GPT-4o for recipe modifications, GPT-4o-mini for simple generation

**Cost Impact:** +$2-4/month per 100 users (~$0.01 per modification)

**Quality Improvement:** Significantly better modification accuracy

**Implementation:**
1. iOS: Already updated ✅
2. Server: Deploy updated endpoint
3. Test: Verify model selection working
4. Monitor: Track costs in Firestore

**Result:** Better user experience for minimal cost increase!

---

**Deploy the server updates and you're good to go!** 🎉
