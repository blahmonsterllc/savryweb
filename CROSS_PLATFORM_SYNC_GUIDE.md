# 🔄 Cross-Platform Sync System - iOS ↔️ Web

## 📱💻 **Seamless Data Synchronization**

This guide shows how to sync data between your iOS app and web application so users can:
- ✅ **Save recipes on iOS** → See them on web
- ✅ **Create meal plans on web** → Access them on iOS
- ✅ **Update shopping lists** → Sync everywhere
- ✅ **Set budgets and preferences** → Shared across devices
- ✅ **Track grocery purchases** → Updated in real-time

---

## 🏗️ **Architecture Overview**

```
┌─────────────────────────────────────────────────────┐
│                   Firebase Cloud                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Users   │  │  Recipes  │  │  Meal Plans      │  │
│  │          │  │           │  │                  │  │
│  └──────────┘  └──────────┘  │  Shopping Lists  │  │
│                               │                  │  │
│                               │  User Prefs      │  │
│                               └──────────────────┘  │
└─────────────────────────────────────────────────────┘
                    ↑                  ↑
                    │                  │
         ┌──────────┴─────────┬────────┴────────┐
         │                    │                  │
    ┌────▼────┐          ┌────▼────┐       ┌────▼────┐
    │         │          │         │       │         │
    │  iOS    │   ←→     │ Server  │  ←→   │   Web   │
    │  App    │          │   API   │       │   App   │
    │         │          │         │       │         │
    └─────────┘          └─────────┘       └─────────┘
```

---

## 📊 **Data Models**

### **1. User Account**
```typescript
// Firestore: /users/{userId}
{
  userId: string
  email: string
  displayName: string
  subscription: 'free' | 'pro' | 'family'
  zipCode: string
  preferredStores: string[]
  dietaryRestrictions: string[]
  defaultServings: number
  defaultBudget: number
  createdAt: Timestamp
  updatedAt: Timestamp
  lastSyncedAt: Timestamp
}
```

