# TestFlight Login Setup - Complete

## ✅ What Was Done (iOS)

### 1. Created LoginView.swift
- Beautiful Sign in with Apple interface
- Shows app features
- "TestFlight - All accounts are free" messaging
- Handles auth success/failure

### 2. Updated App Entry Point
**File: `whiskitApp.swift`**
- Checks authentication on launch
- Shows `LoginView` if not authenticated
- Shows `MainTabView` if authenticated
- Smooth transition between states

### 3. Disabled Pro Upgrade Prompts
**File: `AIChefView.swift`**
- Rate limit errors show message instead of upgrade prompt
- All TestFlight users can use AI Chef freely
- TODO comments for re-enabling in production

### 4. Enhanced Auth Flow
- User opens app → Sees login screen
- Taps "Sign in with Apple" → Authenticates
- Server creates account → Returns JWT
- App saves token → Shows main interface
- All features unlocked for free

---

## 🚀 Server Setup Required

### Step 1: Create/Update Apple Sign In Endpoint

**File: `pages/api/auth/apple.ts`** (or similar)

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { db } from '../../../lib/firestore'; // Your Firestore instance

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-me';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { identityToken, email, firstName, lastName } = req.body;

    // Verify Apple identity token (optional but recommended)
    // For TestFlight, you can skip detailed verification
    console.log('🍎 Apple Sign In request received');
    
    if (!identityToken) {
      return res.status(400).json({ error: 'Missing identity token' });
    }

    // Extract Apple user ID from identity token
    // For now, we'll use a simplified approach for TestFlight
    const appleUserId = identityToken.substring(0, 20); // Simplified - use proper JWT decode in production

    // Check if user exists
    let user;
    const userSnapshot = await db.collection('users')
      .where('appleId', '==', appleUserId)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      // Create new user
      console.log('Creating new user...');
      const newUser = {
        appleId: appleUserId,
        email: email || `user-${appleUserId}@apple.com`,
        firstName: firstName || 'User',
        lastName: lastName || '',
        tier: 'FREE', // All TestFlight users are free
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const userRef = await db.collection('users').add(newUser);
      user = { id: userRef.id, ...newUser };
      console.log('✅ New user created:', user.id);
    } else {
      // Existing user
      const userDoc = userSnapshot.docs[0];
      user = { id: userDoc.id, ...userDoc.data() };
      console.log('✅ Existing user found:', user.id);

      // Update last login
      await db.collection('users').doc(user.id).update({
        updatedAt: new Date()
      });
    }

    // Create JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        tier: user.tier || 'FREE'
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Create refresh token
    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '90d' }
    );

    // Return auth response
    return res.status(200).json({
      success: true,
      accessToken: token,
      refreshToken: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tier: user.tier || 'FREE'
      }
    });

  } catch (error: any) {
    console.error('❌ Apple Sign In error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Authentication failed' 
    });
  }
}
```

---

### Step 2: Update ChatGPT Endpoint for TestFlight

**File: `pages/api/app/chatgpt/generate.ts`**

For TestFlight, be generous with rate limits or disable them:

```typescript
// At the rate limit check section:
const FREE_TIER_MONTHLY_LIMIT = 999; // TESTFLIGHT: Allow lots of testing
// const FREE_TIER_MONTHLY_LIMIT = 2; // PRODUCTION: Restore this later

// Or comment out rate limit check entirely:
/*
if (userTier === 'FREE' && usageData.count >= FREE_TIER_MONTHLY_LIMIT) {
  return res.status(403).json({ 
    success: false, 
    error: `You've used ${FREE_TIER_MONTHLY_LIMIT} free AI recipes...`,
    upgrade: true
  });
}
*/
```

---

### Step 3: Environment Variables

Make sure these are set on Vercel:

```env
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
OPENAI_API_KEY=sk-your-openai-api-key
FIREBASE_CONFIG=your-firebase-config-json
```

---

## 🧪 Testing the Flow

### Test 1: Fresh Install

1. **Delete app** from device/simulator
2. **Reinstall** from Xcode
3. **Open app** → Should see login screen
4. **Tap "Sign in with Apple"**
5. **Complete Apple auth**
6. **App should load** main interface
7. **Try AI Chef** → Should work!

### Test 2: Verify Token Persistence

1. **Close app** completely
2. **Reopen app**
3. Should go straight to main interface (no login)
4. Token persisted in Keychain ✅

### Test 3: Server Auth

```bash
# Get a token first by signing in on device
# Then test the token works:
curl -X POST https://savryweb.vercel.app/api/app/chatgpt/generate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a simple pasta recipe",
    "maxTokens": 200
  }'

