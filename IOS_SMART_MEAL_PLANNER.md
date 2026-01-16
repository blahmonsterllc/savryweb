# 🎯 Smart Meal Planner - iOS Integration Guide

## Overview

This guide shows you how to integrate the Smart Meal Planner feature into your Savry iOS app. This feature:

1. ✅ Finds grocery deals from user's local stores
2. ✅ Uses ChatGPT to create meal plans based on those deals
3. ✅ Shows exact aisle locations for efficient shopping

---

## 🚀 API Endpoint

### **POST** `/api/app/meal-plans/smart-generate`

This is your all-in-one endpoint that does everything:
- Finds current deals in user's area
- Creates optimized meal plan with ChatGPT
- Returns shopping list with aisle locations

---

## 📋 Request Format

```json
{
  "days": 5,
  "budget": 100.00,
  "servings": 4,
  "dietaryRestrictions": ["vegetarian", "gluten-free"],
  "preferredStores": ["Kroger", "Walmart"],
  "zipCode": "78701"
}
```

### Parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `days` | Int | Yes | Number of days (1-7) |
| `budget` | Double | No | Total budget in dollars |
| `servings` | Int | Yes | Number of people |
| `dietaryRestrictions` | [String] | No | e.g., ["vegetarian", "vegan", "gluten-free"] |
| `preferredStores` | [String] | Yes | e.g., ["Kroger", "Walmart"] |
| `zipCode` | String | Yes | User's ZIP code |

---

## 📤 Response Format

```json
{
  "success": true,
  "mealPlanId": "abc123",
  "mealPlan": {
    "name": "Budget-Friendly Week",
    "totalCost": 95.50,
    "estimatedSavings": 45.00,
    "days": [
      {
        "day": 1,
        "meals": {
          "breakfast": {
            "name": "Scrambled Eggs & Toast",
            "ingredients": [
              {
                "item": "Eggs",
                "amount": "6 eggs",
                "store": "Kroger",
                "price": 3.99,
                "aisle": "Aisle 12",
                "section": "Dairy"
              }
            ],
            "instructions": "1. Beat eggs...",
            "estimatedCost": 6.48
          },
          "lunch": { /* ... */ },
          "dinner": { /* ... */ }
        }
      }
    ]
  },
  "shoppingList": {
    "byAisle": {
      "Produce - Aisle 1": [
        {
          "item": "Lettuce",
          "amount": "1 head",
          "price": 1.99,
          "aisle": "Aisle 1",
          "section": "Produce",
          "store": "Kroger"
        }
      ],
      "Dairy - Aisle 12": [ /* ... */ ]
    },
    "byStore": {
      "Kroger": {
        "items": [ /* ... */ ],
        "total": 45.50
      },
      "Walmart": {
        "items": [ /* ... */ ],
        "total": 50.00
      }
    }
  },
  "metadata": {
    "dealsFound": 42,
    "dealsUsed": 28,
    "stores": ["Kroger", "Walmart"],
    "budget": 100.00,
    "totalCost": 95.50,
    "savings": 45.00,
    "savingsPercent": 32
  }
}
```

---

## 📱 Swift Implementation

### 1. Data Models

Create `SmartMealPlan.swift`:

```swift
import Foundation

// MARK: - Request
struct SmartMealPlanRequest: Codable {
    let days: Int
    let budget: Double?
    let servings: Int
    let dietaryRestrictions: [String]
    let preferredStores: [String]
    let zipCode: String
}

// MARK: - Response
struct SmartMealPlanResponse: Codable {
    let success: Bool
    let mealPlanId: String
    let mealPlan: MealPlan
    let shoppingList: ShoppingList
    let metadata: MealPlanMetadata
}

struct MealPlan: Codable {
    let name: String
    let totalCost: Double
    let estimatedSavings: Double
    let days: [DayPlan]
}

struct DayPlan: Codable, Identifiable {
    var id: Int { day }
    let day: Int
    let meals: Meals
}

struct Meals: Codable {
    let breakfast: Meal?
    let lunch: Meal?
    let dinner: Meal?
    let snack: Meal?
}

struct Meal: Codable, Identifiable {
    var id: String { name }
    let name: String
    let ingredients: [MealIngredient]
    let instructions: String
    let estimatedCost: Double
}

struct MealIngredient: Codable, Identifiable {
    var id: String { item }
    let item: String
    let amount: String
    let store: String
    let price: Double
    let aisle: String
    let section: String
}

// MARK: - Shopping List
struct ShoppingList: Codable {
    let byAisle: [String: [ShoppingItem]]
    let byStore: [String: StoreItems]
}

struct StoreItems: Codable {
    let items: [ShoppingItem]
    let total: Double
}

struct ShoppingItem: Codable, Identifiable {
    var id: String { item }
    let item: String
    let amount: String
    let price: Double
    let aisle: String
    let section: String
    let store: String?
}

// MARK: - Metadata
struct MealPlanMetadata: Codable {
    let dealsFound: Int
    let dealsUsed: Int
    let stores: [String]
    let budget: Double
    let totalCost: Double
    let savings: Double
    let savingsPercent: Int
}
```

