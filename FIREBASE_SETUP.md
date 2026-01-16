# Firebase Setup Guide for Savry

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name it "Savry" (or your preferred name)
4. Enable Google Analytics (optional)
5. Create project

## Step 2: Enable Firestore Database

1. In Firebase Console, go to "Build" → "Firestore Database"
2. Click "Create database"
3. Start in **production mode** (we'll add security rules)
4. Choose your location (e.g., `us-central`)
5. Enable

## Step 3: Enable Firebase Authentication

1. Go to "Build" → "Authentication"
2. Click "Get started"
3. Enable "Email/Password" sign-in method
4. Click "Save"

## Step 4: Get Firebase Config

### For Web App (Client-side)

1. In Project Overview, click the **Web icon** (`</>`)
2. Register app with nickname "Savry Web"
3. Copy the config object
4. Add to your `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### For iOS App

1. In Project Overview, click the **iOS icon**
2. Register app with your bundle ID
3. Download `GoogleService-Info.plist`
4. Add to your Xcode project

## Step 5: Get Service Account Key (Server-side)

1. Go to Project Settings (gear icon) → "Service accounts"
2. Click "Generate new private key"
3. Download the JSON file
4. Add to `.env.local`:

```bash
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email@...iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Important:** Keep the quotes around the private key and the `\n` characters!

## Step 6: Set Up Firestore Security Rules

In Firebase Console → Firestore Database → Rules, paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }
    
    // Users
    match /users/{userId} {
      allow read: if isOwner(userId);
      allow write: if isOwner(userId);
    }
    
    // Recipes
    match /recipes/{recipeId} {
      allow read: if resource.data.isPublic == true || 
                     (isSignedIn() && resource.data.userId == request.auth.uid);
      allow create: if isSignedIn();
      allow update, delete: if isSignedIn() && resource.data.userId == request.auth.uid;
    }
    
    // Meal Plans
    match /mealPlans/{mealPlanId} {
      allow read, write: if isSignedIn() && resource.data.userId == request.auth.uid;
      
      match /recipes/{recipeId} {
        allow read, write: if isSignedIn();
      }
    }
    
    // Grocery Lists
    match /groceryLists/{listId} {
      allow read, write: if isSignedIn() && resource.data.userId == request.auth.uid;
    }
    
    // Public read for store data
    match /storeItemLocations/{locationId} {
      allow read: if isSignedIn();
      allow write: if false; // Admin only
    }
    
    match /supermarketDiscounts/{discountId} {
      allow read: if isSignedIn();
      allow write: if false; // Admin only
    }
    
    // Social features
    match /recipeLikes/{likeId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow delete: if isSignedIn() && resource.data.userId == request.auth.uid;
    }
    
    match /recipeViews/{viewId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
    }
    
    match /favoriteMealPlans/{favoriteId} {
      allow read, write: if isSignedIn() && resource.data.userId == request.auth.uid;
    }
    
    match /budgetEntries/{entryId} {
      allow read, write: if isSignedIn() && resource.data.userId == request.auth.uid;
    }
  }
}
```

Click "Publish"

## Step 7: Set Up Firestore Indexes

You'll need composite indexes for queries. Firebase will tell you which ones when you run queries.

Common indexes needed:
- `recipes`: `isPublic` (asc) + `likesCount` (desc)
- `recipes`: `isPublic` (asc) + `usageCount` (desc)
- `recipes`: `isPublic` (asc) + `viewsCount` (desc)
- `groceryLists`: `userId` (asc) + `createdAt` (desc)
- `mealPlans`: `userId` (asc) + `startDate` (desc)

Firebase will prompt you with a link to create these automatically when needed.

## Step 8: Add OpenAI API Key

For ChatGPT meal plan and store deal features:

```bash
OPENAI_API_KEY=sk-...your_key_here...
```

Get your key from: https://platform.openai.com/api-keys

## Step 9: Keep NextAuth Secret

```bash
NEXTAUTH_SECRET=your_random_secret_here
NEXTAUTH_URL=http://localhost:3000
```

Generate a secret:
```bash
openssl rand -base64 32
```

## Final .env.local Template

```bash
# Firebase Client (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (Server - Keep Secret!)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# OpenAI
OPENAI_API_KEY=

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

## Step 10: Deploy to Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy!

## Testing

Run locally:
```bash
npm run dev
```

Try:
1. Register a new account
2. Login
3. Check Firebase Console → Authentication (should see user)
4. Check Firestore Database → users collection (should see user doc)

## iOS App Integration

For your iOS app, follow the Firebase iOS SDK guide:
- Install Firebase iOS SDK via SPM or CocoaPods
- Initialize Firebase in your AppDelegate
- Use FirebaseAuth for authentication
- Use FirebaseFirestore for real-time sync
- Perfect for Apple Watch sync!

Real-time listener example for grocery lists:
```swift
db.collection("groceryLists")
  .whereField("userId", isEqualTo: userId)
  .addSnapshotListener { querySnapshot, error in
    // Auto-updates when list changes!
  }
```





