# Budget Meal Plan Feature

## Overview
A complete budget meal planning system that uses ChatGPT to generate weekly meal plans based on local grocery store deals and user preferences.

## Features Implemented

### 1. Budget Meal Plan Generator API
**File:** `/pages/api/meal-plans/budget-generate.ts`

**Functionality:**
- Uses ChatGPT (GPT-4) to create complete 7-day meal plans
- Analyzes local grocery store deals from Firestore
- Filters deals by user's location and preferred stores
- Calculates total cost and estimated savings
- Generates organized shopping lists by store
- Saves meal plans to Firestore

**API Endpoint:**
```
POST /api/meal-plans/budget-generate
```

**Request Body:**
```json
{
  "location": "Austin, TX",
  "stores": ["Kroger", "Whole Foods", "Trader Joe's"],
  "weeklyBudget": 150,
  "numberOfPeople": 4,
  "dietaryRestrictions": ["vegetarian"]
}
```

**Response:**
```json
{
  "success": true,
  "mealPlanId": "firebase-doc-id",
  "mealPlan": {
    "totalCost": 142.50,
    "estimatedSavings": 35.20,
    "week": [
      {
        "day": "Monday",
        "meals": {
          "breakfast": { "name": "...", "ingredients": [...] },
          "lunch": { "name": "...", "ingredients": [...] },
          "dinner": { "name": "...", "ingredients": [...] }
        }
      }
    ],
    "groceryList": {
      "byStore": [
        {
          "storeName": "Kroger",
          "items": [...]
        }
      ],
      "totalItems": 45
    },
    "savingsTips": [...]
  },
  "dealsUsed": 23,
  "generatedAt": "2025-12-12T..."
}
```

### 2. Enhanced Budget Page
**File:** `/app/dashboard/budget/page.tsx`

**New Features Added:**
- **Budget Meal Plan Generator Section**
  - Location input (city, state)
  - Number of people selector (1-6)
  - Multi-store selection (Kroger, Safeway, Whole Foods, Trader Joe's, Walmart, Target, Costco, Sam's Club)
  - Generate button with loading state
  - Meal plan preview with cost and savings display

- **Apple Health Theme Updates**
  - Softer pastel gradients
  - Rounded corners (3xl)
  - Cleaner typography
  - Reduced shadows
  - Better spacing

### 3. Existing APIs (Already Created)
**File:** `/pages/api/deals/analyze.ts`

- Analyzes store deals and suggests meal ideas
- Used for discovering budget-friendly recipes

## How It Works

### User Flow:
1. User navigates to `/dashboard/budget`
2. Sets their weekly/monthly budget
3. Clicks "Get Started" on Budget Meal Plan Generator
4. Enters location (e.g., "Austin, TX")
5. Selects number of people
6. Chooses preferred stores
7. Clicks "Generate Budget Meal Plan"
8. ChatGPT analyzes local deals and creates a complete weekly meal plan
9. Meal plan is saved to Firestore
10. User sees preview with total cost and savings
11. User can view full meal plan in `/dashboard/meal-plans`

### Behind the Scenes:
1. **Fetch Deals**: Query Firestore for active deals in user's location and preferred stores
2. **ChatGPT Prompt**: Send deals data + user preferences to GPT-4
3. **Generate Plan**: ChatGPT creates:
   - 7 days of meals (breakfast, lunch, dinner)
   - Complete shopping list organized by store
   - Cost calculations
   - Savings estimates
   - Tips for maximizing savings
4. **Save to Firebase**: Store meal plan in Firestore linked to user
5. **Display Results**: Show preview with key metrics

## Data Structures

### Firestore Collections:

#### `mealPlans` Collection
```typescript
{
  userId: string
  name: string
  type: 'BUDGET' | 'REGULAR'
  weeklyBudget: number
  numberOfPeople: number
  location: string
  stores: string[]
  dietaryRestrictions: string[]
  totalCost: number
  estimatedSavings: number
  week: [
    {
      day: string
      meals: {
        breakfast: { name: string, ingredients: string[] }
        lunch: { name: string, ingredients: string[] }
        dinner: { name: string, ingredients: string[] }
      }
    }
  ]
  groceryList: {
    byStore: [
      {
        storeName: string
        items: [
          {
            name: string
            quantity: string
            estimatedCost: number
            isOnSale: boolean
            originalPrice?: number
          }
        ]
      }
    ]
    totalItems: number
  }
  savingsTips: string[]
  createdAt: Date
  updatedAt: Date
  isCompleted: boolean
}
```