---

### 2. API Service

Create `SmartMealPlanService.swift`:

```swift
import Foundation

class SmartMealPlanService: ObservableObject {
    private let baseURL = "https://your-domain.com" // or http://localhost:3000 for dev
    
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var currentMealPlan: SmartMealPlanResponse?
    
    func generateSmartMealPlan(
        days: Int,
        budget: Double?,
        servings: Int,
        dietaryRestrictions: [String],
        preferredStores: [String],
        zipCode: String
    ) async throws -> SmartMealPlanResponse {
        
        DispatchQueue.main.async {
            self.isLoading = true
            self.errorMessage = nil
        }
        
        defer {
            DispatchQueue.main.async {
                self.isLoading = false
            }
        }
        
        guard let url = URL(string: "\(baseURL)/api/meal-plans/smart-generate") else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add auth token
        if let token = KeychainHelper.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let requestBody = SmartMealPlanRequest(
            days: days,
            budget: budget,
            servings: servings,
            dietaryRestrictions: dietaryRestrictions,
            preferredStores: preferredStores,
            zipCode: zipCode
        )
        
        request.httpBody = try JSONEncoder().encode(requestBody)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        // Handle errors
        if httpResponse.statusCode != 200 {
            let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data)
            
            if httpResponse.statusCode == 403 && errorResponse?.upgrade == true {
                throw APIError.upgradeRequired(errorResponse?.message ?? "Pro feature")
            }
            
            throw APIError.serverError(errorResponse?.message ?? "Unknown error")
        }
        
        let mealPlanResponse = try JSONDecoder().decode(SmartMealPlanResponse.self, from: data)
        
        DispatchQueue.main.async {
            self.currentMealPlan = mealPlanResponse
        }
        
        return mealPlanResponse
    }
}

// MARK: - Error Types
enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case upgradeRequired(String)
    case serverError(String)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid server response"
        case .upgradeRequired(let message):
            return message
        case .serverError(let message):
            return message
        }
    }
}

struct ErrorResponse: Codable {
    let message: String
    let upgrade: Bool?
}
```

---

### 3. SwiftUI Views

#### Main Meal Plan Generator View

Create `SmartMealPlanView.swift`:

```swift
import SwiftUI

struct SmartMealPlanView: View {
    @StateObject private var service = SmartMealPlanService()
    @State private var days = 5
    @State private var budget: Double = 100
    @State private var servings = 4
    @State private var zipCode = ""
    @State private var selectedDietaryRestrictions: Set<String> = []
    @State private var selectedStores: Set<String> = []
    @State private var showingResults = false
    
    let dietaryOptions = ["Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Keto", "Paleo"]
    let storeOptions = ["Kroger", "Walmart", "Target", "Safeway", "Publix", "Wegmans"]
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 48))
                            .foregroundColor(.green)
                        
                        Text("Smart Meal Planner")
                            .font(.system(size: 32, weight: .bold))
                        
                        Text("Find deals, create meals, save time!")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.top, 20)
                    
                    // Form
                    VStack(spacing: 20) {
                        // ZIP Code
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Your ZIP Code")
                                .font(.headline)
                            TextField("e.g. 78701", text: $zipCode)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                                .keyboardType(.numberPad)
                        }
                        
                        // Days
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Number of Days: \(days)")
                                .font(.headline)
                            Slider(value: Binding(
                                get: { Double(days) },
                                set: { days = Int($0) }
                            ), in: 1...7, step: 1)
                            HStack {
                                Text("1 day")
                                    .font(.caption)
                                Spacer()
                                Text("7 days")
                                    .font(.caption)
                            }
                            .foregroundColor(.secondary)
                        }
                        
                        // Budget
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Budget: $\(Int(budget))")
                                .font(.headline)
                            Slider(value: $budget, in: 50...300, step: 10)
                            HStack {
                                Text("$50")
                                    .font(.caption)
                                Spacer()
                                Text("$300")
                                    .font(.caption)
                            }
                            .foregroundColor(.secondary)
                        }
                        
                        // Servings
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Servings: \(servings)")
                                .font(.headline)
                            Stepper("", value: $servings, in: 1...8)
                        }
                        
                        // Dietary Restrictions
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Dietary Restrictions")
                                .font(.headline)
                            FlowLayout(spacing: 8) {
                                ForEach(dietaryOptions, id: \.self) { option in
                                    Button(action: {
                                        if selectedDietaryRestrictions.contains(option) {
                                            selectedDietaryRestrictions.remove(option)
                                        } else {
                                            selectedDietaryRestrictions.insert(option)
                                        }
                                    }) {
                                        Text(option)
                                            .padding(.horizontal, 16)
                                            .padding(.vertical, 8)
                                            .background(
                                                selectedDietaryRestrictions.contains(option) ?
                                                Color.green : Color.gray.opacity(0.2)
                                            )
                                            .foregroundColor(
                                                selectedDietaryRestrictions.contains(option) ?
                                                .white : .primary
                                            )
                                            .cornerRadius(20)
                                    }
                                }
                            }
                        }
                        
                        // Preferred Stores
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Where do you shop?")
                                .font(.headline)
                            FlowLayout(spacing: 8) {
                                ForEach(storeOptions, id: \.self) { store in
                                    Button(action: {
                                        if selectedStores.contains(store) {
                                            selectedStores.remove(store)
                                        } else {
                                            selectedStores.insert(store)
                                        }
                                    }) {
                                        Text(store)
                                            .padding(.horizontal, 16)
                                            .padding(.vertical, 8)
                                            .background(
                                                selectedStores.contains(store) ?
                                                Color.blue : Color.gray.opacity(0.2)
                                            )
                                            .foregroundColor(
                                                selectedStores.contains(store) ?
                                                .white : .primary
                                            )
                                            .cornerRadius(20)
                                    }
                                }
                            }
                        }
                        
                        // Generate Button
                        Button(action: generateMealPlan) {
                            HStack {
                                if service.isLoading {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Image(systemName: "sparkles")
                                    Text("Generate Smart Meal Plan")
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.green)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                            .font(.headline)
                        }
                        .disabled(service.isLoading || zipCode.isEmpty || selectedStores.isEmpty)
                        
                        if let error = service.errorMessage {
                            Text(error)
                                .foregroundColor(.red)
                                .font(.caption)
                        }
                    }
                    .padding()
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showingResults) {
                if let mealPlan = service.currentMealPlan {
                    MealPlanResultView(mealPlan: mealPlan)
                }
            }
        }
    }
    
    private func generateMealPlan() {
        Task {
            do {
                _ = try await service.generateSmartMealPlan(
                    days: days,
                    budget: budget,
                    servings: servings,
                    dietaryRestrictions: Array(selectedDietaryRestrictions),
                    preferredStores: Array(selectedStores),
                    zipCode: zipCode
                )
                showingResults = true
            } catch {
                service.errorMessage = error.localizedDescription
            }
        }
    }
}

// Helper for wrapping buttons
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        // Implementation
        return .zero
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        // Implementation
    }
}
```

---

#### Results View with Aisle Navigator

Create `MealPlanResultView.swift`:

```swift
import SwiftUI

struct MealPlanResultView: View {
    let mealPlan: SmartMealPlanResponse
    @State private var viewMode: ViewMode = .byAisle
    @State private var checkedItems: Set<String> = []
    
    enum ViewMode {
        case byAisle, byStore
    }
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Success Banner
                    VStack(spacing: 12) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 60))
                            .foregroundColor(.green)
                        
                        Text("Your Meal Plan is Ready!")
                            .font(.title)
                            .fontWeight(.bold)
                        
                        Text("\(mealPlan.metadata.dealsFound) deals found • \(mealPlan.metadata.dealsUsed) used")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        
                        HStack(spacing: 40) {
                            VStack {
                                Text("$\(String(format: "%.2f", mealPlan.mealPlan.totalCost))")
                                    .font(.title)
                                    .fontWeight(.bold)
                                Text("Total Cost")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            
                            VStack {
                                Text("$\(String(format: "%.2f", mealPlan.metadata.savings))")
                                    .font(.title)
                                    .fontWeight(.bold)
                                    .foregroundColor(.green)
                                Text("Saved (\(mealPlan.metadata.savingsPercent)%)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(
                        LinearGradient(
                            colors: [Color.green.opacity(0.1), Color.green.opacity(0.05)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .cornerRadius(16)
                    .padding()
                    
                    // Meal Plan Overview
                    VStack(alignment: .leading, spacing: 16) {
                        Text("📅 \(mealPlan.mealPlan.name)")
                            .font(.title2)
                            .fontWeight(.bold)
                            .padding(.horizontal)
                        
                        ForEach(mealPlan.mealPlan.days) { day in
                            DayPlanCard(day: day)
                        }
                    }
                    
                    Divider()
                        .padding(.vertical)
                    
                    // Shopping List Header
                    HStack {
                        Text("🛒 Shopping List")
                            .font(.title2)
                            .fontWeight(.bold)
                        
                        Spacer()
                        
                        // View Toggle
                        Picker("View", selection: $viewMode) {
                            Text("By Aisle").tag(ViewMode.byAisle)
                            Text("By Store").tag(ViewMode.byStore)
                        }
                        .pickerStyle(SegmentedPickerStyle())
                        .frame(width: 200)
                    }
                    .padding(.horizontal)
                    
                    // Shopping List
                    if viewMode == .byAisle {
                        AisleShoppingListView(
                            shoppingList: mealPlan.shoppingList,
                            checkedItems: $checkedItems
                        )
                    } else {
                        StoreShoppingListView(
                            shoppingList: mealPlan.shoppingList,
                            checkedItems: $checkedItems
                        )
                    }
                }
            }
            .navigationTitle("Meal Plan")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Day Plan Card
struct DayPlanCard: View {
    let day: DayPlan
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Day \(day.day)")
                .font(.headline)
                .foregroundColor(.green)
            
            if let breakfast = day.meals.breakfast {
                MealCard(title: "Breakfast", meal: breakfast)
            }
            if let lunch = day.meals.lunch {
                MealCard(title: "Lunch", meal: lunch)
            }
            if let dinner = day.meals.dinner {
                MealCard(title: "Dinner", meal: dinner)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
        .padding(.horizontal)
    }
}

struct MealCard: View {
    let title: String
    let meal: Meal
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text(meal.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
            }
            Spacer()
            Text("$\(String(format: "%.2f", meal.estimatedCost))")
                .font(.subheadline)
                .fontWeight(.bold)
                .foregroundColor(.green)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Aisle Shopping List
struct AisleShoppingListView: View {
    let shoppingList: ShoppingList
    @Binding var checkedItems: Set<String>
    
    var sortedAisles: [(String, [ShoppingItem])] {
        shoppingList.byAisle.sorted { a, b in
            // Extract aisle number for sorting
            let aNum = Int(a.key.components(separatedBy: " ").last?.filter(\.isNumber) ?? "999") ?? 999
            let bNum = Int(b.key.components(separatedBy: " ").last?.filter(\.isNumber) ?? "999") ?? 999
            return aNum < bNum
        }
    }
    
    var body: some View {
        VStack(spacing: 16) {
            ForEach(sortedAisles, id: \.0) { aisle, items in
                AisleSection(
                    aisleName: aisle,
                    items: items,
                    checkedItems: $checkedItems
                )
            }
        }
        .padding()
    }
}

struct AisleSection: View {
    let aisleName: String
    let items: [ShoppingItem]
    @Binding var checkedItems: Set<String>
    
    var allChecked: Bool {
        items.allSatisfy { checkedItems.contains($0.item) }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Aisle Header
            HStack {
                HStack(spacing: 12) {
                    Text(aisleName.components(separatedBy: " - ").last ?? "")
                        .font(.headline)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.green)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                    
                    VStack(alignment: .leading) {
                        Text(aisleName.components(separatedBy: " - ").first ?? "")
                            .font(.headline)
                        Text("\(items.count) items • $\(String(format: "%.2f", items.map(\.price).reduce(0, +)))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                Spacer()
                
                if allChecked {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                        .font(.title3)
                }
            }
            .padding()
            .background(Color.gray.opacity(0.05))
            .cornerRadius(12)
            
            // Items
            ForEach(items) { item in
                ShoppingItemRow(
                    item: item,
                    isChecked: checkedItems.contains(item.item)
                ) {
                    if checkedItems.contains(item.item) {
                        checkedItems.remove(item.item)
                    } else {
                        checkedItems.insert(item.item)
                    }
                }
            }
        }
    }
}

struct ShoppingItemRow: View {
    let item: ShoppingItem
    let isChecked: Bool
    let onToggle: () -> Void
    
    var body: some View {
        Button(action: onToggle) {
            HStack(spacing: 12) {
                Image(systemName: isChecked ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isChecked ? .green : .gray)
                    .font(.title3)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.item)
                        .font(.subheadline)
                        .foregroundColor(isChecked ? .secondary : .primary)
                        .strikethrough(isChecked)
                    Text("\(item.amount) • \(item.store ?? "")")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Text("$\(String(format: "%.2f", item.price))")
                    .font(.subheadline)
                    .fontWeight(.bold)
                    .foregroundColor(isChecked ? .secondary : .green)
            }
            .padding()
            .background(isChecked ? Color.green.opacity(0.05) : Color.clear)
            .cornerRadius(8)
        }
    }
}

// MARK: - Store Shopping List
struct StoreShoppingListView: View {
    let shoppingList: ShoppingList
    @Binding var checkedItems: Set<String>
    
    var body: some View {
        VStack(spacing: 16) {
            ForEach(Array(shoppingList.byStore.keys).sorted(), id: \.self) { storeName in
                if let storeData = shoppingList.byStore[storeName] {
                    StoreSection(
                        storeName: storeName,
                        storeData: storeData,
                        checkedItems: $checkedItems
                    )
                }
            }
        }
        .padding()
    }
}

struct StoreSection: View {
    let storeName: String
    let storeData: StoreItems
    @Binding var checkedItems: Set<String>
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Store Header
            HStack {
                Image(systemName: "cart.fill")
                    .foregroundColor(.blue)
                VStack(alignment: .leading) {
                    Text(storeName)
                        .font(.headline)
                    Text("\(storeData.items.count) items")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text("$\(String(format: "%.2f", storeData.total))")
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(.blue)
            }
            .padding()
            .background(Color.blue.opacity(0.05))
            .cornerRadius(12)
            
            // Items
            ForEach(storeData.items) { item in
                ShoppingItemRow(
                    item: item,
                    isChecked: checkedItems.contains(item.item)
                ) {
                    if checkedItems.contains(item.item) {
                        checkedItems.remove(item.item)
                    } else {
                        checkedItems.insert(item.item)
                    }
                }
            }
        }
    }
}
```

