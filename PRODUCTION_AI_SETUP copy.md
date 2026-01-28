# Production AI Setup - Rate Limits & Smart Model Selection

## Overview

Setting up production-ready AI Chef with:
- ✅ **Real JWT authentication** (no dev-token)
- ✅ **Rate limits**: Free (2/month) vs Pro (unlimited)
- ✅ **Smart model selection**: GPT-4o for complex recipes, GPT-4o-mini for simple
- ✅ **Usage tracking** synced with iOS SubscriptionManager

---

## 🎯 Features

### Free Tier
- 2 AI recipes per month
- Uses GPT-4o-mini (fast, cost-effective)
- Rate limit enforced server-side

### Pro Tier
- Unlimited AI recipes
- Smart model selection:
  - **GPT-4o** for dietary restrictions, complex cuisines, multi-step recipes
  - **GPT-4o-mini** for simple, quick recipes
- Better quality results

---

## 📁 Server Setup

### Step 1: Update `pages/api/app/chatgpt/generate.ts`

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { verifyJWT } from '../../../lib/auth';
import { db } from '../../../lib/firestore'; // Your Firestore instance
import { FieldValue } from 'firebase-admin/firestore';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limits
const FREE_TIER_MONTHLY_LIMIT = 2;
const PRO_TIER_MONTHLY_LIMIT = 999999; // Effectively unlimited

// Model selection keywords for complexity detection
const COMPLEX_KEYWORDS = [
  'gluten-free', 'vegan', 'vegetarian', 'keto', 'paleo', 'dairy-free',
  'nut-free', 'allergen', 'allergy', 'dietary', 'restriction',
  'kosher', 'halal', 'low-carb', 'sugar-free', 'diabetic',
  'french', 'thai', 'indian', 'japanese', 'molecular', 'gourmet',
  'advanced', 'complicated', 'multi-step', 'technique'
];

interface UsageRecord {
  userId: string;
  count: number;
  month: string; // Format: "2026-01"
  lastUsed: Date;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    // ============================================
    // STEP 1: Verify JWT Authentication
    // ============================================
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'No authorization token provided' 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyJWT(token);
    
