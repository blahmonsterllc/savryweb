# 🚀 iOS Smart Meal Planner - Setup & Testing Guide

## Overview

This guide walks you through setting up and testing the Smart Meal Planner feature in your iOS app.

---

## 📋 Prerequisites

- ✅ Xcode 15+ installed
- ✅ Your Savry iOS app project
- ✅ Server running (localhost or deployed)
- ✅ OpenAI API key configured
- ✅ Sample deals in database

---

## 🔧 Server Setup (Do This First!)

### 1. Install New Dependencies

```bash
cd /Users/gordonlafler/Desktop/savryiowebsite
npm install
```

This installs:
- `jsonwebtoken` - For iOS JWT authentication
- `lucide-react` - For web UI icons

### 2. Add Environment Variables

Add to your `.env.local`:

```bash
# OpenAI (required)
OPENAI_API_KEY=sk-your-key-here

# JWT Secret (required for iOS auth)
JWT_SECRET=your-super-secret-jwt-key-here-min-32-chars
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Populate Sample Data

Run this to add sample deals:

```bash
# Start server
npm run dev

# In another terminal
curl -X POST http://localhost:3000/api/deals/seed-sample
```

Or use the real scraper:
```bash
curl -X POST http://localhost:3000/api/deals/scrape-live \
  -H "Content-Type: application/json" \
  -d '{
    "store": "Kroger",
    "location": "Austin, TX",
    "zipCode": "78701"
  }'
```

---

## 📱 iOS App Setup

### 1. Add Swift Files to Your Xcode Project

Create a new group called `Features/SmartMealPlanner` and add these files from the `IOS_SMART_MEAL_PLANNER.md` guide:

```
SmartMealPlanner/
├── Models/
│   └── SmartMealPlan.swift          (Data models)
├── Services/
│   └── SmartMealPlanService.swift   (API client)
└── Views/
    ├── SmartMealPlanView.swift      (Input form)
    └── MealPlanResultView.swift     (Results + shopping list)
```

### 2. Update Base URL

In `SmartMealPlanService.swift`, set your server URL:

```swift
private let baseURL = "http://localhost:3000"  // Development
// or
private let baseURL = "https://your-domain.com" // Production
```

### 3. Add Navigation Link

In your main navigation (e.g., `MainTabView.swift` or `HomeView.swift`):

```swift
NavigationLink(destination: SmartMealPlanView()) {
    HStack {
        Image(systemName: "sparkles")
        Text("Smart Meal Plan")
    }
}
```

### 4. Ensure KeychainHelper Exists

You should already have `KeychainHelper` for storing tokens. If not, here's a basic implementation:

```swift
import Security
import Foundation

class KeychainHelper {
    static func save(token: String) {
        let data = Data(token.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "authToken",
            kSecValueData as String: data
        ]
        
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }
    
    static func getToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "authToken",
            kSecReturnData as String: true
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return token
    }
    
    static func deleteToken() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "authToken"
        ]
        SecItemDelete(query as CFDictionary)
    }
}
```

---

## 🧪 Testing the Integration

### Test 1: Server API Endpoint

First, test the server endpoint directly:

```bash
# Get a test token (you may need to implement this or use a real login)
TOKEN="your-test-jwt-token"

