# Social & Budgeting Features Documentation

## Overview
Added comprehensive social and budgeting features to Savry, transforming it from a personal recipe app into a community-driven platform with financial tracking capabilities.

---

## 🎯 New Features Added

### 1. **Social Discovery System** (`/dashboard/discover`)

#### Features:
- **Trending Recipes** 🔥
  - Shows recipes with most views in the last 7 days
  - Displays likes, views, and saves count
  - Top 3 recipes get special "Trending" badges
  - Real-time community engagement metrics

- **Most Loved Recipes** ❤️
  - Recipes sorted by total likes
  - Shows community approval ratings
  - Quick access sidebar for popular items

- **Most Cooked Recipes** 👨‍🍳
  - Recipes sorted by usage count
  - Shows how many times recipes have been made
  - Helps users find tried-and-tested recipes

- **Community Stats**
  - Total trending recipes count
  - Total likes across platform
  - Total times recipes have been cooked
  - Visual gradient statistics cards

#### Database Changes:
```prisma
model Recipe {
  likesCount    Int       @default(0)
  viewsCount    Int       @default(0)
  isPublic      Boolean   @default(false)
  // ... relations
  likes         RecipeLike[]
  views         RecipeView[]
}

model RecipeLike {
  userId    String
  recipeId  String
  // Tracks user likes
}

model RecipeView {
  userId    String
  recipeId  String
  viewedAt  DateTime
  // Tracks recipe views
}
```

---

### 2. **Budget Tracking System** (`/dashboard/budget`)

#### Features:
- **Weekly Budget Tracking** 📅
  - Set weekly grocery budget
  - Track spending vs budget
  - Visual progress bars
  - Color-coded alerts (green/yellow/red)
  - Percentage tracking

- **Monthly Budget Tracking** 📊
  - Set monthly grocery budget
  - Track cumulative spending
  - Month-to-date tracking
  - Budget remaining/overage display

- **Budget Stats**
  - Total saved using meal plans
  - Average weekly cost per meal plan
  - Number of completed plans
  - Gradient stat cards with icons

- **Transaction History**
  - Recent grocery purchases
  - Store information
  - Date tracking
  - Category labels
  - Amount display

- **Budget Management**
  - Edit mode for budget amounts
  - Real-time budget updates
  - Visual feedback on spending

#### Database Changes:
```prisma
model User {
  weeklyBudget  Float?
  monthlyBudget Float?
  budgetEntries BudgetEntry[]
}

model MealPlan {
  budget        Float?
  totalCost     Float?
  actualCost    Float?
  isCompleted   Boolean   @default(false)
  rating        Int?
  notes         String?
}

model BudgetEntry {
  userId      String
  amount      Float
  category    String
  description String?
  date        DateTime
  type        BudgetType // PLANNED or ACTUAL
}
```

---

### 3. **Saved Meal Plans System** (`/dashboard/saved-plans`)

#### Features:
- **Favorite Meal Plans** ⭐
  - Star favorite plans that worked well
  - Add personal notes on why plans worked
  - Display in special golden cards
  - Quick "Use Again" button
  - Rating system (1-5 stars)

- **Completed Plans Tracking** ✅
  - List all completed meal plans
  - Show completion status
  - Display dates and duration
  - Show total cost and savings
  - Personal notes and ratings

- **Plan Analytics**
  - Total completed plans count
  - Total favorite plans count
  - Total money saved
  - Visual statistics

- **Plan Details**
  - Duration (days)
  - Number of recipes
  - Total cost
  - User rating
  - Personal notes
  - Quick view/reuse options

#### Database Changes:
```prisma
model FavoriteMealPlan {
  userId      String
  mealPlanId  String
  notes       String?
  // Links users to their favorite plans
}

model MealPlan {
  isCompleted   Boolean   @default(false)
  rating        Int?
  notes         String?
  favoritedBy   FavoriteMealPlan[]
}
```

---

### 4. **Enhanced Dashboard** (`/dashboard`)

#### New Features:
- **User Statistics Row**
  - Your Recipes count
  - Plans Completed count
  - Trending Now count
  - User Tier display
  - Color-coded gradient stats

- **New Quick Actions**
  - 🔥 Discover (trending recipes)
  - 💰 Budget (budget tracking)
  - ⭐ Saved Plans (favorite meal plans)
  - Enhanced navigation cards

- **Trending Section**
  - Shows 3 trending recipes
  - Community engagement metrics
  - Direct links to Discover page
  - Orange/red gradient theme

- **Enhanced Recent Items**
  - Better recipe cards with images
  - Meal plan status indicators
  - "View All" quick links
  - Completion badges

---

### 5. **Updated Navigation** (`components/Navbar.tsx`)

#### New Menu Items:
- **🔥 Discover** - Browse trending & popular recipes
- **💰 Budget** - Track grocery spending
- Repositioned Meal Plans and Recipes
- Pro Deals remain for Pro users

---

## 🎨 Design Highlights

### Visual Elements:
- **Glassmorphism cards** throughout
- **Gradient statistics** with color coding:
  - Primary/Secondary: General stats
  - Green/Emerald: Budget/savings
  - Orange/Red: Trending/hot items
  - Yellow/Orange: Favorites/PRO features
  - Purple/Pink: Completions/achievements

### Interactive Elements:
- **Hover effects** on all cards
- **Transform animations** on hover
- **Color transitions** for active states
- **Progress bars** with color coding
- **Emoji indicators** for quick recognition

### Typography:
- **Large headings** (text-5xl)
- **Bold stats** (text-3xl/4xl)
- **Gradient text** for emphasis
- **Icon integration** throughout

---