---

## 🔧 Setup Instructions

### 1. Add Files to Your iOS Project

1. Create a new group called `SmartMealPlanner`
2. Add all the Swift files above:
   - `SmartMealPlan.swift` (models)
   - `SmartMealPlanService.swift` (API client)
   - `SmartMealPlanView.swift` (input form)
   - `MealPlanResultView.swift` (results + shopping list)

### 2. Update Your Navigation

Add to your main navigation:

```swift
NavigationLink(destination: SmartMealPlanView()) {
    Label("Smart Meal Plan", systemImage: "sparkles")
}
```

### 3. Test the Flow

1. Run your iOS app
2. Navigate to Smart Meal Plan
3. Fill in preferences
4. Tap "Generate Smart Meal Plan"
5. Wait 10-20 seconds
6. See results with shopping list!

---

## 🎬 User Flow

```
1. User opens Smart Meal Plan screen
   ↓
2. Enters preferences:
   • ZIP: 78701
   • Days: 5
   • Budget: $100
   • Stores: Kroger, Walmart
   ↓
3. Taps "Generate"
   ↓
4. App calls API (shows loading)
   ↓
5. API finds 42 deals, ChatGPT creates plan
   ↓
6. Results screen shows:
   • 5-day meal plan
   • Shopping list by aisle
   • Total: $95.50
   • Saved: $45 (32%)
   ↓
7. User shops using aisle navigation
   • Checks off items
   • Follows aisle order
   • Saves time!
```

