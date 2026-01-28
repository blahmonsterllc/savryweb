# Add Missing ChatGPT Endpoint to Server

## Problem

Your iOS app calls `POST /api/app/chatgpt/generate` but your server returns **405 Method Not Allowed** because this endpoint doesn't exist.

## Solution

Add this endpoint to your Vercel server.

---

## 📁 Create New File: `pages/api/app/chatgpt/generate.ts`

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { verifyJWT } from '../../../lib/auth'; // Adjust path to your auth helper

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    // Verify authentication
    const authHeader = req.headers.authorization;
    
    // Allow dev-token in development
    if (process.env.NODE_ENV === 'development' && authHeader === 'Bearer dev-token') {
      console.log('🔓 Using dev-token for development');
    } else {
      // Verify real JWT in production
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

      // Optionally: Check user tier for rate limiting
      // const userId = decoded.userId;
      // const user = await getUserFromDatabase(userId);
      // if (!user.isPro && userExceededFreeLimit(userId)) {
      //   return res.status(403).json({ 
      //     success: false, 
      //     error: 'Upgrade to Pro for unlimited AI recipes',
      //     upgrade: true
      //   });
      // }
    }

    // Get request body
    const { prompt, systemMessage, maxTokens } = req.body;

    // Validate request
    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required field: prompt' 
      });
    }

    console.log('🤖 Calling OpenAI...');
    console.log('📝 Prompt length:', prompt.length);
    console.log('🎯 Max tokens:', maxTokens || 2000);

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // or 'gpt-4' for better quality
      messages: [
        {
          role: 'system',
          content: systemMessage || 'You are an expert chef who creates delicious recipes.'
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

    // Return response in format iOS app expects
    return res.status(200).json({
      success: true,
      content: content,
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens
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
          error: 'Rate limit exceeded. Please try again later.' 
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

## 🔧 If You Don't Have Auth Helper Yet

Create `lib/auth.ts`:

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface JWTPayload {
  userId: string;
  email: string;
  tier?: string;
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

export function signJWT(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}
```

---

## 📦 Install Required Packages

```bash
cd your-server-directory
npm install openai
npm install jsonwebtoken
npm install @types/jsonwebtoken --save-dev
```

---

## 🔐 Set Environment Variables

In **Vercel Dashboard** → Your Project → Settings → Environment Variables:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
NODE_ENV=production
```

For local development (`.env.local`):

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
JWT_SECRET=dev-secret-key-change-in-production
NODE_ENV=development
```

---

## 🧪 Test the Endpoint

### Test with dev-token (development only):

```bash
curl -X POST https://savryweb.vercel.app/api/app/chatgpt/generate \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a simple pasta recipe",
    "systemMessage": "You are a helpful chef",
    "maxTokens": 500
  }'
```

### Expected response:

```json
{
  "success": true,
  "content": "Here's a simple pasta recipe...",
  "usage": {
    "promptTokens": 25,
    "completionTokens": 150,
    "totalTokens": 175
  }
}
```

---

## 🚀 Deploy to Vercel

```bash
# Commit the new file
git add pages/api/app/chatgpt/generate.ts lib/auth.ts
git commit -m "Add ChatGPT endpoint for iOS AI Chef"
git push

# Vercel will auto-deploy (or deploy manually)
vercel --prod
```

---

## ✅ After Deployment

1. **Test the endpoint** with curl (see above)
2. **Rebuild iOS app** and try AI Chef
3. **Check Xcode console** for success logs:

```
🤖 [AI Chef] Making request to server...
📥 API Response: Status: 200
✅ Success: true
✅ [AI Chef] Got content: {"title": "Pasta Primavera"...
```

---

## 🐛 Troubleshooting

### Error: "OpenAI API key is invalid"
- Check Vercel environment variables
- Make sure `OPENAI_API_KEY` starts with `sk-`
- Verify key is active at https://platform.openai.com/api-keys

### Error: "Method not allowed" (still 405)
- Make sure file is at: `pages/api/app/chatgpt/generate.ts`
- Check file exports `default async function handler`
- Redeploy: `git push` → Vercel auto-deploys

### Error: "Missing required field: prompt"
- iOS app is sending wrong format
- Check `ChatGPTService.swift` sends: `{ prompt, systemMessage, maxTokens }`

### Dev-token not working in production
- **Expected!** Dev-token only works when `NODE_ENV=development`
- For production, you need real JWT auth
- Options:
  1. Implement login flow in iOS
  2. Temporarily set `NODE_ENV=development` on Vercel (not recommended)
  3. Comment out auth check in endpoint (testing only)

---

## 🎯 Quick Summary

1. Create `pages/api/app/chatgpt/generate.ts` on your server
2. Add OpenAI API key to Vercel environment variables
3. Deploy to Vercel
4. Test with curl
5. iOS AI Chef should work! ✅

The endpoint accepts the exact format your iOS app is already sending, so no iOS changes needed!