# Test the smart meal plan endpoint
curl -X POST http://localhost:3000/api/app/meal-plans/smart-generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "days": 5,
    "budget": 100,
    "servings": 4,
    "dietaryRestrictions": ["vegetarian"],
    "preferredStores": ["Kroger", "Walmart"],
    "zipCode": "78701"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "mealPlanId": "abc123",
  "mealPlan": {
    "name": "Budget-Friendly Week",
    "totalCost": 95.50,
    "estimatedSavings": 45.00,
    "days": [ ... ]
  },
  "shoppingList": {
    "byAisle": { ... },
    "byStore": { ... }
  },
  "metadata": {
    "dealsFound": 42,
    "dealsUsed": 28,
    "savings": 45.00
  }
}
```

---

### Test 2: iOS App - Mock Data

Before testing the real API, test with mock data:

```swift
// Add to SmartMealPlanService.swift for testing
func generateMockMealPlan() -> SmartMealPlanResponse {
    return SmartMealPlanResponse(
        success: true,
        mealPlanId: "test123",
        mealPlan: MealPlan(
            name: "Test Meal Plan",
            totalCost: 95.50,
            estimatedSavings: 45.00,
            days: [
                DayPlan(
                    day: 1,
                    meals: Meals(
                        breakfast: Meal(
                            name: "Scrambled Eggs",
                            ingredients: [
                                MealIngredient(
                                    item: "Eggs",
                                    amount: "6 eggs",
                                    store: "Kroger",
                                    price: 3.99,
                                    aisle: "Aisle 12",
                                    section: "Dairy"
                                )
                            ],
                            instructions: "Beat eggs and cook",
                            estimatedCost: 6.48
                        ),
                        lunch: nil,
                        dinner: nil,
                        snack: nil
                    )
                )
            ]
        ),
        shoppingList: ShoppingList(
            byAisle: [
                "Dairy - Aisle 12": [
                    ShoppingItem(
                        item: "Eggs",
                        amount: "1 dozen",
                        price: 3.99,
                        aisle: "Aisle 12",
                        section: "Dairy",
                        store: "Kroger"
                    )
                ]
            ],
            byStore: [
                "Kroger": StoreItems(
                    items: [],
                    total: 45.50
                )
            ]
        ),
        metadata: MealPlanMetadata(
            dealsFound: 42,
            dealsUsed: 28,
            stores: ["Kroger"],
            budget: 100,
            totalCost: 95.50,
            savings: 45.00,
            savingsPercent: 32
        )
    )
}
```

Then in `SmartMealPlanView.swift`:

```swift
private func generateMealPlan() {
    // TEMPORARY: Use mock data for testing
    service.currentMealPlan = service.generateMockMealPlan()
    showingResults = true
    return
    
    // Real API call (enable this after mock testing works)
    Task {
        // ...
    }
}
```

**✅ Run your iOS app and test the UI with mock data first!**

---

### Test 3: iOS App - Real API Call

Once mock data works, enable the real API call:

1. Make sure you're logged in (have a valid JWT token)
2. Remove the mock data code
3. Run the app
4. Navigate to Smart Meal Plan
5. Fill in:
   - ZIP Code: `78701`
   - Days: `5`
   - Budget: `$100`
   - Servings: `4`
   - Stores: Select `Kroger` and `Walmart`
6. Tap "Generate Smart Meal Plan"
7. Wait 10-20 seconds (ChatGPT is thinking!)
8. You should see the results!

---

## 🐛 Troubleshooting

### Issue: "Unauthorized" (401)

**Cause:** Invalid or missing JWT token

**Fix:**
```swift
// Check if token exists
if let token = KeychainHelper.getToken() {
    print("Token exists: \(token.prefix(20))...")
} else {
    print("No token found - user needs to login")
}
```

Make sure user is logged in before accessing Smart Meal Plan.

---

### Issue: "No deals found" (404)

**Cause:** No deals in database for that ZIP code

**Fix:**
```bash
# Add sample deals
curl -X POST http://localhost:3000/api/deals/seed-sample

# Or scrape real deals
curl -X POST http://localhost:3000/api/deals/scrape-live \
  -H "Content-Type: application/json" \
  -d '{"store": "Kroger", "location": "Austin, TX", "zipCode": "78701"}'
```

---

### Issue: "Pro feature required" (403)

**Cause:** User has FREE tier but trying to use budget feature

**Fix:** Either:
- Remove `budget` parameter from request (FREE tier)
- Upgrade user to PRO tier
- Show upgrade prompt in app

```swift
catch APIError.upgradeRequired(let message) {
    // Show upgrade sheet
    self.showUpgradeSheet = true
    self.upgradeMessage = message
}
```

---

### Issue: "OpenAI API error" (500)

**Cause:** OpenAI API key missing or invalid

**Fix:**
```bash
# Check .env.local
cat .env.local | grep OPENAI_API_KEY

# If missing, add it:
echo "OPENAI_API_KEY=sk-your-key" >> .env.local

