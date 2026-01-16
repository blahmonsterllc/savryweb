# 🍳 Smart AI Recipe Generator - iOS Integration

## Overview

This is a companion feature to the Smart Meal Planner. Both features:
- ✅ Keep ChatGPT API on the **server-side** (secure!)
- ✅ Use grocery deals to save money
- ✅ Show aisle locations for shopping
- ✅ Work with your existing iOS authentication

**Difference:**
- **Smart Meal Planner**: Creates multiple days of meals
- **Smart Recipe Generator**: Creates a single recipe (perfect for "what's for dinner tonight?")

---

## 🚀 API Endpoint

### **POST** `/api/app/recipes/smart-generate`

Server-side recipe generation with deal integration.

---

## 📋 Request Format

```json
{
  // Option 1: Use specific ingredients you have
  "ingredients": ["chicken", "broccoli", "rice"],
  "useDealIngredients": false,
  
  // Option 2: Let AI suggest based on deals
  "useDealIngredients": true,
  "preferredStores": ["Kroger", "Walmart"],
  "zipCode": "78701",
  
  // Recipe preferences
  "cuisine": "Italian",
  "mealType": "dinner",
  "dietaryRestrictions": ["gluten-free"],
  "cookingTime": 30,
  "servings": 4,
  "difficulty": "easy",
  "budget": 15.00
}
```

### Parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ingredients` | [String] | No | Specific ingredients to use |
| `useDealIngredients` | Bool | No | Use ingredients on sale (default: true) |
| `preferredStores` | [String] | If using deals | e.g., ["Kroger", "Walmart"] |
| `zipCode` | String | If using deals | User's ZIP code |
| `cuisine` | String | No | e.g., "Italian", "Asian", "Mexican" |
| `mealType` | String | No | breakfast, lunch, dinner, snack, dessert |
| `dietaryRestrictions` | [String] | No | e.g., ["vegetarian", "gluten-free"] |
| `cookingTime` | Int | No | Max cooking time in minutes |
| `servings` | Int | No | Number of people (default: 4) |
| `difficulty` | String | No | easy, medium, hard |
| `budget` | Double | No | Max cost (Pro tier only) |

---

## 📤 Response Format

```json
{
  "success": true,
  "recipeId": "recipe_123",
  "recipe": {
    "name": "Garlic Butter Chicken with Broccoli",
    "description": "A simple and delicious one-pan meal...",
    "servings": 4,
    "prepTime": 15,
    "cookTime": 25,
    "totalTime": 40,
    "difficulty": "easy",
    "cuisine": "American",
    "mealType": "dinner",
    "dietaryTags": ["gluten-free"],
    "ingredients": [
      {
        "item": "Chicken Breast",
        "amount": "1.5 lbs",
        "price": 5.99,
        "store": "Kroger",
        "aisle": "Meat Counter",
        "section": "Meat & Seafood",
        "onSale": true
      },
      {
        "item": "Broccoli",
        "amount": "2 cups",
        "price": 2.49,
        "store": "Kroger",
        "aisle": "Aisle 1",
        "section": "Produce",
        "onSale": true
      }
    ],
    "instructions": [
      "Preheat oven to 400°F",
      "Season chicken with salt and pepper",
      "Heat butter in a large skillet over medium-high heat",
      "Add chicken and cook 5 minutes per side",
      "Add broccoli and garlic, cook 3 more minutes",
      "Transfer to oven and bake 15 minutes"
    ],
    "nutritionInfo": {
      "calories": 320,
      "protein": 38,
      "carbs": 12,
      "fat": 14,
      "fiber": 4
    },
    "estimatedCost": 12.50,
    "estimatedSavings": 4.00,
    "tips": [
      "For extra flavor, marinate chicken for 30 minutes",
      "Substitute broccoli with asparagus if preferred"
    ]
  },
  "shoppingList": [
    {
      "item": "Chicken Breast",
      "amount": "1.5 lbs",
      "price": 5.99,
      "store": "Kroger",
      "aisle": "Meat Counter",
      "section": "Meat & Seafood",
      "onSale": true
    }
  ],
  "metadata": {
    "dealsFound": 15,
    "dealsUsed": 3,
    "stores": ["Kroger"],
    "estimatedCost": 12.50,
    "estimatedSavings": 4.00,
    "savingsPercent": 24
  }
}
```

---

## 📱 Swift Implementation