    if (!decoded) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token' 
      });
    }

    const userId = decoded.userId;
    const userTier = decoded.tier || 'FREE'; // "FREE" or "PRO"

    console.log(`🤖 ChatGPT request from user ${userId} (${userTier})`);

    // ============================================
    // STEP 2: Check Rate Limits
    // ============================================
    const currentMonth = new Date().toISOString().substring(0, 7); // "2026-01"
    
    // Get user's usage record
    const usageRef = db.collection('ai_usage').doc(userId);
    const usageDoc = await usageRef.get();
    
    let usageData: UsageRecord = usageDoc.exists
      ? usageDoc.data() as UsageRecord
      : { userId, count: 0, month: currentMonth, lastUsed: new Date() };

    // Reset counter if new month
    if (usageData.month !== currentMonth) {
      usageData = {
        userId,
        count: 0,
        month: currentMonth,
        lastUsed: new Date()
      };
    }

    // Check rate limit for free users
    if (userTier === 'FREE' && usageData.count >= FREE_TIER_MONTHLY_LIMIT) {
      return res.status(403).json({ 
        success: false, 
        error: `You've used ${FREE_TIER_MONTHLY_LIMIT} free AI recipes this month. Upgrade to Pro for unlimited access!`,
        upgrade: true,
        usageCount: usageData.count,
        limit: FREE_TIER_MONTHLY_LIMIT
      });
    }

    // ============================================
    // STEP 3: Smart Model Selection
    // ============================================
    const { prompt, systemMessage, maxTokens } = req.body;

    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: prompt' 
      });
    }

    // Detect complexity from prompt
    const promptLower = prompt.toLowerCase();
    const isComplex = COMPLEX_KEYWORDS.some(keyword => 
      promptLower.includes(keyword)
    );

    // Choose model based on tier and complexity
    let model = 'gpt-4o-mini'; // Default: fast and cheap
    
    if (userTier === 'PRO' && isComplex) {
      model = 'gpt-4o'; // Premium model for complex requests
      console.log(`✨ Using GPT-4o (Pro user + complex recipe)`);
    } else if (userTier === 'PRO') {
      console.log(`⚡ Using GPT-4o-mini (Pro user + simple recipe)`);
    } else {
      console.log(`🆓 Using GPT-4o-mini (Free user)`);
    }

    console.log('📝 Prompt length:', prompt.length);
    console.log('🎯 Model:', model);

    // ============================================
    // STEP 4: Call OpenAI
    // ============================================
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: systemMessage || 'You are an expert chef who creates delicious recipes. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: maxTokens || 2000,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI returned empty response');
    }

    console.log('✅ OpenAI response received');
    console.log('📊 Tokens used:', completion.usage?.total_tokens);

    // ============================================
    // STEP 5: Update Usage Counter
    // ============================================
    usageData.count += 1;
    usageData.lastUsed = new Date();
    
    await usageRef.set(usageData);

    console.log(`📈 Usage updated: ${usageData.count}/${userTier === 'PRO' ? '∞' : FREE_TIER_MONTHLY_LIMIT}`);

    // ============================================
    // STEP 6: Return Response
    // ============================================
    return res.status(200).json({
      success: true,
      content: content,
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens
      },
      meta: {
        model: model,
        tier: userTier,
        usageCount: usageData.count,
        limit: userTier === 'PRO' ? null : FREE_TIER_MONTHLY_LIMIT,
        remainingThisMonth: userTier === 'PRO' ? null : Math.max(0, FREE_TIER_MONTHLY_LIMIT - usageData.count)
      }
    });

  } catch (error: any) {
    console.error('❌ ChatGPT endpoint error:', error);

    // Handle specific OpenAI errors
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message || 'OpenAI API error';

      if (status === 401) {
        return res.status(500).json({ 
          success: false, 
          error: 'OpenAI API key is invalid or missing' 
        });
      }

      if (status === 429) {
        return res.status(429).json({ 
          success: false, 
          error: 'Too many requests. Please try again in a moment.' 
        });
      }

      return res.status(500).json({ 
        success: false, 
        error: `OpenAI error: ${message}` 
      });
    }

    // Generic error
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to generate content' 
    });
  }
}
```

---

## 🔧 Helper Functions

### Update `lib/auth.ts` to Include Tier

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface JWTPayload {
  userId: string;
  email: string;
  tier: 'FREE' | 'PRO'; // ← Add tier
  iat?: number;
  exp?: number;
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('❌ JWT verification failed:', error);
    return null;
  }
}

export function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}
```

### Update Auth Endpoint to Include Tier

In your `pages/api/app/auth/login.ts` (or similar):

```typescript
// After verifying user credentials
const user = await getUserFromDatabase(email);

// Create JWT with tier info
const token = signJWT({
  userId: user.id,
  email: user.email,
  tier: user.isPro ? 'PRO' : 'FREE' // ← Include tier in token
});

return res.status(200).json({
  success: true,
  accessToken: token,
  user: {
    id: user.id,
    email: user.email,
    tier: user.isPro ? 'PRO' : 'FREE'
  }
});
```

---

## 📱 iOS App Updates

### Step 1: Remove Dev Token in Production

Update `NetworkManager.swift`:

```swift
// Add JWT token if required
if requiresAuth {
    guard let token = KeychainHelper.getToken() else {
        print("❌ No authentication token found - user must log in")
        throw NetworkError.unauthorized
    }
    
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    print("   Token: JWT (authenticated)")
}
```

**Remove this section:**
```swift
#if DEBUG
// In DEBUG mode, use "dev-token" if no real token exists
let token = KeychainHelper.getToken() ?? "dev-token"
print("   Token: \(token == "dev-token" ? "dev-token (DEBUG)" : "JWT token (authenticated)")")
#else
guard let token = KeychainHelper.getToken() else {
    print("❌ No authentication token found")
    throw NetworkError.unauthorized
}
#endif
```

