# Complete Integration Guide - Savry Website

## ✅ What's Currently Working

### Meal Plans
- ✅ **Generate meal plans** with AI (OpenAI GPT-4o-mini)
- ✅ **View all meal plans** in dashboard
- ✅ **Edit meal plans** (name, budget, notes, rating, completion status)
- ✅ **Delete meal plans** with confirmation
- ✅ **Firebase storage** - All data in Firestore
- ✅ **Budget integration** - Can set budget when generating
- ✅ **Dietary restrictions** - Filter by preferences

### Recipes
- ✅ **Generate recipes** with AI
- ✅ **Firebase storage** - Recipes saved to Firestore
- ✅ **My Recipes API** - `/api/recipes/list` endpoint created

### Budget Tracking
- ✅ **Budget dashboard** exists at `/dashboard/budget`
- ✅ **Weekly/Monthly tracking** UI built
- ✅ **Budget meal plan generator** UI exists
- ⚠️ Uses placeholder data (needs backend integration)

### Authentication
- ✅ **Firebase Auth** with NextAuth
- ✅ **User sessions** working
- ✅ **Protected routes** in dashboard

---

## 🔧 What Needs Integration

### 1. My Recipes Page Integration

**Current State:** Hardcoded empty state
**What's Needed:** Fetch and display recipes from Firebase

The API is ready (`/api/recipes/list`), but the page needs updating to:
- Fetch recipes from API
- Display recipe cards with image, name, description
- Add filters (cuisine, difficulty, dietary tags)
- Search functionality
- Delete/edit buttons

**File to update:** `app/dashboard/recipes/page.tsx`

### 2. Recipe Import from Web

**Current State:** Not built
**What's Needed:** 
- Recipe URL input field
- Web scraping or API to extract recipe data
- Parse ingredients, instructions, times, etc.
- Save to Firebase

**Options:**
- **Option A:** Use a recipe API (Spoonacular, Edamam) - $$$
- **Option B:** Build web scraper with Cheerio - FREE but fragile
- **Option C:** AI extraction - Submit URL → AI extracts recipe

**Recommended:** Option C - Most reliable

**What to build:**
```typescript
// New endpoint needed:
POST /api/recipes/import
{
  url: "https://www.allrecipes.com/recipe/..."
}

// Process:
1. Fetch webpage content
2. Send HTML to OpenAI with prompt:
   "Extract recipe data from this HTML"
3. AI returns structured JSON
4. Save to Firebase
```

### 3. Budget + Meal Plan Integration

**Current State:** Budget page exists but uses fake data
**What's Needed:**

#### A. Track Actual Spending
- When user generates meal plan → record estimated cost
- When user marks meal plan complete → record actual cost
- Sum up for weekly/monthly totals

#### B. Budget API Endpoints Needed:
```typescript
GET  /api/budget/stats        // Get weekly/monthly spending
POST /api/budget/transaction  // Add manual transaction
GET  /api/budget/meal-plans   // Get meal plan costs
```

#### C. Link Meal Plans to Budget
- Meal plans already have `budget` and `totalCost` fields ✅
- Need to aggregate these in budget dashboard
- Show which meal plans contributed to spending

### 4. Use Saved Recipes in Meal Plans

**Current State:** Meal plan generation creates NEW recipes
**What's Needed:** Option to use existing recipes

**Implementation:**
```typescript
// Update meal plan generator to:
1. Show "Use Saved Recipes" toggle
2. If enabled:
   - Fetch user's recipes from Firebase
   - Let them select recipes for each day
   - OR AI selects from their saved recipes
3. Link existing recipe IDs instead of creating new ones
```

**File to update:** `app/dashboard/meal-plans/generate/page.tsx`

---

## 📋 Integration Checklist

### Phase 1: Core Features (Today)
- [ ] Update My Recipes page to fetch from Firebase
- [ ] Add recipe import from web functionality
- [ ] Connect budget tracking to meal plans