### 1. Data Models

Create `SmartRecipe.swift`:

```swift
import Foundation

// MARK: - Request
struct SmartRecipeRequest: Codable {
    let ingredients: [String]?
    let useDealIngredients: Bool
    let preferredStores: [String]?
    let zipCode: String?
    let cuisine: String?
    let mealType: String?
    let dietaryRestrictions: [String]
    let cookingTime: Int?
    let servings: Int
    let difficulty: String?
    let budget: Double?
}

// MARK: - Response
struct SmartRecipeResponse: Codable {
    let success: Bool
    let recipeId: String
    let recipe: Recipe
    let shoppingList: [ShoppingItem]
    let metadata: RecipeMetadata
}

struct Recipe: Codable, Identifiable {
    var id: String { name }
    let name: String
    let description: String
    let servings: Int
    let prepTime: Int
    let cookTime: Int
    let totalTime: Int
    let difficulty: String
    let cuisine: String
    let mealType: String
    let dietaryTags: [String]
    let ingredients: [RecipeIngredient]
    let instructions: [String]
    let nutritionInfo: NutritionInfo
    let estimatedCost: Double
    let estimatedSavings: Double
    let tips: [String]
}

struct RecipeIngredient: Codable, Identifiable {
    var id: String { item }
    let item: String
    let amount: String
    let price: Double
    let store: String
    let aisle: String
    let section: String
    let onSale: Bool
}

struct NutritionInfo: Codable {
    let calories: Int
    let protein: Int
    let carbs: Int
    let fat: Int
    let fiber: Int
}

struct ShoppingItem: Codable, Identifiable {
    var id: String { item }
    let item: String
    let amount: String
    let price: Double
    let store: String
    let aisle: String
    let section: String
    let onSale: Bool
}

struct RecipeMetadata: Codable {
    let dealsFound: Int
    let dealsUsed: Int
    let stores: [String]
    let estimatedCost: Double
    let estimatedSavings: Double
    let savingsPercent: Int
}
```

---

### 2. API Service

Create `SmartRecipeService.swift`:

```swift
import Foundation

class SmartRecipeService: ObservableObject {
    private let baseURL = "https://your-domain.com" // or http://localhost:3000
    
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var currentRecipe: SmartRecipeResponse?
    
    /// Generate recipe using specific ingredients
    func generateRecipe(
        ingredients: [String],
        cuisine: String?,
        mealType: String?,
        dietaryRestrictions: [String],
        cookingTime: Int?,
        servings: Int,
        difficulty: String?
    ) async throws -> SmartRecipeResponse {
        
        let request = SmartRecipeRequest(
            ingredients: ingredients,
            useDealIngredients: false,
            preferredStores: nil,
            zipCode: nil,
            cuisine: cuisine,
            mealType: mealType,
            dietaryRestrictions: dietaryRestrictions,
            cookingTime: cookingTime,
            servings: servings,
            difficulty: difficulty,
            budget: nil
        )
        
        return try await callAPI(request: request)
    }
    
    /// Generate recipe using deals from preferred stores
    func generateRecipeWithDeals(
        preferredStores: [String],
        zipCode: String,
        cuisine: String?,
        mealType: String?,
        dietaryRestrictions: [String],
        cookingTime: Int?,
        servings: Int,
        difficulty: String?,
        budget: Double?
    ) async throws -> SmartRecipeResponse {
        
        let request = SmartRecipeRequest(
            ingredients: nil,
            useDealIngredients: true,
            preferredStores: preferredStores,
            zipCode: zipCode,
            cuisine: cuisine,
            mealType: mealType,
            dietaryRestrictions: dietaryRestrictions,
            cookingTime: cookingTime,
            servings: servings,
            difficulty: difficulty,
            budget: budget
        )
        
        return try await callAPI(request: request)
    }
    
    private func callAPI(request: SmartRecipeRequest) async throws -> SmartRecipeResponse {
        DispatchQueue.main.async {
            self.isLoading = true
            self.errorMessage = nil
        }
        
        defer {
            DispatchQueue.main.async {
                self.isLoading = false
            }
        }
        
        guard let url = URL(string: "\(baseURL)/api/app/recipes/smart-generate") else {
            throw APIError.invalidURL
        }
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add auth token
        if let token = KeychainHelper.getToken() {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        urlRequest.httpBody = try JSONEncoder().encode(request)
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
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
        
        let recipeResponse = try JSONDecoder().decode(SmartRecipeResponse.self, from: data)
        
        DispatchQueue.main.async {
            self.currentRecipe = recipeResponse
        }
        
        return recipeResponse
    }
}
```