### Step 2: Update ChatGPTService Response Model

Add meta fields to track usage:

```swift
struct ChatGPTResponse: Codable {
    let success: Bool
    let content: String
    let error: String?
    let upgrade: Bool?
    let usage: TokenUsage?
    let meta: UsageMeta?
    
    struct TokenUsage: Codable {
        let promptTokens: Int?
        let completionTokens: Int?
        let totalTokens: Int?
    }
    
    struct UsageMeta: Codable {
        let model: String?
        let tier: String?
        let usageCount: Int?
        let limit: Int?
        let remainingThisMonth: Int?
    }
}
```

### Step 3: Handle Rate Limit Errors

Update `ChatGPTService.swift`:

```swift
guard response.success else {
    // Check if it's an upgrade required error
    if response.upgrade == true {
        throw AIChefError.rateLimitExceeded(response.error ?? "Upgrade to Pro for unlimited recipes")
    }
    
    let errorMsg = response.error ?? "Unknown error"
    print("❌ [AI Chef] Server returned error: \(errorMsg)")
    throw AIChefError.apiError(statusCode: 500)
}

// Update local usage counter if server provides it
if let meta = response.meta, let usageCount = meta.usageCount {
    SubscriptionManager.shared.aiRecipesUsedThisMonth = usageCount
    print("📊 Updated usage: \(usageCount)/\(meta.limit ?? 999)")
}
```

### Step 4: Update AIChefError Enum

```swift
enum AIChefError: LocalizedError {
    case invalidAPIKey
    case rateLimitExceeded(String)
    case apiError(statusCode: Int)
    case parsingFailed
    case invalidResponse
    
    var errorDescription: String? {
        switch self {
        case .invalidAPIKey:
            return "API authentication failed"
        case .rateLimitExceeded(let message):
            return message
        case .apiError(let code):
            return "Server error (code: \(code))"
        case .parsingFailed:
            return "Failed to parse recipe"
        case .invalidResponse:
            return "Invalid response from server"
        }
    }
}
```

### Step 5: Require Auth Before Using AI Chef

Update `AIChefView.swift`:

```swift
var body: some View {
    NavigationView {
        if !AuthService.shared.isAuthenticated {
            // Show login prompt
            VStack(spacing: 20) {
                Image(systemName: "person.crop.circle.badge.questionmark")
                    .font(.system(size: 60))
                    .foregroundColor(.orange)
                
                Text("Sign In Required")
                    .font(.title2)
                    .fontWeight(.bold)
                
                Text("Create an account or sign in to use AI Chef")
                    .multilineTextAlignment(.center)
                    .foregroundColor(.secondary)
                
                Button(action: {
                    // Navigate to login view
                    // showingLoginView = true
                }) {
                    Text("Sign In with Apple")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.black)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }
                .padding(.horizontal)
            }
            .padding()
        } else {
            // Existing AI Chef UI
            // ... your current code
        }
    }
}
```

---

## 🧪 Testing

### Test Rate Limiting

```bash
# Get a test token first
curl -X POST https://savryweb.vercel.app/api/app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Response: {"accessToken": "eyJhbGci...", "user": {...}}

# Use token for AI Chef (should work for first 2 requests if free user)
curl -X POST https://savryweb.vercel.app/api/app/chatgpt/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a simple pasta recipe",
    "systemMessage": "You are a chef",
    "maxTokens": 200
  }'

# Expected response (1st request):
# {
#   "success": true,
#   "content": "...",
#   "meta": {
#     "model": "gpt-4o-mini",
#     "tier": "FREE",
#     "usageCount": 1,
#     "limit": 2,
#     "remainingThisMonth": 1
#   }
# }

# Expected response (3rd request - rate limited):
# {
#   "success": false,
#   "error": "You've used 2 free AI recipes this month. Upgrade to Pro...",
#   "upgrade": true,
#   "usageCount": 2,
#   "limit": 2
# }
```

