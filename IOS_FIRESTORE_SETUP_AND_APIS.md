# Savry iOS App — Firestore Setup + API Contract (Deals, In‑Store Ingredient Finder, Budgeting)

This document is the **single source of truth** for wiring your iOS app to the same **Firebase Auth + Firestore** data model the web app uses, including:

- **Store Deal Finder** (query `supermarketDiscounts`)
- **In‑Store Ingredient Finder** (query `storeItemLocations`)
- **Budgeting** (budgets on `users/{userId}` + optional `budgetEntries` + meal plan cost fields)
- **Recipes, Meal Plans, Grocery Lists, Saved items** (shared collections)

It’s written to match this repo’s current Firestore usage and field names.

---

## What iOS should use (high level)

- **Firebase Auth (iOS)**: sign in and get `uid`.
- **Firestore (iOS)**: read/write user-owned data directly (recipes, meal plans, grocery lists, budgets).
- **Server endpoints (optional, recommended for AI)**: call server for AI generation (OpenAI stays server-side), then read the saved objects from Firestore.

> Note: This repo contains some older iOS endpoints under `pages/api/app/*` that still use Prisma. The Firestore-first approach below is what you want for the iOS app long-term.

---

## 1) Firebase iOS setup (Swift Package Manager)

### Create/Register the iOS app in Firebase

1. Firebase Console → Project settings → Your apps → **Add app** → **iOS**
2. Add your **Bundle ID**
3. Download `GoogleService-Info.plist`
4. Add it to your Xcode project (ensure it is included in the main target)

### Add Firebase via SPM

Xcode → File → Add Package Dependencies…

- **URL**: `https://github.com/firebase/firebase-ios-sdk`
- Add products:
  - `FirebaseAuth`
  - `FirebaseFirestore`
  - `FirebaseFirestoreSwift` (optional, but convenient)

### Initialize Firebase

In your `@main` App:

```swift
import SwiftUI
import FirebaseCore

@main
struct SavryApp: App {
    init() {
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

---

## 2) Environment + auth alignment (important)

### If you call the server “smart” endpoints

This repo has Firestore-backed “smart” endpoints:

- `POST /api/app/meal-plans/smart-generate`
- `POST /api/app/recipes/smart-generate`

They authenticate using `JWT_SECRET` (via `lib/auth.ts`).

**Action:** set your server env so the iOS-auth token secret matches what the smart endpoints verify:

```bash
# .env.local (server)
JWT_SECRET=...same value as NEXTAUTH_SECRET...
NEXTAUTH_SECRET=...same value as JWT_SECRET...
```

This keeps the iOS token usable everywhere until auth is unified around Firebase ID tokens.

---

## 3) Firestore collections (contract)

### `users/{userId}`

User profile + budgeting + tier.

Required fields used by the app:

- `email`: string
- `name`: string | null
- `tier`: `"FREE"` | `"PRO"`
- `weeklyBudget`: number | null
- `monthlyBudget`: number | null
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

### `supermarketDiscounts/{discountId}` (Store Deal Finder)

Deals used by the web app and iOS smart features.

Fields currently written by deal scraping/seeding in this repo:

- `storeName`: string
- `location`: string (city/label; optional in some flows)
- `zipCode`: string (primary filter for iOS)
- `itemName`: string
- `category`: string | null
- `originalPrice`: number
- `discountPrice`: number
- `discountPercent`: number
- `validUntil`: Timestamp/Date
- `aisle`: string (ex: `"Aisle 1"`, `"Meat Counter"`)
- `section`: string (ex: `"Produce"`)
- `imageUrl`: string | null
- `description`: string | null
- `scrapedAt`: Timestamp/Date
- `createdAt`: Timestamp/Date
- `updatedAt`: Timestamp/Date

### `storeItemLocations/{locationId}` (In‑Store Ingredient Finder)

Used to map ingredients → aisle/section/shelf for a store/area.

- `storeName`: string
- `storeChain`: string (ex: `"Kroger"`, `"Safeway"`)
- `location`: string (zip code or city; pick one convention and keep it consistent)
- `itemName`: string (recommend storing normalized lowercase as the canonical key)
- `category`: string
- `aisle`: string
- `section`: string
- `shelfLocation`: string | null
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

### `recipes/{recipeId}`

Recipes are stored in Firestore for the web app and smart iOS recipe generation.

Common fields:

- `userId`: string | null
- `name`: string
- `description`: string | null
- `ingredients`: array (objects)
- `instructions`: array (strings)
- `prepTime`, `cookTime`, `servings`, `calories`: numbers | null
- `difficulty`, `cuisine`: string | null
- `dietaryTags`: string[]
- `estimatedCost`: number | null
- `createdAt`, `updatedAt`: Timestamp/Date

### `mealPlans/{mealPlanId}`

Two patterns exist in this repo:

1) **Web migration pattern**: `mealPlans/{id}` + `mealPlans/{id}/recipes/*` subcollection
2) **Smart iOS pattern** (current): a single document containing `shoppingList` + `meals`

For iOS, assume these fields may exist:

- `userId`: string
- `name`: string
- `budget`: number | null
- `totalCost`: number | null
- `actualCost`: number | null
- `isCompleted`: boolean
- `startDate`, `endDate`: Timestamp (web pattern)
- `zipCode`: string (smart pattern)
- `preferredStores`: string[]
- `dietaryRestrictions`: string[]
- `estimatedSavings`: number | null
- `shoppingList`: object (by-aisle + by-store grouping)
- `meals`: array (days/meals)
- `createdAt`, `updatedAt`: Timestamp/Date

### `groceryLists/{listId}`

- `userId`: string
- `mealPlanId`: string | null
- `name`: string
- `items`: array of objects:
  - `name`, `quantity`, `unit`, `category`
  - optional `price`, `store`, `aisle`, `section`, `checked`
- `totalCost`: number | null
- `createdAt`, `updatedAt`: Timestamp

### `budgetEntries/{entryId}` (optional, if you want manual transactions)

- `userId`: string
- `amount`: number
- `category`: string
- `description`: string | null
- `date`: Timestamp
- `type`: `"PLANNED"` | `"ACTUAL"`
- `createdAt`: Timestamp

---

## 4) iOS Firestore queries you’ll use

### Deal Finder (by ZIP + store)

Firestore supports `in` with up to 10 values.

```swift
import FirebaseFirestore

func fetchDeals(zipCode: String, storeNames: [String]) async throws -> [QueryDocumentSnapshot] {
    let db = Firestore.firestore()

    // Firestore "in" max is 10; keep it capped.
    let stores = Array(storeNames.prefix(10))

    let query = db.collection("supermarketDiscounts")
        .whereField("zipCode", isEqualTo: zipCode)
        .whereField("storeName", in: stores)
        .whereField("validUntil", isGreaterThan: Date())
        .order(by: "validUntil")
        .order(by: "discountPercent", descending: true)
        .limit(to: 50)

    return try await query.getDocuments().documents
}
```

If Firestore prompts for an index, create it in Firebase Console (it will give you a one-click link).

### Ingredient Finder (single item location)

For best results, normalize your item name to lowercase and store your canonical lookup that way.

```swift
import FirebaseFirestore

func findItemLocation(storeChain: String, location: String, itemName: String) async throws -> DocumentSnapshot? {
    let db = Firestore.firestore()
    let normalized = itemName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

    let query = db.collection("storeItemLocations")
        .whereField("storeChain", isEqualTo: storeChain)
        .whereField("location", isEqualTo: location)
        .whereField("itemName", isEqualTo: normalized)
        .limit(to: 1)

    return try await query.getDocuments().documents.first
}
```

### Budget (read/write budgets on user profile)

```swift
import FirebaseAuth
import FirebaseFirestore

func updateBudgets(weekly: Double?, monthly: Double?) async throws {
    guard let uid = Auth.auth().currentUser?.uid else { throw NSError() }
    let db = Firestore.firestore()
    let ref = db.collection("users").document(uid)

    var data: [String: Any] = ["updatedAt": FieldValue.serverTimestamp()]
    if let weekly { data["weeklyBudget"] = weekly }
    if let monthly { data["monthlyBudget"] = monthly }

    try await ref.setData(data, merge: true)
}
```

### Budget stats (simple approach)

If you use `budgetEntries`, query by user + date range and sum client-side. If you track spending via meal plans, query `mealPlans` by date range and sum `actualCost ?? totalCost`.

---

## 5) Indexes (required)

This repo already includes some index config in:

- `firestore.indexes.json`

You will likely need **additional composite indexes** for iOS queries (especially deals-by-zip + storeName + validUntil ordering). Create them when Firestore prompts you during development.

---

## 6) Security rules (baseline)

Use a strict baseline: users can only read/write their own documents; deals/locations are read-only to clients.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isOwner(userId) { return signedIn() && request.auth.uid == userId; }

    match /users/{userId} {
      allow read, write: if isOwner(userId);
    }

    match /recipes/{recipeId} {
      allow read: if resource.data.isPublic == true || (signedIn() && resource.data.userId == request.auth.uid);
      allow create: if signedIn();
      allow update, delete: if signedIn() && resource.data.userId == request.auth.uid;
    }

    match /mealPlans/{mealPlanId} {
      allow read, write: if signedIn() && resource.data.userId == request.auth.uid;
      match /recipes/{recipeId} { allow read, write: if signedIn(); }
    }

    match /groceryLists/{listId} {
      allow read, write: if signedIn() && resource.data.userId == request.auth.uid;
    }

    match /budgetEntries/{entryId} {
      allow read, write: if signedIn() && resource.data.userId == request.auth.uid;
    }

    // Deals + store aisle maps are client-read, server-write
    match /supermarketDiscounts/{id} {
      allow read: if signedIn();
      allow write: if false;
    }
    match /storeItemLocations/{id} {
      allow read: if signedIn();
      allow write: if false;
    }
  }
}
```

---

## 7) Recommended iOS data flow for the two “finder” features

### Store Deal Finder

- iOS reads `supermarketDiscounts` by:
  - `zipCode`
  - `storeName in [...]` (max 10)
  - `validUntil > now`
  - order by `validUntil`, then `discountPercent desc`

### In‑Store Ingredient Finder

- iOS searches `storeItemLocations` by:
  - `storeChain`
  - `location` (zip or city — choose one)
  - `itemName` (normalized)

If you want fuzzy search (“tomato” matches “roma tomatoes”), add a normalized key strategy (ex: `itemNameNormalized`, `keywords` array) and index accordingly.

---

## 8) Where this fits with the AI features

- iOS can **call**:
  - `POST /api/app/meal-plans/smart-generate` (budget + deals + aisle-aware shopping list)
  - `POST /api/app/recipes/smart-generate` (optional “useDeals” mode)
- Those endpoints **save to Firestore**, then the iOS app can listen to the resulting `mealPlans/{id}` or `recipes/{id}` documents for real-time updates.

---

## Appendix: Known mismatches to be aware of

- Some `/pages/api/app/*` endpoints still use Prisma (`prisma/*`) and are listed as “pending migration” in `FIREBASE_MIGRATION_STATUS.md`.
- Firestore-backed “smart” endpoints include extra fields on `mealPlans`/`recipes` beyond the older schema docs; iOS should treat those fields as additive and optional.