---

### 3. SwiftUI Views

#### Recipe Generator Input View

Create `SmartRecipeView.swift`:

```swift
import SwiftUI

struct SmartRecipeView: View {
    @StateObject private var service = SmartRecipeService()
    
    @State private var mode: GenerationMode = .withDeals
    @State private var ingredients: [String] = []
    @State private var ingredientInput = ""
    
    // Deals mode
    @State private var zipCode = ""
    @State private var selectedStores: Set<String> = ["Kroger"]
    
    // Preferences
    @State private var cuisine = ""
    @State private var mealType = "dinner"
    @State private var selectedDietaryRestrictions: Set<String> = []
    @State private var cookingTime = 30
    @State private var servings = 4
    @State private var difficulty = "easy"
    
    @State private var showingResults = false
    
    enum GenerationMode {
        case withDeals, withIngredients
    }
    
    let storeOptions = ["Kroger", "Walmart", "Target", "Safeway"]
    let cuisineOptions = ["", "Italian", "Asian", "Mexican", "American", "Mediterranean", "Indian"]
    let mealTypeOptions = ["breakfast", "lunch", "dinner", "snack", "dessert"]
    let difficultyOptions = ["easy", "medium", "hard"]
    let dietaryOptions = ["Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Keto", "Paleo"]
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 48))
                            .foregroundColor(.orange)
                        
                        Text("AI Recipe Generator")
                            .font(.system(size: 32, weight: .bold))
                        
                        Text("Create recipes using deals or your ingredients")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 20)
                    
                    // Mode Picker
                    Picker("Mode", selection: $mode) {
                        Text("Use Deals").tag(GenerationMode.withDeals)
                        Text("My Ingredients").tag(GenerationMode.withIngredients)
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    .padding(.horizontal)
                    
                    // Form
                    VStack(spacing: 20) {
                        if mode == .withDeals {
                            // Deals Mode
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Your ZIP Code")
                                    .font(.headline)
                                TextField("e.g. 78701", text: $zipCode)
                                    .textFieldStyle(RoundedBorderTextFieldStyle())
                                    .keyboardType(.numberPad)
                            }
                            
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Preferred Stores")
                                    .font(.headline)
                                FlowLayout(spacing: 8) {
                                    ForEach(storeOptions, id: \.self) { store in
                                        StoreButton(
                                            store: store,
                                            isSelected: selectedStores.contains(store)
                                        ) {
                                            if selectedStores.contains(store) {
                                                selectedStores.remove(store)
                                            } else {
                                                selectedStores.insert(store)
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            // Ingredients Mode
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Your Ingredients")
                                    .font(.headline)
                                
                                HStack {
                                    TextField("Add ingredient", text: $ingredientInput)
                                        .textFieldStyle(RoundedBorderTextFieldStyle())
                                    
                                    Button(action: addIngredient) {
                                        Image(systemName: "plus.circle.fill")
                                            .font(.title2)
                                            .foregroundColor(.orange)
                                    }
                                    .disabled(ingredientInput.isEmpty)
                                }
                                
                                if !ingredients.isEmpty {
                                    FlowLayout(spacing: 8) {
                                        ForEach(ingredients, id: \.self) { ingredient in
                                            HStack {
                                                Text(ingredient)
                                                Button(action: {
                                                    ingredients.removeAll { $0 == ingredient }
                                                }) {
                                                    Image(systemName: "xmark.circle.fill")
                                                        .foregroundColor(.gray)
                                                }
                                            }
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 6)
                                            .background(Color.orange.opacity(0.2))
                                            .cornerRadius(16)
                                        }
                                    }
                                }
                            }
                        }
                        
                        Divider()
                        
                        // Common preferences
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Meal Type")
                                .font(.headline)
                            Picker("Meal Type", selection: $mealType) {
                                ForEach(mealTypeOptions, id: \.self) { type in
                                    Text(type.capitalized).tag(type)
                                }
                            }
                            .pickerStyle(SegmentedPickerStyle())
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Cuisine (optional)")
                                .font(.headline)
                            Picker("Cuisine", selection: $cuisine) {
                                Text("Any").tag("")
                                ForEach(cuisineOptions.filter { !$0.isEmpty }, id: \.self) { cuisine in
                                    Text(cuisine).tag(cuisine)
                                }
                            }
                            .pickerStyle(MenuPickerStyle())
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Max Cooking Time: \(cookingTime) min")
                                .font(.headline)
                            Slider(value: Binding(
                                get: { Double(cookingTime) },
                                set: { cookingTime = Int($0) }
                            ), in: 10...120, step: 5)
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Servings: \(servings)")
                                .font(.headline)
                            Stepper("", value: $servings, in: 1...8)
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Difficulty")
                                .font(.headline)
                            Picker("Difficulty", selection: $difficulty) {
                                ForEach(difficultyOptions, id: \.self) { diff in
                                    Text(diff.capitalized).tag(diff)
                                }
                            }
                            .pickerStyle(SegmentedPickerStyle())
                        }
                        
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
                                                Color.orange : Color.gray.opacity(0.2)
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
                        
                        // Generate Button
                        Button(action: generateRecipe) {
                            HStack {
                                if service.isLoading {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Image(systemName: "sparkles")
                                    Text("Generate Recipe")
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.orange)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                            .font(.headline)
                        }
                        .disabled(service.isLoading || !isValid)
                        
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
                if let recipe = service.currentRecipe {
                    RecipeResultView(recipe: recipe)
                }
            }
        }
    }
    
    private var isValid: Bool {
        if mode == .withDeals {
            return !zipCode.isEmpty && !selectedStores.isEmpty
        } else {
            return !ingredients.isEmpty
        }
    }
    
    private func addIngredient() {
        let trimmed = ingredientInput.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty && !ingredients.contains(trimmed) {
            ingredients.append(trimmed)
            ingredientInput = ""
        }
    }
    
    private func generateRecipe() {
        Task {
            do {
                if mode == .withDeals {
                    _ = try await service.generateRecipeWithDeals(
                        preferredStores: Array(selectedStores),
                        zipCode: zipCode,
                        cuisine: cuisine.isEmpty ? nil : cuisine,
                        mealType: mealType,
                        dietaryRestrictions: Array(selectedDietaryRestrictions),
                        cookingTime: cookingTime,
                        servings: servings,
                        difficulty: difficulty,
                        budget: nil
                    )
                } else {
                    _ = try await service.generateRecipe(
                        ingredients: ingredients,
                        cuisine: cuisine.isEmpty ? nil : cuisine,
                        mealType: mealType,
                        dietaryRestrictions: Array(selectedDietaryRestrictions),
                        cookingTime: cookingTime,
                        servings: servings,
                        difficulty: difficulty
                    )
                }
                showingResults = true
            } catch {
                service.errorMessage = error.localizedDescription
            }
        }
    }
}

struct StoreButton: View {
    let store: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(store)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? Color.blue : Color.gray.opacity(0.2))
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(20)
        }
    }
}
```