## 📊 Social Features Breakdown

### Recipe Social Features:
1. **Views Tracking**
   - Automatic view counting
   - Displays view count on cards
   - Helps identify popular recipes

2. **Likes System**
   - Heart icon for likes
   - Like count display
   - User can like/unlike recipes

3. **Save/Bookmark**
   - Bookmark icon
   - Save count display
   - Personal recipe collection

4. **Public/Private Toggle**
   - Recipes can be shared publicly
   - Private recipes stay personal
   - Community contributions

### Community Engagement:
- **Trending Algorithm**: Views + Likes + Usage
- **Creator Attribution**: Shows who created recipes
- **Usage Statistics**: Times cooked by community
- **Social Proof**: Displays engagement metrics

---

## 💰 Budget Features Breakdown

### Budget Setting:
- Set weekly grocery budget
- Set monthly grocery budget
- Editable in-app
- Persistent storage

### Budget Tracking:
- Real-time spending tracking
- Planned vs actual costs
- Budget remaining calculations
- Overage warnings

### Meal Plan Integration:
- Planned budget per meal plan
- Actual cost tracking
- Savings calculations
- Cost per plan analytics

### Financial Analytics:
- Total saved across all plans
- Average weekly spending
- Budget adherence tracking
- Monthly summaries

---

## 🎯 User Journey Examples

### Discovery Journey:
1. User logs in → sees trending recipes on dashboard
2. Clicks "Discover" → browses community recipes
3. Views trending recipe → likes it
4. Saves recipe to personal collection
5. Recipe creator gets engagement notification

### Budget Journey:
1. User sets weekly budget ($150)
2. Creates meal plan with budget constraint
3. Gets grocery list with estimated costs
4. Shops and logs actual spending
5. Views budget tracker showing savings
6. Completes meal plan and rates it
7. Sees total savings on saved plans page

### Meal Plan Journey:
1. User creates meal plan
2. Completes the plan over the week
3. Marks plan as completed
4. Adds rating (4 stars)
5. Adds notes: "Kids loved the pasta dish!"
6. Favorites the plan for future use
7. Can reuse plan with one click

---

## 🚀 Next Steps / Future Enhancements

### Potential Additions:
1. **Social Features**:
   - Recipe comments
   - User profiles
   - Follow other users
   - Recipe collections
   - Share meal plans

2. **Budget Features**:
   - Export to CSV
   - Budget reports
   - Spending trends
   - Store price comparisons
   - Receipt scanning

3. **Gamification**:
   - Badges for milestones
   - Cooking streaks
   - Community challenges
   - Leaderboards

4. **Advanced Analytics**:
   - Cost per serving
   - Nutrition tracking
   - Seasonal trends
   - Personal taste preferences

---

## 📝 API Endpoints Needed

### Social Features:
```typescript
POST   /api/recipes/[id]/like       // Like a recipe
DELETE /api/recipes/[id]/like       // Unlike a recipe
POST   /api/recipes/[id]/view       // Track a view
GET    /api/recipes/trending        // Get trending recipes
GET    /api/recipes/popular         // Get most liked
```

### Budget Features:
```typescript
GET    /api/budget                  // Get user budget data
PUT    /api/budget                  // Update budget settings
POST   /api/budget/entries          // Add transaction
GET    /api/budget/stats            // Get budget statistics
```

### Meal Plan Features:
```typescript
PUT    /api/meal-plans/[id]/complete  // Mark as completed
POST   /api/meal-plans/[id]/favorite  // Add to favorites
PUT    /api/meal-plans/[id]/rating    // Rate meal plan
```

---

## 🎨 Color Scheme Reference

### Primary Actions:
- Primary: `#14b8a6` (Teal)
- Secondary: `#06b6d4` (Cyan)

### Social Features:
- Trending: Orange `#f97316` to Red `#ef4444`
- Likes: Red `#ef4444` (hearts)
- Views: Blue `#3b82f6` (eyes)
- Saves: Yellow `#eab308` (bookmarks)

### Budget Features:
- Savings: Green `#10b981` to Emerald `#059669`
- Warning: Yellow `#eab308` to Orange `#f97316`
- Over Budget: Red `#ef4444` to Red-600 `#dc2626`

### Completions:
- Success: Green `#10b981`
- Favorites: Yellow `#eab308` to Orange `#f97316`
- Achievements: Purple `#8b5cf6` to Pink `#ec4899`

---

## ✅ Implementation Checklist

### Database:
- [x] Update Prisma schema
- [ ] Run migrations
- [ ] Seed sample data

### Pages:
- [x] Create Discover page
- [x] Create Budget page
- [x] Create Saved Plans page
- [x] Update Dashboard
- [x] Update Navbar

### Components:
- [x] Social stat cards
- [x] Budget trackers
- [x] Progress bars
- [x] Trending badges
- [x] Rating displays

### API Routes:
- [ ] Recipe likes endpoint
- [ ] Recipe views endpoint
- [ ] Budget CRUD endpoints
- [ ] Meal plan completion endpoint
- [ ] Favorites endpoint

### Testing:
- [ ] Test social interactions
- [ ] Test budget calculations
- [ ] Test meal plan favorites
- [ ] Test navigation flow

---

## 🎉 Summary

The platform now offers:
- **Social Discovery**: Find trending and popular recipes from the community
- **Budget Tracking**: Monitor grocery spending and save money
- **Meal Plan Favorites**: Save and reuse successful meal plans
- **Enhanced Dashboard**: Quick access to all new features
- **Community Engagement**: Likes, views, and usage statistics

This transforms Savry from a personal recipe tool into a **community-driven meal planning platform** with **financial awareness** built-in!