---

## 💡 Pro Tips

### Caching
Cache the meal plan locally so users can view it offline:

```swift
// Save to UserDefaults or Core Data
UserDefaults.standard.set(
    try? JSONEncoder().encode(mealPlan),
    forKey: "currentMealPlan"
)
```

### Location Services
Auto-fill ZIP code from location:

```swift
import CoreLocation

func getZipCode(from location: CLLocation) async -> String? {
    let geocoder = CLGeocoder()
    let placemarks = try? await geocoder.reverseGeocodeLocation(location)
    return placemarks?.first?.postalCode
}
```

### Store Persistence
Remember user's preferred stores:

```swift
@AppStorage("preferredStores") var preferredStores: [String] = []
```

### Push Notifications
Notify when new deals arrive:

```swift
// Server sends push when scraping finishes
"New deals at Kroger! Generate a meal plan to save $40 this week!"
```

---

## 🎨 UI Customization

### Brand Colors
```swift
// Update colors to match your brand
Color.green → Color("SavryGreen")
Color.blue → Color("SavryBlue")
```

### Custom Fonts
```swift
.font(.custom("YourFont-Bold", size: 18))
```

### Animations
```swift
.animation(.spring(), value: isChecked)
```

---

## 🐛 Error Handling

### Common Issues

**"No deals found"**
```swift
if mealPlan.metadata.dealsFound == 0 {
    // Show message to user
    Alert(
        title: Text("No Deals Available"),
        message: Text("We couldn't find deals in your area. Try a different ZIP code."),
        dismissButton: .default(Text("OK"))
    )
}
```

**"Pro Feature Required"**
```swift
catch APIError.upgradeRequired(let message) {
    // Show upgrade prompt
    showUpgradeSheet = true
}
```

**Network Error**
```swift
catch {
    // Show retry option
    errorMessage = "Network error. Please try again."
}
```

---

## 📊 Analytics

Track key events:

```swift
// When user generates plan
Analytics.logEvent("smart_meal_plan_generated", parameters: [
    "days": days,
    "budget": budget,
    "stores_count": selectedStores.count
])

// When user saves money
Analytics.logEvent("savings_achieved", parameters: [
    "amount": mealPlan.metadata.savings,
    "percent": mealPlan.metadata.savingsPercent
])

// When user checks off item
Analytics.logEvent("shopping_item_checked", parameters: [
    "item": item.item,
    "aisle": item.aisle
])
```

---

## 🚀 Launch Checklist

- [ ] Add API endpoint to server
- [ ] Test with sample data
- [ ] Add Swift models to iOS project
- [ ] Implement API service
- [ ] Create UI views
- [ ] Test end-to-end flow
- [ ] Add error handling
- [ ] Implement caching
- [ ] Add analytics
- [ ] Test on real devices
- [ ] Submit to App Store

---

## 🎉 Result

Your iOS app now has:

✅ Smart meal plan generation
✅ Deal-based meal creation
✅ Aisle-by-aisle shopping navigation
✅ Progress tracking
✅ Two view modes (by aisle / by store)
✅ Real-time savings calculator

**Users will love this!** 💚

---

## 📱 Screenshots You'll Get

<img width="375" alt="Smart Meal Plan Input" src="...">
<img width="375" alt="Meal Plan Results" src="...">
<img width="375" alt="Shopping List Aisle View" src="...">
<img width="375" alt="Shopping List Store View" src="...">

---

## 🔗 Related Docs

- Main iOS Integration: `IOS_INTEGRATION.md`
- Web Implementation: `SMART_MEAL_PLANNER_GUIDE.md`
- Quick Start: `DREAM_APP_QUICKSTART.md`

---

**Ready to integrate? Start with the API endpoint and test from your iOS app!** 🚀