---

#### Recipe Result View

Create `RecipeResultView.swift`:

```swift
import SwiftUI

struct RecipeResultView: View {
    let recipe: SmartRecipeResponse
    @State private var selectedTab = 0
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Header with image placeholder
                    ZStack(alignment: .bottom) {
                        Rectangle()
                            .fill(
                                LinearGradient(
                                    colors: [Color.orange.opacity(0.6), Color.orange],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                            )
                            .frame(height: 200)
                        
                        VStack(spacing: 8) {
                            Text(recipe.recipe.name)
                                .font(.title)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                                .multilineTextAlignment(.center)
                            
                            Text(recipe.recipe.description)
                                .font(.subheadline)
                                .foregroundColor(.white.opacity(0.9))
                                .multilineTextAlignment(.center)
                        }
                        .padding()
                    }
                    
                    // Quick Stats
                    HStack(spacing: 20) {
                        StatBadge(icon: "clock", value: "\(recipe.recipe.totalTime) min")
                        StatBadge(icon: "person.2", value: "\(recipe.recipe.servings) servings")
                        StatBadge(icon: "chart.bar", value: recipe.recipe.difficulty.capitalized)
                        StatBadge(icon: "dollarsign.circle", value: String(format: "$%.2f", recipe.recipe.estimatedCost))
                    }
                    .padding(.horizontal)
                    
                    // Savings Banner
                    if recipe.recipe.estimatedSavings > 0 {
                        HStack {
                            Image(systemName: "tag.fill")
                                .foregroundColor(.green)
                            Text("Save $\(String(format: "%.2f", recipe.recipe.estimatedSavings)) using deals!")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            Spacer()
                            Text("\(recipe.metadata.savingsPercent)% off")
                                .font(.headline)
                                .foregroundColor(.green)
                        }
                        .padding()
                        .background(Color.green.opacity(0.1))
                        .cornerRadius(12)
                        .padding(.horizontal)
                    }
                    
                    // Tab Selection
                    Picker("", selection: $selectedTab) {
                        Text("Ingredients").tag(0)
                        Text("Instructions").tag(1)
                        Text("Nutrition").tag(2)
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    .padding(.horizontal)
                    
                    // Tab Content
                    if selectedTab == 0 {
                        IngredientsView(ingredients: recipe.recipe.ingredients)
                    } else if selectedTab == 1 {
                        InstructionsView(instructions: recipe.recipe.instructions, tips: recipe.recipe.tips)
                    } else {
                        NutritionView(nutrition: recipe.recipe.nutritionInfo)
                    }
                    
                    // Shopping List
                    ShoppingListSection(items: recipe.shoppingList)
                }
            }
            .navigationTitle("Recipe")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct StatBadge: View {
    let icon: String
    let value: String
    
    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.orange)
            Text(value)
                .font(.caption)
                .fontWeight(.medium)
        }
    }
}

struct IngredientsView: View {
    let ingredients: [RecipeIngredient]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(ingredients) { ingredient in
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(ingredient.item)
                                .font(.subheadline)
                                .fontWeight(.medium)
                            if ingredient.onSale {
                                Image(systemName: "tag.fill")
                                    .foregroundColor(.green)
                                    .font(.caption)
                            }
                        }
                        Text(ingredient.amount)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text("\(ingredient.store) • \(ingredient.aisle)")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Text("$\(String(format: "%.2f", ingredient.price))")
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .foregroundColor(ingredient.onSale ? .green : .primary)
                }
                .padding()
                .background(Color.gray.opacity(0.05))
                .cornerRadius(8)
            }
        }
        .padding(.horizontal)
    }
}

struct InstructionsView: View {
    let instructions: [String]
    let tips: [String]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(Array(instructions.enumerated()), id: \.offset) { index, instruction in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(index + 1)")
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(width: 28, height: 28)
                        .background(Color.orange)
                        .clipShape(Circle())
                    
                    Text(instruction)
                        .font(.subheadline)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            
            if !tips.isEmpty {
                Divider()
                    .padding(.vertical)
                
                Text("💡 Tips")
                    .font(.headline)
                
                ForEach(tips, id: \.self) { tip in
                    HStack(alignment: .top) {
                        Text("•")
                        Text(tip)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .padding(.horizontal)
    }
}

struct NutritionView: View {
    let nutrition: NutritionInfo
    
    var body: some View {
        VStack(spacing: 16) {
            NutritionRow(label: "Calories", value: "\(nutrition.calories)", unit: "kcal")
            NutritionRow(label: "Protein", value: "\(nutrition.protein)", unit: "g")
            NutritionRow(label: "Carbs", value: "\(nutrition.carbs)", unit: "g")
            NutritionRow(label: "Fat", value: "\(nutrition.fat)", unit: "g")
            NutritionRow(label: "Fiber", value: "\(nutrition.fiber)", unit: "g")
        }
        .padding()
    }
}

struct NutritionRow: View {
    let label: String
    let value: String
    let unit: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
            Spacer()
            Text("\(value) \(unit)")
                .font(.subheadline)
                .fontWeight(.bold)
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(8)
    }
}

struct ShoppingListSection: View {
    let items: [ShoppingItem]
    @State private var checkedItems: Set<String> = []
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("🛒 Shopping List")
                .font(.title2)
                .fontWeight(.bold)
                .padding(.horizontal)
            
            ForEach(items) { item in
                Button(action: {
                    if checkedItems.contains(item.item) {
                        checkedItems.remove(item.item)
                    } else {
                        checkedItems.insert(item.item)
                    }
                }) {
                    HStack(spacing: 12) {
                        Image(systemName: checkedItems.contains(item.item) ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(checkedItems.contains(item.item) ? .green : .gray)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.item)
                                .foregroundColor(checkedItems.contains(item.item) ? .secondary : .primary)
                                .strikethrough(checkedItems.contains(item.item))
                            Text("\(item.amount) • \(item.store) • \(item.aisle)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        Spacer()
                        
                        Text("$\(String(format: "%.2f", item.price))")
                            .fontWeight(.bold)
                            .foregroundColor(checkedItems.contains(item.item) ? .secondary : .green)
                    }
                    .padding()
                    .background(checkedItems.contains(item.item) ? Color.green.opacity(0.05) : Color.clear)
                    .cornerRadius(8)
                }
            }
        }
        .padding(.horizontal)
    }
}
```