#### `supermarketDiscounts` Collection
```typescript
{
  storeName: string
  location: string
  itemName: string
  originalPrice: number
  discountPrice: number
  discountPercent: number
  validUntil: Date
  category: string
  createdAt: Date
}
```

## ChatGPT Integration

### Model Used:
- GPT-4 Turbo Preview (`gpt-4-turbo-preview`)
- JSON response format
- Temperature: 0.7 (balanced creativity/accuracy)

### Prompt Strategy:
1. Clear role definition: "Expert meal planning assistant"
2. Specific constraints: budget, people count, dietary restrictions
3. Structured data requirements
4. Emphasis on using sale items
5. JSON schema specification

### Cost Optimization:
- Limit deals to 50 items per query
- Use structured JSON responses
- Cache frequently used data
- Optimize prompt length

## Next Steps

### To Fully Complete:
1. **Seed Store Deals Data**
   - Create admin panel for adding deals
   - OR integrate with grocery store APIs
   - OR web scraping (requires legal review)

2. **Add Store Location Service**
   - Update `/lib/store-locations.ts` to use Firebase
   - Create Firestore collection for store locations
   - Add geocoding for distance calculations

3. **User Preferences**
   - Add location to user profile
   - Save preferred stores
   - Store dietary restrictions
   - Remember previous settings

4. **Meal Plan Viewing**
   - Create `/dashboard/meal-plans/[id]` page
   - Display full weekly calendar
   - Show grocery list with checkboxes
   - Add notes/modifications

5. **Shopping List Export**
   - Export to Apple Reminders
   - Export to Google Keep
   - Print-friendly format
   - Share via text/email

6. **Budget Tracking**
   - Track actual spending vs budget
   - Compare to meal plan estimates
   - Calculate real savings
   - Generate reports

## Testing

### Test the Feature:
1. Go to http://localhost:3000/dashboard/budget
2. Scroll to "Budget Meal Plan Generator"
3. Click "Get Started"
4. Fill in location: "Austin, TX"
5. Select stores
6. Click "Generate Budget Meal Plan"
7. Wait for ChatGPT to generate plan (10-30 seconds)
8. View preview

### Note:
- Requires valid OpenAI API key in `.env.local`
- Requires Firebase deals data (currently may return empty)
- Will fall back to general budget plan if no deals found

## Environment Variables Required

```bash
# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Firebase (already configured)
FIREBASE_PROJECT_ID=savry-13adf
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@savry-13adf.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Design Updates

### Apple Health Theme Applied:
- ✅ Soft gradient backgrounds
- ✅ Rounded corners (3xl)
- ✅ Softer shadows
- ✅ Pastel colors
- ✅ Cleaner typography
- ✅ More whitespace
- ✅ Minimalist aesthetic

## Future Enhancements

1. **Smart Suggestions**
   - Analyze past meal plans
   - Suggest based on family favorites
   - Seasonal ingredients
   - Local farmer's markets

2. **Recipe Integration**
   - Link meals to full recipes
   - Nutrition information
   - Cooking time estimates
   - Difficulty ratings

3. **Store Routing**
   - Optimal shopping order
   - Store maps
   - Aisle-by-aisle navigation
   - Apple Watch integration

4. **Community Features**
   - Share successful meal plans
   - Rate deals
   - Community tips
   - Social sharing

5. **AI Improvements**
   - Learn from feedback
   - Improve accuracy over time
   - Better deal matching
   - Smarter substitutions

## Files Created/Modified

### Created:
- `/pages/api/meal-plans/budget-generate.ts` - Budget meal plan API

### Modified:
- `/app/dashboard/budget/page.tsx` - Added meal plan generator UI + Apple Health theme
- `/app/dashboard/page.tsx` - Applied Apple Health theme

### Existing (Reference):
- `/pages/api/deals/analyze.ts` - Deal analysis API
- `/lib/store-locations.ts` - Store location service (needs Firebase migration)

---

**Status:** ✅ Core feature implemented and ready for testing!
**Next:** Add OpenAI API key and test the meal plan generation.





