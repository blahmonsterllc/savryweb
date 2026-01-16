# Firebase Migration Status

## ✅ Completed Migration

### Authentication
- **Status**: Already using Firebase Auth
- **File**: `pages/api/auth/[...nextauth].ts`
- **Works with**: Firebase Admin SDK for server-side verification

### Recipe Generation
- **Status**: ✅ Migrated to Firebase
- **File**: `pages/api/recipes/generate.ts`
- **Changes**:
  - Replaced Prisma with Firestore
  - Uses `recipes` collection in Firestore
  - Saves generated recipes with all metadata
  - Tracks usage count for popular recipes

### Meal Plan Generation
- **Status**: ✅ Migrated to Firebase
- **File**: `pages/api/meal-plans/generate.ts`
- **Changes**:
  - Replaced Prisma with Firestore
  - Uses `mealPlans` collection in Firestore
  - Stores recipes in `mealPlans/{id}/recipes` subcollection
  - Supports budget and dietary restrictions
  - Integrates with supermarket discounts (Pro tier)

### Background Animations
- **Status**: ✅ Fixed
- **File**: `components/AnimatedBackground.tsx`
- **Changes**:
  - Repositioned vegetables to prevent overlap
  - Better spacing with percentage-based positioning
  - Smooth floating animations with different speeds

## 🚧 Pending Migration

The following files still use Prisma and need migration to Firebase:

1. **App API Endpoints** (for iOS app):
   - `pages/api/app/auth.ts`
   - `pages/api/app/recipes/generate.ts`
   - `pages/api/app/meal-plans/generate.ts`
   - `pages/api/app/grocery-list/generate.ts`
   - `pages/api/app/grocery-list/locations.ts`
   - `pages/api/app/sync.ts`

2. **Web API Endpoints**:
   - `pages/api/recipes/[id].ts`
   - `pages/api/recipes/popular.ts`

3. **Dashboard Pages**:
   - `app/dashboard/saved-plans/page.tsx`

## 🧪 Testing Meal Plan Generation

### Prerequisites
Make sure your `.env.local` has:
```env
# OpenAI
OPENAI_API_KEY="your-key-here"

# Firebase Admin (Server-side)
FIREBASE_PROJECT_ID=savry-13adf
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@savry-13adf.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="your-private-key"

# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=your-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=savry-13adf.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=savry-13adf
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=savry-13adf.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### Test Steps

1. **Create a test user** (if you haven't already):
   - Go to http://localhost:3000/register
   - Sign up with test credentials
   - Or use Firebase Console to create a user

2. **Generate a meal plan**:
   - Go to http://localhost:3000/dashboard/meal-plans
   - Click "Create Meal Plan"
   - Fill in the form:
     - Days: 7
     - Budget: $100 (optional)
     - Dietary restrictions: Select any (optional)
   - Click "Generate Meal Plan with AI"

3. **Expected behavior**:
   - The AI will generate a meal plan with recipes
   - Data will be saved to Firestore:
     - `mealPlans/{planId}` - meal plan document
     - `mealPlans/{planId}/recipes/{recipeId}` - recipe references
     - `recipes/{recipeId}` - actual recipe data
   - You'll be redirected to the meal plans list

## 📊 Firestore Collections Used

### Active Collections
- ✅ `users/{userId}` - User profiles
- ✅ `recipes/{recipeId}` - Generated and user-created recipes
- ✅ `mealPlans/{mealPlanId}` - Meal plans with budgets
- ✅ `mealPlans/{mealPlanId}/recipes/{recipeId}` - Recipe assignments
- 🚧 `supermarketDiscounts/{discountId}` - Store deals (needs seeding)

### Not Yet Used
- `savedRecipes` - User's saved recipes
- `groceryLists` - Shopping lists
- `storeItemLocations` - Aisle locations
- `recipeLikes` - Recipe likes
- `recipeViews` - Recipe views
- `favoriteMealPlans` - Favorite plans
- `budgetEntries` - Budget tracking

## 🔧 Next Steps

### Immediate (for testing)
1. ✅ Test meal plan generation
2. ✅ Test recipe generation
3. ⬜ Verify data in Firestore Console

### Short-term (remaining endpoints)
1. ⬜ Migrate remaining API endpoints to Firebase
2. ⬜ Update dashboard pages to fetch from Firestore
3. ⬜ Remove Prisma dependency entirely

### Long-term (for production)
1. ⬜ Set up Firestore Security Rules
2. ⬜ Create Firebase indexes for queries
3. ⬜ Add data validation rules
4. ⬜ Set up Firebase Storage for recipe images

## 🔑 Firebase Security Rules Needed

Before deploying to production, add these rules in Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Recipes - public or user's own
    match /recipes/{recipeId} {
      allow read: if resource.data.isPublic == true || 
                     (request.auth != null && resource.data.userId == request.auth.uid);
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Meal plans - user's own only
    match /mealPlans/{mealPlanId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
      
      // Meal plan recipes subcollection
      match /recipes/{recipeId} {
        allow read, write: if request.auth != null;
      }
    }
    
    // Supermarket discounts - public read
    match /supermarketDiscounts/{discountId} {
      allow read: if true;
      allow write: if false; // Admin only via server
    }
  }
}
```

## 💡 Benefits of Firebase

### vs PostgreSQL/Prisma
- ✅ **No database server needed** - Fully managed
- ✅ **Real-time sync** - Perfect for iOS app
- ✅ **Offline support** - Works without connection
- ✅ **Built-in auth** - Already integrated
- ✅ **Scalable** - Auto-scales with usage
- ✅ **Free tier** - Great for development

### Trade-offs
- ⚠️ **No complex queries** - Some filtering done in-memory
- ⚠️ **Costs can scale** - Monitor read/write operations
- ⚠️ **Learning curve** - Different from SQL

## 📝 Notes

- The server is running at: http://localhost:3000
- All changes are automatically reloaded (hot reload)
- Check browser console and server logs for errors
- Firestore data can be viewed in Firebase Console

## 🐛 Troubleshooting

### "Firebase Admin credentials not configured"
- Check `.env.local` has all Firebase variables
- Ensure `FIREBASE_PRIVATE_KEY` is properly escaped (use `\\n` for newlines)
- Restart dev server after changing environment variables

### "OpenAI API Error"
- Verify `OPENAI_API_KEY` is valid
- Check you have credits available
- Look at server terminal for detailed error

### "Unauthorized" error
- Make sure you're logged in
- Check session in browser dev tools
- Try logging out and back in

## ✅ Summary

The core functionality (meal plan and recipe generation) is now using Firebase/Firestore instead of PostgreSQL/Prisma. You can test meal plan generation right away. The remaining endpoints can be migrated as needed.



