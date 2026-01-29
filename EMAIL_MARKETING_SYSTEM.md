# Email Marketing System - Apple Compliant

## 🎯 Strategy

### Marketing Goals:
1. **Customer Acquisition** - Welcome new users, encourage first recipe
2. **Engagement** - Recipe ideas, cooking tips, weekly inspiration
3. **Retention** - Re-engage inactive users, showcase new features
4. **Conversion** - Upgrade free users to Pro with targeted offers

---

## ✅ Apple Compliance Requirements

### Sign in with Apple Rules:
1. **Separate opt-in required** - Can't use Apple login email for marketing without explicit consent
2. **Privacy-focused** - Users chose Apple Sign In for privacy
3. **Clear disclosure** - Must tell users exactly what emails they'll receive
4. **Easy opt-out** - Unsubscribe in every email

### Implementation:
```swift
// iOS App - After successful login
struct WelcomeView: View {
    @State private var wantsEmailUpdates = false
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Welcome to Savry!")
            
            // ✅ COMPLIANT: Explicit opt-in
            Toggle(isOn: $wantsEmailUpdates) {
                VStack(alignment: .leading) {
                    Text("Receive recipe ideas & cooking tips")
                        .font(.body)
                    Text("We'll send you weekly inspiration and exclusive recipes")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Button("Get Started") {
                // Save preference to server
                updateEmailPreference(optIn: wantsEmailUpdates)
            }
        }
    }
}
```

---

## 🗄️ Database Schema

### Update Users Collection:
```typescript
// Firestore users document
{
  id: string,
  email: string,
  name: string,
  tier: "FREE" | "PRO",
  
  // Email marketing fields
  emailMarketingConsent: boolean,           // User opted in?
  emailMarketingConsentDate: Timestamp,     // When they opted in
  emailMarketingConsentSource: string,      // "app_welcome" | "settings" | "web"
  emailUnsubscribed: boolean,               // User unsubscribed?
  emailUnsubscribedDate?: Timestamp,        // When they unsubscribed
  
  // Engagement tracking
  lastEmailSent?: Timestamp,                // Last marketing email
  emailsOpened: number,                     // Track engagement
  emailsClicked: number,                    // Track CTR
  
  // User activity (for segmentation)
  lastActiveAt: Timestamp,                  // Last app open
  recipesCreated: number,                   // Total recipes
  aiRecipesUsed: number,                    // AI Chef usage
  daysSinceSignup: number,                  // Calculate from createdAt
}
```

---

## 📱 iOS App Updates

### 1. Add Email Consent Screen

```swift
// After first successful login
struct EmailConsentView: View {
    @Binding var showingConsent: Bool
    @State private var optIn = false
    
    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "envelope.badge")
                .font(.system(size: 60))
                .foregroundColor(.orange)
            
            Text("Stay Inspired")
                .font(.title)
                .fontWeight(.bold)
            
            Text("Get weekly recipe ideas, cooking tips, and exclusive content delivered to your inbox.")
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
            
            VStack(alignment: .leading, spacing: 12) {
                FeatureRow(icon: "sparkles", text: "Weekly recipe inspiration")
                FeatureRow(icon: "lightbulb", text: "Cooking tips from chefs")
                FeatureRow(icon: "gift", text: "Exclusive Pro user benefits")
                FeatureRow(icon: "bell.badge", text: "New feature announcements")
            }
            .padding()
            .background(Color.orange.opacity(0.1))
            .cornerRadius(12)
            
            Toggle("Yes, send me recipe ideas", isOn: $optIn)
                .toggleStyle(SwitchToggleStyle(tint: .orange))
            
            Button(action: {
                Task {
                    await saveEmailPreference(optIn: optIn)
                    showingConsent = false
                }
            }) {
                Text(optIn ? "Continue" : "Skip for now")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(optIn ? Color.orange : Color.gray)
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }
            
            Text("You can change this anytime in Settings")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
    }
    
    func saveEmailPreference(optIn: Bool) async {
        // Call server API
        await NetworkManager.shared.updateEmailPreference(optIn: optIn)
    }
}
```

### 2. Add Settings Toggle

```swift
// In SettingsView.swift
Section(header: Text("Email Preferences")) {
    Toggle("Recipe ideas & cooking tips", isOn: $emailMarketingEnabled)
        .onChange(of: emailMarketingEnabled) { newValue in
            Task {
                await updateEmailPreference(newValue)
            }
        }
    
    if emailMarketingEnabled {
        Text("We'll send you weekly inspiration and exclusive recipes")
            .font(.caption)
            .foregroundColor(.secondary)
    }
}
```

---

## 🖥️ Server Implementation

### 1. Email Preference API

