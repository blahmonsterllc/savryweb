# Firestore Index Setup

## Why You Need This

Firebase requires composite indexes when you query with:
- `where()` on one field + `orderBy()` on another field
- Multiple `orderBy()` clauses

Our meal plans query uses:
```javascript
where('userId', '==', session.user.id)
orderBy('createdAt', 'desc')
```

## Quick Setup (2 minutes)

### Method 1: Automatic (Recommended)

1. **Try to view your meal plans** at http://localhost:3000/dashboard/meal-plans
2. **Open browser console** (F12 or Cmd+Option+I on Mac)
3. **Look for the Firestore error** - it will include a link like:
   ```
   https://console.firebase.google.com/v1/r/project/savry-13adf/firestore/indexes?create_composite=...
   ```
4. **Click the link** - it will open Firebase Console with pre-filled index settings
5. **Click "Create Index"**
6. **Wait 1-2 minutes** for the index to build
7. **Refresh your meal plans page** - it should work now!

### Method 2: Manual Setup

If you don't see the automatic link, create it manually:

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Select your project**: `savry-13adf`
3. **Navigate to**: Firestore Database → Indexes tab
4. **Click "Create Index"**
5. **Configure the index**:
   - **Collection ID**: `mealPlans`
   - **Fields to index**:
     - Field: `userId`, Order: Ascending
     - Field: `createdAt`, Order: Descending
   - **Query scope**: Collection
6. **Click "Create"**
7. **Wait for the index to build** (shows "Building..." then "Enabled")

## What You Should See

### Before Index (Error)
```
FirebaseError: The query requires an index. 
You can create it here: https://console.firebase.google.com/...
```

### After Index (Success)
- Your meal plans list page loads
- Shows all your generated meal plans
- Displays: name, dates, budget, estimated cost
- Clickable cards to view details

## Testing the Fix

1. **Go to**: http://localhost:3000/dashboard/meal-plans/generate
2. **Create a meal plan**:
   - Days: 3
   - Budget: $50 (optional)
   - Click "Generate Meal Plan with AI"
3. **Wait ~30 seconds** for generation
4. **You'll be redirected** to meal plans list
5. **You should see your meal plan!**

## Other Indexes You'll Need

As you use more features, you might need these indexes:

### For Recipes
```
Collection: recipes
Fields:
  - userId (Ascending)
  - createdAt (Descending)
```

### For Recipe Search
```
Collection: recipes
Fields:
  - isPublic (Ascending)
  - likesCount (Descending)
```

### For Discounts
```
Collection: supermarketDiscounts
Fields:
  - location (Ascending)
  - validUntil (Ascending)
  - discountPercent (Descending)
```

**Note**: Firestore will tell you when you need these. Just follow the automatic link!

## Troubleshooting

### "Still showing empty list"
- Clear browser cache and refresh
- Check browser console for errors
- Make sure you're logged in
- Verify the meal plan was actually created (check Firebase Console → Firestore)

### "Index is building forever"
- Usually takes 1-2 minutes
- Refresh the Firebase Console indexes page
- If stuck >5 minutes, delete and recreate

### "Wrong index configuration"
- Delete the index in Firebase Console
- Follow Method 1 (automatic link) for correct settings

## Next Steps

After the index is created:
1. ✅ Meal plans will display correctly
2. ✅ You can click to view details (we'll build that page next)
3. ✅ All future meal plans will show up automatically

You only need to create each index **once** - it works forever after that!