### Phase 2: Advanced Features
- [ ] Use saved recipes in meal plan generation
- [ ] Add recipe editing functionality
- [ ] Add recipe deletion
- [ ] Export/share recipes
- [ ] Print shopping lists
- [ ] Meal plan calendar view

### Phase 3: Pro Features
- [ ] Store deals integration (already built in budget page)
- [ ] Aisle navigation (skeleton exists)
- [ ] Nutrition tracking
- [ ] Multi-week meal planning

---

## 🔥 How Everything Works Together

### Current Flow:

```
1. User registers → Firebase Auth ✅
2. User generates recipe → Saved to Firestore ✅
3. User generates meal plan → Saved to Firestore ✅
   - Creates NEW recipes for each meal
   - Saves budget if provided
4. User views meal plans → Fetches from Firestore ✅
5. User edits/deletes → Updates Firestore ✅
```

### Desired Flow:

```
1. User imports recipe from web → Parsed & saved ⚠️
2. User sees recipes in "My Recipes" → Displays all recipes ⚠️
3. User creates meal plan:
   Option A: Generate with AI (current) ✅
   Option B: Use saved recipes ⚠️
4. Meal plan cost → Tracked in budget ⚠️
5. Budget dashboard → Shows real spending ⚠️
```

---

## 🚀 Quick Wins (What to Build Next)

### 1. Recipe Import (30 min)

**Create:** `pages/api/recipes/import.ts`

```typescript
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import { db } from '@/lib/firebase'
import { openai } from '@/lib/openai'
import { Timestamp } from 'firebase-admin/firestore'
import axios from 'axios'

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ message: 'Unauthorized' })

  const { url } = req.body
  
  // Fetch webpage
  const response = await axios.get(url)
  const html = response.data
  
  // Extract with AI
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'system',
      content: 'Extract recipe data from HTML and return as JSON'
    }, {
      role: 'user',
      content: `HTML: ${html.substring(0, 10000)}\n\nExtract: name, ingredients (array), instructions (array), prepTime, cookTime, servings`
    }],
    response_format: { type: 'json_object' }
  })
  
  const recipe = JSON.parse(completion.choices[0].message.content)
  
  // Save to Firebase
  const recipeRef = db.collection('recipes').doc()
  await recipeRef.set({
    ...recipe,
    userId: session.user.id,
    source: 'WEB_IMPORT',
    autoGenerated: false,
    imageUrl: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  
  return res.status(200).json({ id: recipeRef.id, ...recipe })
}
```

**Add to:** `app/dashboard/recipes/page.tsx`
- "Import Recipe" button
- Modal with URL input
- Calls `/api/recipes/import`

### 2. My Recipes Integration (15 min)

**Update:** `app/dashboard/recipes/page.tsx`

```typescript
'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export default function RecipesPage() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function fetchRecipes() {
      const res = await fetch('/api/recipes/list')
      const data = await res.json()
      setRecipes(data.recipes)
      setLoading(false)
    }
    fetchRecipes()
  }, [])
  
  // Display recipe cards
  return (
    <div>
      {recipes.map(recipe => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  )
}
```

### 3. Budget Integration (20 min)

**Create:** `pages/api/budget/stats.ts`

```typescript
// Aggregate meal plan costs
const mealPlansSnapshot = await db.collection('mealPlans')
  .where('userId', '==', session.user.id)
  .get()

const totalSpent = mealPlansSnapshot.docs
  .filter(doc => doc.data().isCompleted)
  .reduce((sum, doc) => sum + (doc.data().actualCost || doc.data().totalCost || 0), 0)

// Calculate weekly/monthly
// Return stats
```

---

## 🎯 Architecture Overview

### Database Structure (Firestore)

```
users/{userId}
  - email, name, tier, budgets

recipes/{recipeId}
  - userId, name, ingredients, instructions, etc.
  - source: 'GENERATED' | 'WEB_IMPORT' | 'USER_CREATED'

mealPlans/{mealPlanId}
  - userId, name, dates, budget, totalCost, actualCost
  /recipes/{recipeRef}
    - recipeId, dayOfWeek, mealType

groceryLists/{listId}
  - userId, mealPlanId, items

supermarketDiscounts/{discountId}
  - location, storeName, itemName, prices
```