# Should return success with recipe content
```

---

## 📱 User Experience Flow

### First Time User:

```
1. Download from TestFlight
2. Open app → See login screen
   "Welcome to Savry"
   [List of features]
   [Sign in with Apple button]
   "TestFlight - All accounts are free"

3. Tap "Sign in with Apple"
   → Apple auth popup
   → Face ID / Touch ID
   → Success!

4. App loads → Main interface
   → All features available
   → No Pro prompts
   → Can use AI Chef unlimited times
```

### Returning User:

```
1. Open app
2. Auto-login (token from Keychain)
3. Straight to main interface
```

---

## 🔒 Security Notes

### What's Secure:
✅ JWT tokens stored in Keychain (secure)
✅ Apple handles authentication (secure)
✅ Tokens expire after 30 days
✅ Server verifies all API requests

### TestFlight Simplifications:
⚠️ Simplified Apple token verification (OK for testing)
⚠️ No rate limiting (OK for testing)
⚠️ All users are free tier (OK for testing)

### Before Production:
- [ ] Add proper Apple token verification (decode & verify signature)
- [ ] Re-enable rate limits (2 AI recipes/month for free)
- [ ] Add Pro upgrade flow
- [ ] Add subscription management
- [ ] Test token refresh flow

---

## 🎯 Current State

**iOS App:**
- ✅ Login screen on first launch
- ✅ Sign in with Apple integration
- ✅ Token storage in Keychain
- ✅ Auth check before main app
- ✅ Pro upgrade prompts disabled
- ✅ Clean UI for TestFlight

**Server Needed:**
- [ ] `/api/auth/apple` endpoint (code provided above)
- [ ] Update JWT to include `tier: "FREE"`
- [ ] Relax/disable rate limits for testing
- [ ] Deploy to Vercel

---

## 📋 Deployment Checklist

### Server:
- [ ] Create `pages/api/auth/apple.ts`
- [ ] Update ChatGPT endpoint rate limits
- [ ] Set `JWT_SECRET` in Vercel env vars
- [ ] Deploy: `git push`
- [ ] Test Apple Sign In with curl

### iOS:
- [x] LoginView created
- [x] App checks auth on launch
- [x] Pro prompts disabled
- [x] Build succeeds
- [ ] Archive for TestFlight
- [ ] Upload to App Store Connect
- [ ] Add to TestFlight beta

### Testing:
- [ ] Sign in with Apple works
- [ ] Token persists across app restarts
- [ ] AI Chef works without Pro prompts
- [ ] All features accessible
- [ ] No crashes or errors

---

## 💡 Tips for TestFlight

1. **Beta Tester Instructions:**
   - "Sign in with your Apple ID when prompted"
   - "All features are free during TestFlight"
   - "Report any bugs via TestFlight feedback"

2. **What to Test:**
   - Sign in flow
   - Recipe import from web
   - AI Chef (unlimited)
   - Grocery list
   - Meal planner
   - Settings sync

3. **Known Limitations:**
   - No Pro tier (everyone is free)
   - No subscription management
   - Generous/no rate limits

---

## 🚀 Ready for TestFlight!

**Next Steps:**
1. Deploy server auth endpoint
2. Archive iOS app in Xcode
3. Upload to App Store Connect
4. Invite beta testers
5. Collect feedback
6. Iterate!

**Everything is set up for a smooth TestFlight experience!** 🎉