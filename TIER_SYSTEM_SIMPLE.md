# 🎯 Simplified Tier System - FREE & PRO Only

Your Savry app now uses a simple 2-tier system: FREE and PRO.

---

## 📊 Tier Comparison

| Feature | FREE | PRO |
|---------|------|-----|
| **AI Recipes/Month** | 20 | 500 |
| **Meal Planning** | Basic | Advanced |
| **Shopping Lists** | ✅ Yes | ✅ Yes |
| **Budget Optimization** | ❌ No | ✅ Yes |
| **Store Deals** | ❌ No | ✅ Yes |
| **Priority Support** | ❌ No | ✅ Yes |
| **Cost** | Free | $4.99-$9.99/month |

---

## 🔒 Security Limits

### FREE Tier
- **Monthly requests:** 20/month
- **IP rate limit:** 50/hour (same as Pro)
- **Daily spending cap:** $5/day per user

**Protection:**
- If compromised: Max damage = $0.40/month
- 100 compromised accounts = $40/month max

### PRO Tier
- **Monthly requests:** 500/month
- **IP rate limit:** 50/hour (same as Free)
- **Daily spending cap:** $5/day per user

**Protection:**
- If compromised: Max damage = $10/month
- 10 compromised accounts = $100/month max

**Global spending cap:** $50/day across ALL tiers

---

## 💰 Revenue Model

### Pricing Strategy

**Monthly:**
- FREE: $0
- PRO: $4.99/month

**Annual (20% discount):**
- FREE: $0
- PRO: $49.99/year ($4.16/month)

### Expected Conversions

**Realistic estimates:**
- 1,000 free users
- 200 hit 20/month limit (20%)
- 20 upgrade to Pro (10% conversion)
- Monthly revenue: $99.80
- Annual revenue: $1,197.60

**Conservative estimates:**
- 5% conversion = $49.90/month = $598/year
- Still profitable after OpenAI costs

---

## 🎯 Upgrade Triggers

### When to Show Upgrade Prompt

1. **Hit monthly limit (20 requests)**
   ```
   "You've used all 20 free AI recipes this month!
   Upgrade to Pro for 500 recipes/month."
   ```

2. **Low on requests (3 remaining)**
   ```
   "Only 3 AI recipes left this month!
   Upgrade to Pro for unlimited creativity."
   ```

3. **After 5 successful uses**
   ```
   "Loving Savry? 😊
   Upgrade to Pro for advanced features!"
   ```

4. **Trying to use Pro feature**
   ```
   "Budget optimization is a Pro feature.
   Upgrade now for smart shopping!"
   ```

---

## 🚫 Removed: PREMIUM Tier

**Why removed:**
- ✅ Simplifies user choice (2 options instead of 3)
- ✅ Reduces abuse potential
- ✅ Easier to maintain
- ✅ Clearer value proposition
- ✅ Industry standard (most apps have free + 1 paid tier)

**OLD system (3 tiers):**
```
FREE: 20/month
PRO: 500/month
PREMIUM: 5000/month ❌ Removed
```

**NEW system (2 tiers):**
```
FREE: 20/month
PRO: 500/month ✅ Enough for power users
```

---

## 💡 Why 500/month is Enough for Pro

**500 requests = ~16 per day**

Typical Pro user usage:
- 3 recipes/day = 90/month ✅ Well within limit
- 1 meal plan/week = 4/month ✅ Well within limit
- 2 shopping lists/week = 8/month ✅ Well within limit

**Even power users rarely need >500/month**

If someone hits 500/month:
- They're likely a business/restaurant
- You can offer enterprise pricing separately
- Or they might be abusing the system

---

## 🔧 Technical Implementation

### JWT Token Format

```typescript
{
  userId: "user_123",
  email: "user@example.com",
  tier: "FREE" | "PRO",  // Only these two values
  iat: 1234567890,
  exp: 1237159890
}
```

### Rate Limit Check

```typescript
// In lib/ios-api-security.ts
const monthlyLimit = userTier === 'PRO' 
  ? RATE_LIMITS.PRO_MONTHLY   // 500
  : RATE_LIMITS.FREE_MONTHLY  // 20
```

### Upgrade Flow

```swift
// iOS App
if user.tier == .free && user.usageCount >= 20 {
    showUpgradePrompt()
}

func showUpgradePrompt() {
    // Show Pro benefits
    // Link to in-app purchase
    // Product ID: "com.savry.pro.monthly"
}
```

---

## 📱 iOS App Changes

### Update Tier Enum

```swift
enum UserTier: String, Codable {
    case free = "FREE"
    case pro = "PRO"
    // Removed: case premium = "PREMIUM"
}
```

### Update In-App Purchases

**Products to offer:**
1. `com.savry.pro.monthly` - $4.99/month
2. `com.savry.pro.annual` - $49.99/year

**Remove:**
- Any premium tier products

---

## 🎨 Marketing Copy

### App Store Description

```
🆓 FREE TIER
• 20 AI-generated recipes per month
• Basic meal planning
• Shopping list creation
• Community recipes

⭐ PRO TIER - $4.99/month
• 500 AI recipes per month
• Advanced meal planning
• Budget optimization
• Store deal finder
• Priority support
• Ad-free experience

Try free, upgrade when you're ready!
```

### In-App Upgrade Screen

```
🚀 Upgrade to Savry Pro

✨ 500 AI recipes/month (vs 20)
🛒 Smart shopping with store deals
💰 Budget-optimized meal plans
📊 Advanced nutrition tracking
🎯 Priority support
🚫 No ads

Just $4.99/month or $49.99/year
[Start Free Trial] [Upgrade Now]
```

---

## 📊 Analytics to Track

### User Metrics
- % of free users who hit 20/month limit
- % of users who upgrade after hitting limit
- Average requests/month per tier
- Churn rate by tier

### Revenue Metrics
- Monthly recurring revenue (MRR)
- Average revenue per user (ARPU)
- Customer lifetime value (LTV)
- Conversion rate (free → pro)

### Security Metrics
- Requests blocked by IP limit
- Spending per tier
- Suspicious activity by tier

---

## ✅ Implementation Complete

### What Changed
- ❌ Removed PREMIUM tier (5000/month)
- ✅ Simplified to FREE (20/month) and PRO (500/month)
- ✅ Updated JWT payload to only support FREE/PRO
- ✅ Updated rate limit logic
- ✅ Updated documentation

### Files Modified
1. `lib/ios-api-security.ts` - Removed PREMIUM from RATE_LIMITS
2. `lib/auth.ts` - Updated JWT types to FREE/PRO only
3. `TIER_SYSTEM_SIMPLE.md` - This document

### What to Update in iOS App
1. Remove PREMIUM from UserTier enum
2. Remove any PREMIUM IAP products
3. Update upgrade prompts (only show Pro)
4. Update settings screen (only show Free/Pro)

---

## 🎯 Summary

**Before:**
- 3 tiers (FREE, PRO, PREMIUM)
- Confusing for users
- More abuse potential

**After:**
- 2 tiers (FREE, PRO)
- Clear choice
- Simpler to maintain
- Standard industry model
- Better security

**Limits:**
- FREE: 20/month (upgrades after)
- PRO: 500/month (plenty for power users)
- Both protected by IP limits and spending caps

**Your system is now simpler, more secure, and easier to market!** 🎉