### API Structure

```
/api/auth/*              - NextAuth endpoints ✅
/api/recipes/
  - generate             - Generate with AI ✅
  - list                 - Get user's recipes ✅
  - import               - Import from URL ⚠️
  - [id]                 - Get/Update/Delete recipe ⚠️
  
/api/meal-plans/
  - generate             - Generate with AI ✅
  - list                 - Get user's plans ✅
  - update               - Edit meal plan ✅
  - delete               - Delete meal plan ✅
  - budget-generate      - Generate with budget ⚠️
  
/api/budget/
  - stats                - Get spending stats ⚠️
  - transaction          - Add transaction ⚠️
```

---

## 📝 Next Steps

### Immediate (This Session):
1. ✅ Recipe list API created
2. ⚠️ Update recipes page to display
3. ⚠️ Add recipe import functionality

### Short-term (Next Session):
1. Budget API integration
2. Use saved recipes in meal plans
3. Recipe editing/deletion

### Long-term:
1. Store deals scraping
2. Aisle navigation
3. iOS app sync
4. Social features (share recipes)

---

## 🤔 Your Questions Answered

### "Will this work with the rest of the site?"

**Yes!** The meal plan feature is built on the same Firebase backend as everything else:
- ✅ Same auth system
- ✅ Same database (Firestore)
- ✅ Same API pattern
- ✅ All features share user data

### "Will it work with budgeting?"

**Partially:** 
- ✅ Meal plans store budget/cost data
- ⚠️ Budget dashboard needs to FETCH this data (15 min fix)
- ⚠️ Need to aggregate weekly/monthly totals

### "Can we use saved recipes?"

**Not yet, but easy to add:**
1. Add "Use Saved Recipes" option in meal plan generator
2. Fetch user's recipes
3. Either:
   - Let user manually select (drag & drop?)
   - AI selects best matches based on budget/preferences

### "Can we import recipes from web?"

**Not built yet, but straightforward:**
- Give user URL input
- Fetch webpage
- Use AI to extract recipe data
- Save to Firebase
- Takes ~30 minutes to build

---

## 💡 Recommendations

### Priority 1: Complete Core Loop
1. Build recipe import (users need this!)
2. Show recipes in "My Recipes"
3. Let users edit/delete recipes

### Priority 2: Budget Integration
1. Fetch meal plan costs in budget dashboard
2. Show weekly/monthly spending
3. Track savings vs regular spending

### Priority 3: Enhanced Meal Planning
1. Use saved recipes option
2. Multi-week planning
3. Grocery list optimization

---

## 🐛 Known Issues

1. **Firebase Index** - Needs manual creation (1-click link provided)
2. **Recipe images** - Not implemented (future: AI-generated or from import)
3. **Budget tracking** - Uses placeholder data (needs backend)
4. **Meal plan details page** - Returns 404 (needs building)

---

## 📚 Files Reference

### Key Files:
- `app/dashboard/meal-plans/page.tsx` - Meal plans list ✅
- `app/dashboard/recipes/page.tsx` - Recipes list ⚠️
- `app/dashboard/budget/page.tsx` - Budget dashboard ⚠️
- `pages/api/meal-plans/generate.ts` - AI generation ✅
- `pages/api/recipes/generate.ts` - Recipe AI ✅
- `lib/firebase.ts` - Firebase Admin SDK ✅
- `lib/openai.ts` - OpenAI integration ✅

### Documentation:
- `FIREBASE_INDEX_QUICK_SETUP.md` - Index setup
- `FIRESTORE_STRUCTURE.md` - Database schema
- `FIREBASE_MIGRATION_STATUS.md` - Migration status

---

Your site has a **solid foundation** with Firebase, meal plans, and recipes working. The main gaps are:
1. Recipe import feature
2. Displaying saved recipes  
3. Budget backend integration

Want me to build any of these now?