### Test Model Selection (Pro User with Dietary Restrictions)

```bash
# Pro user with complex request
curl -X POST https://savryweb.vercel.app/api/app/chatgpt/generate \
  -H "Authorization: Bearer PRO_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a gluten-free vegan French dish suitable for diabetics",
    "systemMessage": "You are an expert chef",
    "maxTokens": 500
  }'

# Expected: Uses GPT-4o (complex keywords detected)
# {
#   "success": true,
#   "content": "...",
#   "meta": {
#     "model": "gpt-4o",  ← Premium model
#     "tier": "PRO",
#     "usageCount": 1,
#     "limit": null,
#     "remainingThisMonth": null
#   }
# }
```

---

## 🚀 Deployment Checklist

### Server Side
- [ ] Update `pages/api/app/chatgpt/generate.ts` with new code
- [ ] Update `lib/auth.ts` to include `tier` in JWT
- [ ] Update auth endpoints to set tier in token
- [ ] Set environment variables:
  - `OPENAI_API_KEY=sk-...`
  - `JWT_SECRET=...`
  - `FIREBASE_CONFIG=...` (if using Firestore for usage tracking)
- [ ] Deploy to Vercel
- [ ] Test with curl (both free and pro scenarios)

### iOS Side
- [ ] Remove dev-token fallback from `NetworkManager.swift`
- [ ] Add `UsageMeta` to `ChatGPTResponse` model
- [ ] Update error handling for `rateLimitExceeded`
- [ ] Add auth check in `AIChefView`
- [ ] Sync usage count with SubscriptionManager
- [ ] Test with TestFlight beta

### Final Verification
- [ ] Free user can generate 2 recipes/month
- [ ] 3rd recipe shows upgrade prompt
- [ ] Pro user has unlimited access
- [ ] Pro user gets GPT-4o for complex recipes
- [ ] Free user always gets GPT-4o-mini
- [ ] Usage counter resets monthly
- [ ] TestFlight build works on real devices

---

## 📊 Monitoring

Add logging to track:
- Model usage (gpt-4o vs gpt-4o-mini)
- Free vs Pro usage patterns
- Rate limit hits
- Costs per user tier

Example Firestore structure:
```
ai_usage/
  {userId}/
    count: 2
    month: "2026-01"
    lastUsed: Timestamp
    
ai_requests/
  {requestId}/
    userId: "user123"
    tier: "PRO"
    model: "gpt-4o"
    tokens: 450
    timestamp: Timestamp
    cost: 0.0045
```

---

## 💰 Cost Optimization

### Current Pricing (as of 2026):
- **GPT-4o-mini**: ~$0.0001/1K tokens (very cheap)
- **GPT-4o**: ~$0.005/1K tokens (50x more expensive)

### Strategy:
- Free users: Always use GPT-4o-mini (low cost, capped at 2/month)
- Pro users: Smart selection
  - Simple recipes → GPT-4o-mini (fast, cheap)
  - Complex recipes → GPT-4o (better quality)

### Estimated Costs:
- Free user (2 recipes/month): ~$0.0002
- Pro user (20 simple + 5 complex/month): ~$0.002 + $0.025 = ~$0.027
- With 1000 pro users: ~$27/month

Your Pro subscription ($3.99/month) easily covers costs!

---

## 🎯 Summary

**Production Ready Features:**
✅ Real JWT authentication (no dev-token)
✅ Server-side rate limiting (2/month free, unlimited pro)
✅ Smart model selection (GPT-4o for complex, GPT-4o-mini for simple)
✅ Usage tracking synced between server and iOS
✅ Graceful error handling for rate limits
✅ Cost-effective architecture

**Next Steps:**
1. Deploy server updates
2. Update iOS app
3. Test with TestFlight
4. Launch! 🚀
