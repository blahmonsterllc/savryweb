# 🔒 iOS API Security Analysis

Current status and recommendations to prevent expensive OpenAI abuse.

---

## ✅ Current Security (Good!)

### 1. JWT Authentication ✅
- All iOS API endpoints require JWT Bearer tokens
- Tokens expire after 30 days
- Includes userId and tier (FREE/PRO)
- Invalid/expired tokens return 401

### 2. Rate Limiting Per User ✅
- FREE users: 999 requests/month (TestFlight limit)
- PRO users: Unlimited
- Counter stored in Firestore `ai_usage` collection
- Resets monthly

### 3. OpenAI Usage Tracking ✅
- Every API call logged in Firestore
- Tracks tokens used, cost, model, timestamp
- Available in admin dashboard
- Real-time cost monitoring

### 4. Smart Model Selection ✅
- Simple requests: gpt-4o-mini ($0.15 per 1M tokens)
- Complex requests: gpt-4o ($5 per 1M tokens)
- Automatic cost optimization

---

## ⚠️ Current Vulnerabilities (DANGEROUS!)

### 1. ❌ No Bot Protection on iOS APIs

**Problem:**
```typescript
// In middleware.ts
if (pathname.startsWith('/api/app')) {
  return NextResponse.next() // ALLOWS ALL TRAFFIC
}
```

**Risk:** Bots can still hit iOS APIs if they have a valid JWT token

**Impact:**
- Stolen JWT token = unlimited API access for 30 days
- Bot could make thousands of requests
- Could cost $100+ in OpenAI charges

---

### 2. ❌ No IP-Based Rate Limiting on iOS APIs

**Problem:** Only user-based rate limits, no IP-based protection

**Risk:**
- Attacker with stolen token can make 999 requests/month
- Multiple stolen tokens = massive abuse
- No protection against IP-based attacks

**Impact:**
- $200-$500+ in costs if multiple accounts compromised

---

### 3. ❌ Very High Rate Limits (TestFlight Mode)

**Problem:**
```typescript
const FREE_TIER_MONTHLY_LIMIT = 999 // Too high!
```

**Risk:**
- Each free user can make 999 OpenAI requests
- If 10 accounts compromised = 9,990 requests
- At $0.01 per request = $100+ in unexpected costs

**Production should be:** 10-20 requests/month for free tier

---

### 4. ❌ Long JWT Expiration (30 days)

**Problem:**
```typescript
expiresIn: '30d' // Too long!
```

**Risk:**
- Stolen token valid for a month
- Plenty of time for abuse
- Hard to detect and stop

**Should be:** 7 days with refresh token

---

### 5. ❌ No Per-Request Token Limits

**Problem:** No limit on OpenAI tokens per request

**Risk:**
- User requests very long responses
- Could use 10,000+ tokens per request
- Expensive requests drain budget

**Should have:** Max 2,000 tokens per request (already set in some endpoints)

---

### 6. ❌ No Alerting System

**Problem:** No automatic alerts for suspicious activity

**Risk:**
- Abuse could go unnoticed for days
- By the time you check, damage is done

**Need:** Real-time alerts for:
- Unusual spending spikes
- Rapid request rates
- Multiple failed auth attempts

---

## 💰 Cost Analysis

### Worst Case Scenario (Current Setup)

**If 10 free accounts are compromised:**
- 10 accounts × 999 requests = 9,990 requests
- Average 500 tokens per request = 4,995,000 tokens
- Using gpt-4o-mini: $0.15 per 1M input + $0.60 per 1M output
- Estimated cost: **$3-$10** (not terrible but adds up)

**If using gpt-4o (more expensive model):**
- Same scenario: **$25-$50**

**If 100 accounts compromised (realistic attack):**
- 100 accounts × 999 requests = 99,900 requests
- Estimated cost: **$300-$500+** 💸

---

## 🛡️ Recommended Security Enhancements

### Priority 1: Critical (Implement Immediately)

#### 1. Add IP-Based Rate Limiting to iOS APIs
- Limit: 50 requests per hour per IP (regardless of JWT)
- Prevents rapid abuse even with valid tokens
- **Impact:** Blocks bot abuse even with stolen tokens

#### 2. Lower Production Rate Limits
```typescript
// Change from 999 to realistic production limits:
const FREE_TIER_MONTHLY_LIMIT = 20  // 20/month for free users
const PRO_TIER_MONTHLY_LIMIT = 500  // 500/month for Pro users
```
**Impact:** Limits damage from compromised accounts

#### 3. Add Token Usage Limits
```typescript
maxTokens: Math.min(requestedTokens, 2000) // Cap at 2000
```
**Impact:** Prevents expensive long responses