---

## 🎯 How Both Features Work Together

### Architecture Overview:

```
┌─────────────────────────────────────────┐
│           iOS APP                        │
│                                          │
│  Smart Meal Plan    Smart Recipe        │
│  (Multiple days)    (Single recipe)     │
│       ↓                   ↓              │
│       └───────┬───────────┘              │
│               ↓                          │
│       Server-Side APIs                   │
│       (ChatGPT secure)                   │
└─────────────────────────────────────────┘
```

### Both Features Share:
- ✅ JWT authentication
- ✅ Deal database
- ✅ ChatGPT API (server-side)
- ✅ Aisle location mapping
- ✅ Savings calculator

### Key Differences:

| Feature | Smart Meal Plan | Smart Recipe |
|---------|----------------|--------------|
| Output | 5-7 days of meals | 1 recipe |
| Use Case | "Plan my week" | "What's for dinner?" |
| Time | 15-20 seconds | 10-15 seconds |
| Cost | ~$0.05 per plan | ~$0.02 per recipe |
| Inputs | Preferences only | Ingredients OR deals |

---

## 🚀 Testing

### Test 1: Recipe with Deals
```bash
curl -X POST http://localhost:3000/api/app/recipes/smart-generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "useDealIngredients": true,
    "preferredStores": ["Kroger"],
    "zipCode": "78701",
    "mealType": "dinner",
    "servings": 4,
    "cookingTime": 30
  }'
```