### **2. Saved Recipes**
```typescript
// Firestore: /users/{userId}/recipes/{recipeId}
{
  recipeId: string
  name: string
  description: string
  cuisine: string
  difficulty: string
  prepTime: string
  cookTime: string
  servings: number
  estimatedCost: number
  ingredients: Array<{
    name: string
    quantity: string
    unit: string
    price?: number
    store?: string
    aisle?: string
    section?: string
  }>
  instructions: string[]
  tips?: string
  imageUrl?: string
  source: 'ios' | 'web' | 'generated'
  isFavorite: boolean
  timesCooked: number
  lastCookedAt?: Timestamp
  tags: string[]
  nutritionInfo?: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### **3. Meal Plans**
```typescript
// Firestore: /users/{userId}/mealPlans/{mealPlanId}
{
  mealPlanId: string
  name: string
  days: number
  servings: number
  budget: number
  totalCost: number
  estimatedSavings: number
  zipCode: string
  preferredStores: string[]
  dietaryRestrictions: string[]
  status: 'active' | 'completed' | 'archived'
  startDate: Timestamp
  endDate: Timestamp
  days: Array<{
    day: number
    date: Timestamp
    meals: {
      breakfast: Meal
      lunch: Meal
      dinner: Meal
    }
  }>
  shoppingList: {
    byStore: Map<string, StoreGroup>
    byAisle: Map<string, ShoppingItem[]>
  }
  metadata: {
    dealsFound: number
    dealsUsed: number
    stores: string[]
    savingsPercent: number
  }
  source: 'ios' | 'web'
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### **4. Shopping Lists**
```typescript
// Firestore: /users/{userId}/shoppingLists/{listId}
{
  listId: string
  mealPlanId?: string  // Optional link to meal plan
  name: string
  status: 'active' | 'completed'
  totalCost: number
  items: Array<{
    itemId: string
    item: string
    amount: string
    price: number
    store: string
    aisle: string
    section: string
    isPurchased: boolean
    purchasedAt?: Timestamp
    actualPrice?: number  // If different from estimated
  }>
  store: string
  zipCode: string
  createdAt: Timestamp
  updatedAt: Timestamp
  completedAt?: Timestamp
}
```

### **5. Budget Tracker**
```typescript
// Firestore: /users/{userId}/budgets/{budgetId}
{
  budgetId: string
  month: string  // "2024-12"
  budgetAmount: number
  spentAmount: number
  remainingAmount: number
  purchases: Array<{
    purchaseId: string
    store: string
    amount: number
    items: number
    date: Timestamp
    shoppingListId?: string
  }>
  categories: Map<string, {
    budgeted: number
    spent: number
  }>
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

## 🔌 **Server API Endpoints**

### **Base URL:** `https://your-domain.com/api`

---

### **1. User Sync Endpoints**

#### **GET /sync/user**
Get current user data and last sync timestamp
```typescript
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}

Response: {
  success: true,
  user: {
    userId: string,
    email: string,
    displayName: string,
    subscription: string,
    preferences: {...},
    lastSyncedAt: timestamp
  }
}
```

#### **PUT /sync/user/preferences**
Update user preferences
```typescript
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}

Body: {
  zipCode?: string,
  preferredStores?: string[],
  dietaryRestrictions?: string[],
  defaultServings?: number,
  defaultBudget?: number
}

Response: {
  success: true,
  user: {...},
  updatedAt: timestamp
}
```

---

### **2. Recipe Sync Endpoints**

#### **GET /sync/recipes?since={timestamp}**
Get all recipes updated since last sync
```typescript
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}

Query Params:
  since: ISO timestamp (optional)
  limit: number (default 100)
  offset: number (default 0)

Response: {
  success: true,
  recipes: Recipe[],
  total: number,
  hasMore: boolean,
  lastSyncedAt: timestamp
}
```

#### **POST /sync/recipes**
Create or update recipes (batch)
```typescript
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}

Body: {
  recipes: Array<{
    recipeId?: string,  // If updating
    name: string,
    ingredients: [...],
    instructions: [...],
    // ... other fields
    source: 'ios' | 'web'
  }>
}

Response: {
  success: true,
  created: number,
  updated: number,
  recipes: Recipe[]
}
```

#### **GET /sync/recipes/{recipeId}**
Get specific recipe
```typescript
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}

Response: {
  success: true,
  recipe: Recipe
}
```

#### **PUT /sync/recipes/{recipeId}**
Update specific recipe
```typescript
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}

Body: {
  name?: string,
  isFavorite?: boolean,
  timesCooked?: number,
  // ... any updatable fields
}

Response: {
  success: true,
  recipe: Recipe,
  updatedAt: timestamp
}
```

#### **DELETE /sync/recipes/{recipeId}**
Delete recipe
```typescript
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}

Response: {
  success: true,
  recipeId: string
}
```

---

### **3. Meal Plan Sync Endpoints**

#### **GET /sync/meal-plans?since={timestamp}**
Get all meal plans updated since last sync
```typescript
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}

Query Params:
  since: ISO timestamp (optional)
  status: 'active' | 'completed' | 'archived' (optional)
  limit: number (default 50)

Response: {
  success: true,
  mealPlans: MealPlan[],
  total: number,
  hasMore: boolean,
  lastSyncedAt: timestamp
}
```

#### **POST /sync/meal-plans**
Create or update meal plans
```typescript
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}

Body: {
  mealPlanId?: string,
  name: string,
  days: MealDay[],
  shoppingList: {...},
  // ... other fields
  source: 'ios' | 'web'
}

Response: {
  success: true,
  mealPlan: MealPlan
}
```

#### **PUT /sync/meal-plans/{mealPlanId}/status**
Update meal plan status
```typescript
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}

Body: {
  status: 'active' | 'completed' | 'archived'
}

Response: {
  success: true,
  mealPlan: MealPlan
}
```

---

### **4. Shopping List Sync Endpoints**

#### **GET /sync/shopping-lists?since={timestamp}**
Get all shopping lists
```typescript
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}

Query Params:
  since: ISO timestamp (optional)
  status: 'active' | 'completed' (optional)

Response: {
  success: true,
  shoppingLists: ShoppingList[],
  lastSyncedAt: timestamp
}
```

#### **PUT /sync/shopping-lists/{listId}/items/{itemId}**
Mark item as purchased
```typescript
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}

Body: {
  isPurchased: boolean,
  actualPrice?: number,
  purchasedAt?: timestamp
}

Response: {
  success: true,
  shoppingList: ShoppingList,
  updatedAt: timestamp
}
```

#### **POST /sync/shopping-lists/{listId}/complete**
Mark entire list as completed
```typescript
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}

Body: {
  actualTotal?: number
}

Response: {
  success: true,
  shoppingList: ShoppingList,
  completedAt: timestamp
}
```

---

### **5. Budget Sync Endpoints**

#### **GET /sync/budgets/{month}**
Get budget for specific month
```typescript
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}

Response: {
  success: true,
  budget: Budget
}
```

#### **POST /sync/budgets/{month}/purchases**
Add purchase to budget
```typescript
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}

Body: {
  store: string,
  amount: number,
  items: number,
  date: timestamp,
  shoppingListId?: string
}

Response: {
  success: true,
  budget: Budget,
  purchase: Purchase
}
```

---

## 🔐 **Authentication Flow**

### **1. Initial Setup (iOS)**
```swift
// On first launch or login
let token = KeychainHelper.getToken() ?? ""

// Register device for sync
let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? ""

POST /auth/register-device
Body: {
  deviceId: deviceId,
  deviceType: "ios",
  deviceName: UIDevice.current.name,
  appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"]
}
```

### **2. JWT Token Management**
```swift
// Store JWT securely
KeychainHelper.save(token: jwtToken)

// Refresh token before expiry (every 7 days)
if tokenExpiresInLessThan(days: 1) {
    let newToken = try await refreshToken(oldToken)
    KeychainHelper.save(token: newToken)
}
```

---

## 🔄 **Sync Strategies**

### **Strategy 1: Delta Sync (Recommended)**
Only sync changes since last sync

```swift
class SyncManager: ObservableObject {
    @Published var lastSyncDate: Date?
    @Published var isSyncing = false
    
    func syncAll() async throws {
        isSyncing = true
        defer { isSyncing = false }
        
        let since = lastSyncDate ?? Date.distantPast
        
        // 1. Sync user preferences
        try await syncUserPreferences(since: since)
        
        // 2. Sync recipes
        try await syncRecipes(since: since)
        
        // 3. Sync meal plans
        try await syncMealPlans(since: since)
        
        // 4. Sync shopping lists
        try await syncShoppingLists(since: since)
        
        // 5. Sync budgets
        try await syncBudgets(since: since)
        
        lastSyncDate = Date()
        UserDefaults.standard.set(lastSyncDate, forKey: "lastSyncDate")
    }
    
    func syncRecipes(since: Date) async throws {
        let url = URL(string: "\(baseURL)/sync/recipes?since=\(since.ISO8601Format())")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(RecipeSyncResponse.self, from: data)
        
        // Update local database with server data
        for recipe in response.recipes {
            try await localDB.upsert(recipe: recipe)
        }
        
        // Upload local changes
        let localChanges = try await localDB.getRecipesModifiedSince(since)
        if !localChanges.isEmpty {
            try await uploadRecipes(localChanges)
        }
    }
}
```

### **Strategy 2: Real-Time Sync (Advanced)**
Use Firebase Firestore real-time listeners

```swift
class RealtimeSyncManager: ObservableObject {
    private var listeners: [ListenerRegistration] = []
    
    func startRealtimeSync(userId: String) {
        // Listen to recipes
        let recipesListener = db.collection("users")
            .document(userId)
            .collection("recipes")
            .addSnapshotListener { snapshot, error in
                guard let changes = snapshot?.documentChanges else { return }
                
                for change in changes {
                    switch change.type {
                    case .added:
                        self.handleRecipeAdded(change.document)
                    case .modified:
                        self.handleRecipeModified(change.document)
                    case .removed:
                        self.handleRecipeRemoved(change.document)
                    }
                }
            }
        listeners.append(recipesListener)
        
        // Listen to meal plans
        let mealPlansListener = db.collection("users")
            .document(userId)
            .collection("mealPlans")
            .whereField("status", isEqualTo: "active")
            .addSnapshotListener { /* ... */ }
        listeners.append(mealPlansListener)
    }
    
    func stopRealtimeSync() {
        listeners.forEach { $0.remove() }
        listeners.removeAll()
    }
}
```

---

## 📱 **iOS Implementation**

### **File: `Services/SyncManager.swift`**

```swift
import Foundation
import Firebase

class SyncManager: ObservableObject {
    static let shared = SyncManager()
    
    @Published var isSyncing = false
    @Published var lastSyncDate: Date?
    @Published var syncError: String?
    
    private let baseURL = "https://your-domain.com/api"
    private let db = Firestore.firestore()
    
    private init() {
        // Load last sync date
        if let date = UserDefaults.standard.object(forKey: "lastSyncDate") as? Date {
            lastSyncDate = date
        }
    }
    
    // MARK: - Full Sync
    func performFullSync() async throws {
        guard let token = KeychainHelper.getToken() else {
            throw SyncError.notAuthenticated
        }
        
        isSyncing = true
        defer { isSyncing = false }
        
        do {
            // Sync in order of dependencies
            try await syncUserProfile(token: token)
            try await syncRecipes(token: token)
            try await syncMealPlans(token: token)
            try await syncShoppingLists(token: token)
            try await syncBudgets(token: token)
            
            // Update last sync date
            lastSyncDate = Date()
            UserDefaults.standard.set(lastSyncDate, forKey: "lastSyncDate")
            
            print("✅ Full sync completed successfully")
            
        } catch {
            syncError = error.localizedDescription
            print("❌ Sync failed: \(error)")
            throw error
        }
    }
    
    // MARK: - Sync User Profile
    private func syncUserProfile(token: String) async throws {
        let url = URL(string: "\(baseURL)/sync/user")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(UserSyncResponse.self, from: data)
        
        // Save to local storage
        UserDefaults.standard.set(response.user.zipCode, forKey: "userZipCode")
        UserDefaults.standard.set(response.user.preferredStores, forKey: "preferredStores")
        // ... save other preferences
    }
    
    // MARK: - Sync Recipes
    private func syncRecipes(token: String) async throws {
        let since = lastSyncDate?.ISO8601Format() ?? ""
        let url = URL(string: "\(baseURL)/sync/recipes?since=\(since)")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(RecipeSyncResponse.self, from: data)
        
        // Save recipes to Core Data or local storage
        for recipe in response.recipes {
            try await LocalStorage.shared.saveRecipe(recipe)
        }
        
        print("✅ Synced \(response.recipes.count) recipes")
    }
    
    // MARK: - Upload Recipe
    func uploadRecipe(_ recipe: Recipe, token: String) async throws {
        let url = URL(string: "\(baseURL)/sync/recipes")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["recipes": [recipe]]
        request.httpBody = try JSONEncoder().encode(body)
        
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(RecipeUploadResponse.self, from: data)
        
        print("✅ Uploaded recipe: \(recipe.name)")
    }
    
    // MARK: - Sync Meal Plans
    private func syncMealPlans(token: String) async throws {
        let since = lastSyncDate?.ISO8601Format() ?? ""
        let url = URL(string: "\(baseURL)/sync/meal-plans?since=\(since)")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(MealPlanSyncResponse.self, from: data)
        
        for mealPlan in response.mealPlans {
            try await LocalStorage.shared.saveMealPlan(mealPlan)
        }
        
        print("✅ Synced \(response.mealPlans.count) meal plans")
    }
    
    // MARK: - Update Shopping List Item
    func markItemPurchased(
        listId: String,
        itemId: String,
        isPurchased: Bool,
        actualPrice: Double?,
        token: String
    ) async throws {
        let url = URL(string: "\(baseURL)/sync/shopping-lists/\(listId)/items/\(itemId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "isPurchased": isPurchased,
            "actualPrice": actualPrice as Any,
            "purchasedAt": ISO8601DateFormatter().string(from: Date())
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(ShoppingListUpdateResponse.self, from: data)
        
        // Update local storage
        try await LocalStorage.shared.updateShoppingList(response.shoppingList)
        
        print("✅ Updated shopping list item")
    }
}

// MARK: - Sync Errors
enum SyncError: Error {
    case notAuthenticated
    case networkError
    case serverError
    case dataCorrupted
}

// MARK: - Response Models
struct UserSyncResponse: Codable {
    let success: Bool
    let user: User
}

struct RecipeSyncResponse: Codable {
    let success: Bool
    let recipes: [Recipe]
    let total: Int
    let hasMore: Bool
    let lastSyncedAt: String
}

struct MealPlanSyncResponse: Codable {
    let success: Bool
    let mealPlans: [MealPlan]
    let total: Int
    let hasMore: Bool
    let lastSyncedAt: String
}
```

---

## 💻 **Web Implementation**

### **File: `lib/sync.ts`**

```typescript
import { db } from '@/lib/firebase'
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore'

class SyncService {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  // Sync recipes from Firestore
  async syncRecipes(since?: Date): Promise<Recipe[]> {
    const recipesRef = collection(db, `users/${this.userId}/recipes`)
    
    let q = query(recipesRef, orderBy('updatedAt', 'desc'))
    
    if (since) {
      q = query(q, where('updatedAt', '>', Timestamp.fromDate(since)))
    }
    
    const snapshot = await getDocs(q)
    const recipes = snapshot.docs.map(doc => ({
      recipeId: doc.id,
      ...doc.data()
    })) as Recipe[]
    
    // Save to local storage for offline access
    localStorage.setItem('cachedRecipes', JSON.stringify(recipes))
    
    return recipes
  }

  // Real-time listener for recipes
  startRealtimeSync() {
    const recipesRef = collection(db, `users/${this.userId}/recipes`)
    
    return onSnapshot(recipesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          console.log('New recipe:', change.doc.data())
          // Update UI
        }
        if (change.type === 'modified') {
          console.log('Modified recipe:', change.doc.data())
          // Update UI
        }
        if (change.type === 'removed') {
          console.log('Removed recipe:', change.doc.id)
          // Update UI
        }
      })
    })
  }
}

export default SyncService
```

---

## 🔔 **Conflict Resolution**

### **Last-Write-Wins Strategy**

```typescript
async function resolveConflict(
  serverData: Recipe,
  localData: Recipe
): Promise<Recipe> {
  // Compare timestamps
  if (serverData.updatedAt > localData.updatedAt) {
    // Server is newer
    return serverData
  } else if (localData.updatedAt > serverData.updatedAt) {
    // Local is newer - upload to server
    await uploadToServer(localData)
    return localData
  } else {
    // Same timestamp - merge changes
    return {
      ...serverData,
      ...localData,
      updatedAt: new Date()
    }
  }
}
```

---

## 🧪 **Testing Sync**

### **Test Scenarios:**

1. **Create recipe on iOS → See on web**
```swift
// iOS
let recipe = Recipe(name: "Test Recipe", ...)
try await SyncManager.shared.uploadRecipe(recipe, token: token)

// Web (after refresh)
const recipes = await SyncService.syncRecipes()
// Should include "Test Recipe"
```

2. **Create meal plan on web → See on iOS**
```typescript
// Web
await createMealPlan({...})

// iOS
try await SyncManager.shared.performFullSync()
// Should download new meal plan
```

3. **Check off shopping item on iOS → Update on web**
```swift
// iOS
try await SyncManager.shared.markItemPurchased(
  listId: "list123",
  itemId: "item456",
  isPurchased: true,
  actualPrice: 3.99,
  token: token
)

// Web (real-time)
// Item automatically marked as purchased
```

---

## 🚀 **Quick Start**

### **1. iOS Setup:**
```swift
// In your App initialization
@main
struct SavryApp: App {
    init() {
        // Configure Firebase
        FirebaseApp.configure()
        
        // Start periodic sync (every 15 minutes)
        Timer.scheduledTimer(withTimeInterval: 900, repeats: true) { _ in
            Task {
                try? await SyncManager.shared.performFullSync()
            }
        }
    }
}
```

### **2. Web Setup:**
```typescript
// In your _app.tsx or layout
useEffect(() => {
  if (user) {
    const syncService = new SyncService(user.uid)
    
    // Start real-time sync
    const unsubscribe = syncService.startRealtimeSync()
    
    return () => unsubscribe()
  }
}, [user])
```

---

## 📊 **Sync Status Dashboard**

Add to both iOS and Web:

```swift
struct SyncStatusView: View {
    @ObservedObject var syncManager = SyncManager.shared
    
    var body: some View {
        VStack {
            if syncManager.isSyncing {
                ProgressView("Syncing...")
            }
            
            if let lastSync = syncManager.lastSyncDate {
                Text("Last synced: \(lastSync.formatted())")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Button("Sync Now") {
                Task {
                    try? await syncManager.performFullSync()
                }
            }
        }
    }
}
```

---

## ✅ **Summary**

Your sync system provides:

✅ **Seamless Experience**
- Save on one device, access everywhere
- Real-time updates across platforms
- Offline support with sync when online

✅ **Robust Architecture**
- Firebase for reliable cloud storage
- JWT authentication for security
- Conflict resolution for data integrity
- Delta sync for efficiency

✅ **Complete Features**
- Recipes sync
- Meal plans sync
- Shopping lists sync
- Budgets sync
- User preferences sync

**Users can now work on any device and their data follows them!** 🎉

---

## 📚 **API Documentation Summary**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/sync/user` | GET | Get user data |
| `/sync/user/preferences` | PUT | Update preferences |
| `/sync/recipes` | GET | Fetch recipes |
| `/sync/recipes` | POST | Upload recipes |
| `/sync/recipes/{id}` | PUT | Update recipe |
| `/sync/meal-plans` | GET | Fetch meal plans |
| `/sync/meal-plans` | POST | Upload meal plan |
| `/sync/shopping-lists` | GET | Fetch lists |
| `/sync/shopping-lists/{id}/items/{itemId}` | PUT | Update item |
| `/sync/budgets/{month}` | GET | Fetch budget |

**All endpoints require JWT authentication!** 🔐