# Restart server
npm run dev
```

---

### Issue: JSON parsing error

**Cause:** ChatGPT returned invalid JSON

**Fix:** Add error handling:
```swift
do {
    let mealPlanResponse = try JSONDecoder().decode(
        SmartMealPlanResponse.self, 
        from: data
    )
    // ...
} catch {
    print("JSON Error: \(error)")
    print("Response: \(String(data: data, encoding: .utf8) ?? "")")
    throw APIError.invalidResponse
}
```

---

### Issue: Slow response (30+ seconds)

**Cause:** ChatGPT is taking a long time

**Fix:**
- This is normal for first request
- Add loading message: "Finding best deals..."
- Consider increasing timeout:
```swift
request.timeoutInterval = 60 // 60 seconds
```

---

## 📊 Testing Checklist

### Server Tests:
- [ ] Server starts without errors
- [ ] Sample deals are in database
- [ ] OpenAI API key is configured
- [ ] JWT_SECRET is configured
- [ ] Can query deals from Firebase
- [ ] API endpoint responds to curl test

### iOS Tests:
- [ ] App compiles without errors
- [ ] Can navigate to Smart Meal Plan screen
- [ ] Mock data displays correctly
- [ ] Can toggle dietary restrictions
- [ ] Can select multiple stores
- [ ] Generate button enables/disables correctly
- [ ] Loading state shows during API call
- [ ] Results screen displays meal plan
- [ ] Can switch between "By Aisle" and "By Store" views
- [ ] Can check/uncheck shopping items
- [ ] Progress bar updates correctly
- [ ] Can create new meal plan from results

### Integration Tests:
- [ ] Login works and saves JWT token
- [ ] Token is sent with API request
- [ ] API returns valid JSON
- [ ] JSON parses into Swift models
- [ ] UI updates with real data
- [ ] Error handling works (401, 403, 404, 500)
- [ ] Can generate multiple meal plans
- [ ] Data persists across app restarts (if cached)

---

## 🎯 Next Steps After Testing Works

### 1. Polish the UI
- Add animations
- Improve loading states
- Better error messages
- Custom fonts/colors

### 2. Add Features
- Save meal plans locally
- Share meal plans with friends
- Export shopping list to Notes
- Add to Calendar integration

### 3. Analytics
- Track meal plan generations
- Monitor savings per user
- Track most popular stores
- Measure feature adoption

### 4. Optimize Performance
- Cache meal plans locally
- Pre-fetch deals in background
- Reduce API call frequency
- Compress image assets

### 5. Beta Test
- TestFlight build
- 10-20 beta testers
- Collect feedback
- Fix bugs
- Iterate

---

## 📱 Example Test Scenario

**User Story:** Sarah wants a 5-day meal plan on a $100 budget

1. **Open App**
   - Sarah opens Savry app
   - Sees "Smart Meal Plan" in navigation

2. **Fill Form**
   - Taps "Smart Meal Plan"
   - Enters ZIP: 78701
   - Slides days to 5
   - Slides budget to $100
   - Taps "Kroger" and "Walmart"
   - Taps "Generate"

3. **Wait for Results** (15 seconds)
   - Sees loading spinner
   - Message: "Finding best deals at Kroger and Walmart..."

4. **View Results**
   - Sees "Your Meal Plan is Ready! 🎉"
   - 42 deals found, 28 used
   - Total: $95.50 (under budget!)
   - Saved: $45 (32% off)

5. **Browse Meal Plan**
   - Scrolls through 5 days
   - Day 1: Scrambled Eggs, Caesar Salad, Fajitas
   - Day 2: Oatmeal, Sandwich, Spaghetti
   - etc.

6. **Use Shopping List**
   - Scrolls to shopping list
   - Switches to "By Aisle" view
   - Sees:
     - 📍 Aisle 1 - Produce: Lettuce, Tomatoes, Peppers
     - 📍 Meat Counter: Chicken (ON SALE!)
     - 📍 Aisle 12 - Dairy: Eggs, Cheese

7. **Shop in Store**
   - Goes to Kroger
   - Follows aisle order
   - Checks off items as she shops
   - Progress bar: 15/30 items (50%)

8. **Complete**
   - All items checked ✅
   - Total spent: $95.50
   - Sarah saved $45 and 30 minutes!

**Result:** Sarah is happy, tells her friends! 🎉

---

## 🎉 Success Metrics

You'll know it's working when:

✅ Users can generate meal plans in < 30 seconds
✅ Meal plans stay within budget
✅ Shopping lists are organized by aisle
✅ Users report saving time shopping
✅ Users report saving money on groceries
✅ Feature gets used repeatedly (not just once)

---

## 📞 Support

If you get stuck:

1. Check the troubleshooting section above
2. Review the iOS integration guide: `IOS_SMART_MEAL_PLANNER.md`
3. Check server logs for errors
4. Test the API endpoint with curl
5. Use mock data to isolate UI issues
6. Add print statements to debug

---

## 🔗 Related Documentation

- **Full iOS Guide**: `IOS_SMART_MEAL_PLANNER.md`
- **Web Implementation**: `SMART_MEAL_PLANNER_GUIDE.md`
- **Quick Start**: `DREAM_APP_QUICKSTART.md`
- **Overview**: `YOUR_DREAM_APP_IS_READY.md`

---

**Ready to test? Start with the server setup, then move to iOS!** 🚀

Good luck! 💚