### Test 2: Recipe with Specific Ingredients
```bash
curl -X POST http://localhost:3000/api/app/recipes/smart-generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "ingredients": ["chicken", "broccoli", "rice"],
    "useDealIngredients": false,
    "cuisine": "Asian",
    "mealType": "dinner",
    "servings": 4
  }'
```

---

## 📱 iOS Navigation

Add both features to your navigation:

```swift
// In your main navigation
VStack(spacing: 16) {
    NavigationLink(destination: SmartMealPlanView()) {
        FeatureCard(
            icon: "calendar",
            title: "Smart Meal Plan",
            description: "Plan your week with AI"
        )
    }
    
    NavigationLink(destination: SmartRecipeView()) {
        FeatureCard(
            icon: "fork.knife",
            title: "AI Recipe Generator",
            description: "Create a recipe for tonight"
        )
    }
}
```

---

## 🎉 Benefits of Server-Side Architecture

### Security:
- ✅ OpenAI API key never in iOS app
- ✅ Can't be extracted from binary
- ✅ Centralized key management

### Cost Control:
- ✅ Track usage per user
- ✅ Set rate limits
- ✅ Monitor spending

### Flexibility:
- ✅ Switch AI models without app update
- ✅ A/B test different prompts
- ✅ Add new features server-side

### Performance:
- ✅ Faster API calls (server closer to OpenAI)
- ✅ Can cache common recipes
- ✅ Batch processing possible

---

## 📊 Analytics

Track both features:

```swift
// Meal plan generated
Analytics.logEvent("smart_meal_plan_generated", parameters: [
    "days": 5,
    "savings": 45.00
])

// Recipe generated
Analytics.logEvent("smart_recipe_generated", parameters: [
    "mode": "deals", // or "ingredients"
    "meal_type": "dinner",
    "savings": 4.00
])
```

---

## 🔗 Related Docs

- **iOS Meal Plan**: `IOS_SMART_MEAL_PLANNER.md`
- **Setup Guide**: `IOS_SETUP_AND_TESTING.md`
- **Overview**: `IOS_INTEGRATION_SUMMARY.md`

---

**Now you have BOTH features with server-side ChatGPT!** 🎉

Users can either:
1. **Plan their week** (Smart Meal Plan)
2. **Get tonight's recipe** (Smart Recipe Generator)

Both use the same secure, server-side architecture! 🚀