#### 4. Enable Bot Detection on iOS APIs
- Check User-Agent even with valid JWT
- Block curl, python-requests, etc.
- **Impact:** Stops automated abuse

---

### Priority 2: Important (Implement Soon)

#### 5. Shorten JWT Expiration
```typescript
expiresIn: '7d' // 7 days instead of 30
```
**Impact:** Limits window for stolen token abuse

#### 6. Add Request Spike Detection
- Alert if user makes >10 requests in 1 hour
- Alert if spending exceeds $5/hour
- **Impact:** Early detection of abuse

#### 7. Add Daily Spending Caps
```typescript
const DAILY_SPENDING_CAP = 50 // $50/day max
```
**Impact:** Hard stop on runaway costs

---

### Priority 3: Nice to Have

#### 8. Implement JWT Refresh Tokens
- Short-lived access tokens (1 hour)
- Long-lived refresh tokens (30 days)
- Better security, less abuse window

#### 9. Add Device Fingerprinting
- Track device IDs from iOS app
- Block suspicious devices
- Detect token sharing

#### 10. Implement Request Signing
- iOS app signs requests with HMAC
- Prevents token theft/replay attacks
- Most secure option

---

## 📊 Realistic Risk Assessment

### Current Risk Level: 🟡 MEDIUM

**Likelihood of Abuse:** Medium
- JWTs can be extracted from iOS app
- Rate limits are high (TestFlight mode)
- No IP-based protection

**Potential Cost Impact:** $100-$500+
- Depends on number of compromised accounts
- Higher if attacker targets expensive models

**Time to Detect:** Hours to days
- Must manually check admin dashboard
- No automatic alerts

### With Recommended Fixes: 🟢 LOW

**Likelihood of Abuse:** Low
- IP rate limiting stops bots
- Lower rate limits reduce impact
- Bot detection blocks automation

**Potential Cost Impact:** $10-$50 max
- Damage is limited by caps
- Abuse detected quickly

**Time to Detect:** Minutes
- Automatic alerts
- Spending caps enforce limits

---

## 🚨 Immediate Action Items

### Do Right Now (15 minutes)

1. **Lower rate limits for production:**
   ```typescript
   // In chatgpt/generate.ts
   const FREE_TIER_MONTHLY_LIMIT = 20  // Change from 999
   const PRO_TIER_MONTHLY_LIMIT = 500  // Add this cap
   ```

2. **Add IP rate limiting to iOS APIs:**
   - Implement in middleware
   - 50 requests/hour per IP

3. **Add spending alert:**
   - Check costs in admin dashboard daily
   - Set up calendar reminder

### Do This Week (2-3 hours)

4. **Implement bot detection on iOS APIs**
5. **Add request spike detection**
6. **Add daily spending cap**
7. **Shorten JWT expiration to 7 days**

### Do This Month

8. **Implement refresh tokens**
9. **Add device fingerprinting**
10. **Set up automated email/SMS alerts**

---

## 💡 Quick Wins

### Easiest Protection (5 minutes):
1. Change `FREE_TIER_MONTHLY_LIMIT` from 999 to 20
2. Deploy to production

**Impact:** Limits damage from ANY account to $0.50/month

### Best Protection (30 minutes):
1. Add IP rate limiting (50/hour)
2. Enable bot detection on iOS APIs
3. Add daily spending cap ($20/day)

**Impact:** Nearly eliminates abuse risk

---

## 📈 Monitoring Recommendations

### Daily Checks
- [ ] Check OpenAI usage in admin dashboard
- [ ] Review "AI Cost Tracking" section
- [ ] Look for unusual spikes

### Weekly Checks
- [ ] Review top users by request count
- [ ] Check for failed auth attempts
- [ ] Verify rate limits are working

### Monthly Checks
- [ ] Review total OpenAI spending
- [ ] Adjust rate limits based on usage
- [ ] Update security measures

---

## 🎯 Summary

**Your iOS APIs are reasonably secure** but need enhancements to prevent expensive abuse.

**Current state:**
- ✅ JWT authentication working
- ✅ Per-user rate limits active
- ✅ Usage tracking enabled
- ⚠️ Rate limits too high (TestFlight mode)
- ❌ No IP-based protection
- ❌ No bot detection on iOS APIs
- ❌ No spending caps or alerts

**Priority fixes:**
1. Lower rate limits (5 min) 🔴 CRITICAL
2. Add IP rate limiting (30 min) 🔴 CRITICAL
3. Enable bot detection (15 min) 🟡 HIGH
4. Add spending cap (15 min) 🟡 HIGH

**Total time to secure:** ~1-2 hours
**Risk reduction:** 80-90%

Would you like me to implement these security enhancements now?