Create: `pages/api/app/user/email-preference.ts`

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/firebase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = await verifyJWT(token);
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { optIn, source = 'app_settings' } = req.body;

    if (typeof optIn !== 'boolean') {
      return res.status(400).json({ error: 'optIn must be boolean' });
    }

    // Update user preferences
    const updateData: any = {
      emailMarketingConsent: optIn,
      emailMarketingConsentDate: new Date(),
      emailMarketingConsentSource: source,
      updatedAt: new Date()
    };

    if (!optIn) {
      // User unsubscribed
      updateData.emailUnsubscribed = true;
      updateData.emailUnsubscribedDate = new Date();
    } else {
      // User re-subscribed
      updateData.emailUnsubscribed = false;
    }

    await db.collection('users').doc(decoded.userId).update(updateData);

    console.log(`📧 Email preference updated for ${decoded.email}: ${optIn ? 'OPT-IN' : 'OPT-OUT'}`);

    return res.status(200).json({
      success: true,
      emailMarketingConsent: optIn
    });

  } catch (error: any) {
    console.error('❌ Email preference error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

### 2. Public Unsubscribe Endpoint

Create: `pages/api/email/unsubscribe.ts`

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/firebase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('Invalid unsubscribe link');
  }

  try {
    // Decode unsubscribe token (base64 encoded userId)
    const userId = Buffer.from(token as string, 'base64').toString();

    await db.collection('users').doc(userId).update({
      emailUnsubscribed: true,
      emailUnsubscribedDate: new Date(),
      emailMarketingConsent: false,
      updatedAt: new Date()
    });

    // Return friendly HTML page
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed - Savry</title>
          <style>
            body { font-family: system-ui; text-align: center; padding: 50px; }
            .container { max-width: 500px; margin: 0 auto; }
            h1 { color: #0d9488; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ You're unsubscribed</h1>
            <p>You won't receive marketing emails from Savry anymore.</p>
            <p>You can re-subscribe anytime in the app settings.</p>
            <a href="https://savryweb.vercel.app">← Back to Savry</a>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Unsubscribe error:', error);
    return res.status(500).send('Failed to unsubscribe');
  }
}
```

---

## 📧 Email Marketing Tools (Recommended)

### Option 1: Resend (Best for Developers)
- **Pricing:** Free up to 3,000 emails/month, then $20/month
- **Features:** Beautiful templates, React Email support, analytics
- **Compliance:** Built-in unsubscribe, GDPR compliant
- **Integration:** Simple API, works great with Next.js

```bash
npm install resend
```

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'Savry <hello@savry.app>',
  to: user.email,
  subject: 'Weekly Recipe Inspiration',
  html: '<h1>Your weekly recipes...</h1>'
});
```

### Option 2: SendGrid
- **Pricing:** Free up to 100 emails/day, then $19.95/month
- **Features:** Marketing campaigns, automation, templates
- **Compliance:** Unsubscribe groups, list management

### Option 3: Mailchimp
- **Pricing:** Free up to 500 contacts, then $13/month
- **Features:** Drag-drop editor, automation, segmentation
- **Compliance:** Full GDPR/CAN-SPAM compliance

---

## 📊 Email Campaigns Strategy

### 1. Welcome Series (Day 0-7)
**Email 1: Welcome** (Immediately after sign up)
```
Subject: Welcome to Savry! Here's your first AI recipe 🍳
Content:
- Thank you for joining
- Quick tutorial on AI Chef
- Generate your first recipe (CTA)
- Introduce key features
```

**Email 2: Getting Started** (Day 2)
```
Subject: 3 ways to get the most out of Savry
Content:
- Import recipes from web
- Create meal plans
- Use AI Chef for modifications
- Pro tip: Save favorites
```

**Email 3: Pro Features** (Day 5)
```
Subject: Unlock unlimited AI recipes ✨
Content:
- You've used X of 2 free AI recipes
- Show Pro benefits
- Limited offer: First month free
- Testimonials
```

### 2. Engagement Campaigns

**Weekly Recipe Ideas** (Every Monday)
```
Subject: 🌮 This Week's Top Recipes
Content:
- 3 trending recipes
- Seasonal ingredients
- Quick 30-minute meals
- User-generated favorites
```

**Cooking Tips** (Every Thursday)
```
Subject: Chef's Secret: [Cooking Tip]
Content:
- Professional cooking technique
- Ingredient substitution guide
- Kitchen hacks
- Recipe of the week
```

### 3. Re-engagement (Inactive Users)

**After 7 days inactive:**
```
Subject: We miss you! Here's a recipe to get back in the kitchen
Content:
- Personalized recipe suggestion
- New features since they left
- Special offer or incentive
```

**After 30 days inactive:**
```
Subject: Your AI Chef misses you 👨‍🍳
Content:
- Show what they're missing
- Success stories from other users
- Limited time offer
```

### 4. Conversion Campaigns (Free → Pro)

**After 2nd free recipe used:**
```
Subject: You've unlocked Savry's potential - ready for unlimited?
Content:
- Show usage stats
- Compare Free vs Pro
- Testimonials from Pro users
- Upgrade CTA with discount
```

---

## 💻 Server Implementation

### Update Admin Login Page

First, let me add the email to the admin login:

<function_calls>
<invoke name="Read">
<parameter name="path">/Users/gordonlafler/Desktop/savryiowebsite/app/admin/login/page.tsx