# 📱 Complete iOS Swift Code - Server-Side ChatGPT

## Overview

This Swift code works with your **server-side ChatGPT API**. The iOS app NEVER calls OpenAI directly - all AI processing happens on your secure server.

---

## 🏗️ Architecture

```
iOS App (Swift)
    ↓ HTTP Request with JWT
Server API (Next.js)
    ↓ Secure API Call
ChatGPT (OpenAI)
    ↓ Response
Server API
    ↓ JSON Response
iOS App (Swift)
```

**Key Point:** Your OpenAI API key stays on the server! ✅

---

## 📁 File Structure

```
YourApp/
├── Models/
│   ├── Recipe.swift                    # Recipe data models
│   ├── SmartMealPlan.swift            # Meal plan data models
│   └── APIResponse.swift              # Response wrappers
├── Services/
│   ├── NetworkManager.swift           # Base networking
│   ├── RecipeService.swift            # Recipe API calls
│   └── MealPlanService.swift          # Meal plan API calls
├── Views/
│   ├── RecipeGeneratorView.swift     # Recipe input form
│   ├── SmartMealPlanView.swift       # Meal plan input form
│   └── ResultViews/                   # Display results
└── Utilities/
    └── KeychainHelper.swift           # Secure token storage
```

---

## 1️⃣ Base Networking (NetworkManager.swift)

```swift
import Foundation

/// Base networking manager for all API calls
class NetworkManager {
    static let shared = NetworkManager()
    
    // MARK: - Configuration
    #if DEBUG
    private let baseURL = "http://localhost:3000"  // Development
    #else
    private let baseURL = "https://your-domain.com"  // Production
    #endif
    
    private init() {}
    
    // MARK: - Generic Request Method
    func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .get,
        body: Encodable? = nil,
        requiresAuth: Bool = true
    ) async throws -> T {
        
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw NetworkError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add JWT token if required
        if requiresAuth {
            guard let token = KeychainHelper.getToken() else {
                throw NetworkError.unauthorized
            }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        // Add body if present
        if let body = body {
            request.httpBody = try JSONEncoder().encode(body)
        }
        
        // Make request
        let (data, response) = try await URLSession.shared.data(for: request)
        
        // Handle HTTP errors
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.invalidResponse
        }
        
        switch httpResponse.statusCode {
        case 200...299:
            // Success - decode and return
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            return try decoder.decode(T.self, from: data)
            
        case 401:
            throw NetworkError.unauthorized
            
        case 403:
            // Check if it's a Pro upgrade required error
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data),
               errorResponse.upgrade == true {
                throw NetworkError.upgradeRequired(errorResponse.message)
            }
            throw NetworkError.forbidden
            
        case 404:
            throw NetworkError.notFound
            
        case 500...599:
            let message = String(data: data, encoding: .utf8) ?? "Server error"
            throw NetworkError.serverError(message)
            
        default:
            throw NetworkError.unknown(statusCode: httpResponse.statusCode)
        }
    }
}

// MARK: - HTTP Method
enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case delete = "DELETE"
}

// MARK: - Network Errors
enum NetworkError: LocalizedError {
    case invalidURL
    case unauthorized
    case forbidden
    case notFound
    case upgradeRequired(String)
    case serverError(String)
    case invalidResponse
    case unknown(statusCode: Int)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .unauthorized:
            return "Please log in to continue"
        case .forbidden:
            return "You don't have permission to access this"
        case .notFound:
            return "Resource not found"
        case .upgradeRequired(let message):
            return message
        case .serverError(let message):
            return "Server error: \(message)"
        case .invalidResponse:
            return "Invalid server response"
        case .unknown(let code):
            return "Unknown error (code: \(code))"
        }
    }
}

// MARK: - Error Response Model
struct ErrorResponse: Codable {
    let message: String
    let upgrade: Bool?
}
```

---

## 2️⃣ Recipe Models (Recipe.swift)

```swift
import Foundation

// MARK: - Recipe Request (sent to server)
struct RecipeRequest: Codable {
    let ingredients: [String]?
    let cuisine: String?
    let dietaryRestrictions: [String]?
    let cookingTime: Int?
    let servings: Int?
    let difficulty: String?
    let budget: Double?
    
    // For smart recipe generator with deals
    let useDeals: Bool?
    let preferredStores: [String]?
    let zipCode: String?
}

// MARK: - Recipe Response (from server)
struct RecipeResponse: Codable {
    let success: Bool
    let recipeId: String
    let recipe: Recipe
    let metadata: RecipeMetadata?
}

struct RecipeMetadata: Codable {
    let dealsUsed: Int?
    let estimatedCost: Double?
    let savings: Double?
    let usedStores: [String]?
}

// MARK: - Recipe Model
struct Recipe: Codable, Identifiable {
    let id: String
    let name: String
    let description: String?
    let ingredients: [Ingredient]
    let instructions: [String]
    let prepTime: Int?
    let cookTime: Int?
    let totalTime: Int?
    let servings: Int?
    let calories: Int?
    let difficulty: String?
    let cuisine: String?
    let dietaryTags: [String]?
    let estimatedCost: Double?
    let savingsFromDeals: Double?
    let tips: [String]?
    
    // Computed property for display
    var totalTimeDisplay: String {
        let total = (prepTime ?? 0) + (cookTime ?? 0)
        return "\(total) min"
    }
    
    var difficultyEmoji: String {
        switch difficulty?.lowercased() {
        case "easy": return "🟢"
        case "medium": return "🟡"
        case "hard": return "🔴"
        default: return "⚪️"
        }
    }
}

// MARK: - Ingredient Model
struct Ingredient: Codable, Identifiable {
    var id: String { name }
    let name: String
    let quantity: String
    let unit: String
    let price: Double?
    let store: String?
    let onSale: Bool?
    let aisle: String?
    let section: String?
    
    var displayText: String {
        "\(quantity) \(unit) \(name)"
    }
    
    var priceDisplay: String? {
        guard let price = price else { return nil }
        return String(format: "$%.2f", price)
    }
}
```

---

## 3️⃣ Recipe Service (RecipeService.swift)

```swift
import Foundation

/// Service for recipe generation API calls
/// All ChatGPT processing happens on the SERVER - not in the app!
class RecipeService: ObservableObject {
    
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var currentRecipe: Recipe?
    
    // MARK: - Generate Basic Recipe
    /// Calls your existing /api/app/recipes/generate endpoint
    func generateRecipe(
        ingredients: [String]? = nil,
        cuisine: String? = nil,
        dietaryRestrictions: [String] = [],
        cookingTime: Int? = nil,
        servings: Int = 4,
        difficulty: String? = nil,
        budget: Double? = nil
    ) async throws -> Recipe {
        
        isLoading = true
        errorMessage = nil
        
        defer { isLoading = false }
        
        let request = RecipeRequest(
            ingredients: ingredients,
            cuisine: cuisine,
            dietaryRestrictions: dietaryRestrictions,
            cookingTime: cookingTime,
            servings: servings,
            difficulty: difficulty,
            budget: budget,
            useDeals: nil,
            preferredStores: nil,
            zipCode: nil
        )
        
        do {
            // Server calls ChatGPT, not the app!
            let response: RecipeResponse = try await NetworkManager.shared.request(
                endpoint: "/api/app/recipes/generate",
                method: .post,
                body: request,
                requiresAuth: true
            )
            
            DispatchQueue.main.async {
                self.currentRecipe = response.recipe
            }
            
            return response.recipe
            
        } catch {
            DispatchQueue.main.async {
                self.errorMessage = error.localizedDescription
            }
            throw error
        }
    }
    
    // MARK: - Generate SMART Recipe (with deals)
    /// Calls new /api/app/recipes/smart-generate endpoint
    /// This uses grocery deals to save money!
    func generateSmartRecipe(
        ingredients: [String]? = nil,
        cuisine: String? = nil,
        dietaryRestrictions: [String] = [],
        cookingTime: Int? = nil,
        servings: Int = 4,
        difficulty: String? = nil,
        budget: Double? = nil,
        useDeals: Bool = true,
        preferredStores: [String] = [],
        zipCode: String
    ) async throws -> RecipeResponse {
        
        isLoading = true
        errorMessage = nil
        
        defer { isLoading = false }
        
        let request = RecipeRequest(
            ingredients: ingredients,
            cuisine: cuisine,
            dietaryRestrictions: dietaryRestrictions,
            cookingTime: cookingTime,
            servings: servings,
            difficulty: difficulty,
            budget: budget,
            useDeals: useDeals,
            preferredStores: preferredStores,
            zipCode: zipCode
        )
        
        do {
            // Server finds deals and calls ChatGPT!
            let response: RecipeResponse = try await NetworkManager.shared.request(
                endpoint: "/api/app/recipes/smart-generate",
                method: .post,
                body: request,
                requiresAuth: true
            )
            
            DispatchQueue.main.async {
                self.currentRecipe = response.recipe
            }
            
            return response
            
        } catch {
            DispatchQueue.main.async {
                self.errorMessage = error.localizedDescription
            }
            throw error
        }
    }
}
```

---

## 4️⃣ Recipe Generator View (RecipeGeneratorView.swift)

```swift
import SwiftUI

struct RecipeGeneratorView: View {
    @StateObject private var service = RecipeService()
    @State private var showingResult = false
    
    // Form inputs
    @State private var ingredientsText = ""
    @State private var cuisine = ""
    @State private var cookingTime: Double = 30
    @State private var servings = 4
    @State private var difficulty = "medium"
    @State private var budget: Double = 20
    @State private var selectedDietaryRestrictions: Set<String> = []
    
    // Smart recipe options
    @State private var useDeals = false
    @State private var zipCode = ""
    @State private var selectedStores: Set<String> = []
    
    let cuisineOptions = ["Italian", "Mexican", "Asian", "Indian", "Mediterranean", "American"]
    let difficultyOptions = ["easy", "medium", "hard"]
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
                        
                        Text("AI Recipe Generator")
                            .font(.system(size: 32, weight: .bold))
                        
                        Text("Powered by ChatGPT on our secure server")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.top, 20)
                    
                    // Main Form
                    VStack(spacing: 20) {
                        // Ingredients
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Ingredients (optional)")
                                .font(.headline)
                            TextField("e.g. chicken, broccoli, rice", text: $ingredientsText)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                            Text("Separate with commas")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        // Cuisine
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Cuisine (optional)")
                                .font(.headline)
                            Picker("Cuisine", selection: $cuisine) {
                                Text("Any").tag("")
                                ForEach(cuisineOptions, id: \.self) { cuisine in
                                    Text(cuisine).tag(cuisine)
                                }
                            }
                            .pickerStyle(MenuPickerStyle())
                        }
                        
                        // Cooking Time
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Max Cooking Time: \(Int(cookingTime)) min")
                                .font(.headline)
                            Slider(value: $cookingTime, in: 15...120, step: 5)
                        }
                        
                        // Servings
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Servings: \(servings)")
                                .font(.headline)
                            Stepper("", value: $servings, in: 1...12)
                        }
                        
                        // Difficulty
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
                        
                        // Budget
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Budget: $\(Int(budget))")
                                .font(.headline)
                            Slider(value: $budget, in: 5...50, step: 5)
                        }
                        
                        // Dietary Restrictions
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Dietary Restrictions")
                                .font(.headline)
                            FlowLayout(spacing: 8) {
                                ForEach(dietaryOptions, id: \.self) { option in
                                    ToggleChip(
                                        text: option,
                                        isSelected: selectedDietaryRestrictions.contains(option)
                                    ) {
                                        if selectedDietaryRestrictions.contains(option) {
                                            selectedDietaryRestrictions.remove(option)
                                        } else {
                                            selectedDietaryRestrictions.insert(option)
                                        }
                                    }
                                }
                            }
                        }
                        
                        Divider()
                        
                        // SMART Recipe Toggle
                        VStack(alignment: .leading, spacing: 12) {
                            Toggle("💡 Use Smart Recipe (with grocery deals)", isOn: $useDeals)
                                .font(.headline)
                            
                            if useDeals {
                                Text("We'll find deals at your local stores to save you money!")
                                    .font(.caption)
                                    .foregroundColor(.green)
                                
                                // ZIP Code
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Your ZIP Code")
                                        .font(.subheadline)
                                    TextField("e.g. 78701", text: $zipCode)
                                        .textFieldStyle(RoundedBorderTextFieldStyle())
                                        .keyboardType(.numberPad)
                                }
                                
                                // Stores
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Where do you shop?")
                                        .font(.subheadline)
                                    FlowLayout(spacing: 8) {
                                        ForEach(storeOptions, id: \.self) { store in
                                            ToggleChip(
                                                text: store,
                                                isSelected: selectedStores.contains(store),
                                                color: .blue
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
                            }
                        }
                        
                        // Error Message
                        if let error = service.errorMessage {
                            Text(error)
                                .foregroundColor(.red)
                                .font(.caption)
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
                            .background(
                                canGenerate ? Color.green : Color.gray
                            )
                            .foregroundColor(.white)
                            .cornerRadius(12)
                            .font(.headline)
                        }
                        .disabled(!canGenerate || service.isLoading)
                    }
                    .padding()
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showingResult) {
                if let recipe = service.currentRecipe {
                    RecipeDetailView(recipe: recipe)
                }
            }
        }
    }
    
    // MARK: - Actions
    private func generateRecipe() {
        Task {
            do {
                let ingredients = ingredientsText.isEmpty ? nil : ingredientsText
                    .split(separator: ",")
                    .map { $0.trimmingCharacters(in: .whitespaces) }
                
                if useDeals && !zipCode.isEmpty && !selectedStores.isEmpty {
                    // Use SMART recipe generator with deals
                    _ = try await service.generateSmartRecipe(
                        ingredients: ingredients,
                        cuisine: cuisine.isEmpty ? nil : cuisine,
                        dietaryRestrictions: Array(selectedDietaryRestrictions),
                        cookingTime: Int(cookingTime),
                        servings: servings,
                        difficulty: difficulty,
                        budget: budget,
                        useDeals: true,
                        preferredStores: Array(selectedStores),
                        zipCode: zipCode
                    )
                } else {
                    // Use basic recipe generator
                    _ = try await service.generateRecipe(
                        ingredients: ingredients,
                        cuisine: cuisine.isEmpty ? nil : cuisine,
                        dietaryRestrictions: Array(selectedDietaryRestrictions),
                        cookingTime: Int(cookingTime),
                        servings: servings,
                        difficulty: difficulty,
                        budget: budget
                    )
                }
                
                showingResult = true
            } catch {
                // Error is already set in service
                print("Recipe generation error: \(error)")
            }
        }
    }
    
    private var canGenerate: Bool {
        if useDeals {
            return !zipCode.isEmpty && !selectedStores.isEmpty
        }
        return true
    }
}

// MARK: - Helper Views
struct ToggleChip: View {
    let text: String
    let isSelected: Bool
    var color: Color = .green
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(text)
                .font(.subheadline)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? color : Color.gray.opacity(0.2))
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(20)
        }
    }
}

// Simple flow layout (you can use a library or custom implementation)
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 0
        var height: CGFloat = 0
        var lineWidth: CGFloat = 0
        var lineHeight: CGFloat = 0
        
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            
            if lineWidth + size.width + spacing > width {
                height += lineHeight + spacing
                lineWidth = size.width
                lineHeight = size.height
            } else {
                lineWidth += size.width + spacing
                lineHeight = max(lineHeight, size.height)
            }
        }
        
        height += lineHeight
        return CGSize(width: width, height: height)
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var lineHeight: CGFloat = 0
        
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            
            if x + size.width > bounds.maxX && x > bounds.minX {
                x = bounds.minX
                y += lineHeight + spacing
                lineHeight = 0
            }
            
            subview.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}
```

---

## 5️⃣ Recipe Detail View (RecipeDetailView.swift)

```swift
import SwiftUI

struct RecipeDetailView: View {
    let recipe: Recipe
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Header
                    VStack(alignment: .leading, spacing: 12) {
                        Text(recipe.name)
                            .font(.system(size: 28, weight: .bold))
                        
                        if let description = recipe.description {
                            Text(description)
                                .font(.body)
                                .foregroundColor(.secondary)
                        }
                        
                        // Meta info
                        HStack(spacing: 16) {
                            if let prepTime = recipe.prepTime {
                                MetaTag(icon: "clock", text: "\(prepTime) min prep")
                            }
                            if let cookTime = recipe.cookTime {
                                MetaTag(icon: "flame", text: "\(cookTime) min cook")
                            }
                            if let difficulty = recipe.difficulty {
                                MetaTag(
                                    icon: "chart.bar",
                                    text: difficulty.capitalized,
                                    color: difficultyColor(difficulty)
                                )
                            }
                        }
                        
                        // Savings info (if smart recipe)
                        if let savings = recipe.savingsFromDeals, savings > 0 {
                            HStack {
                                Image(systemName: "tag.fill")
                                    .foregroundColor(.green)
                                Text("You'll save $\(String(format: "%.2f", savings)) with deals!")
                                    .font(.headline)
                                    .foregroundColor(.green)
                            }
                            .padding()
                            .background(Color.green.opacity(0.1))
                            .cornerRadius(12)
                        }
                    }
                    .padding()
                    
                    Divider()
                    
                    // Ingredients
                    VStack(alignment: .leading, spacing: 12) {
                        Text("🥘 Ingredients")
                            .font(.title2)
                            .fontWeight(.bold)
                            .padding(.horizontal)
                        
                        ForEach(recipe.ingredients) { ingredient in
                            IngredientRow(ingredient: ingredient)
                        }
                    }
                    
                    Divider()
                    
                    // Instructions
                    VStack(alignment: .leading, spacing: 12) {
                        Text("👨‍🍳 Instructions")
                            .font(.title2)
                            .fontWeight(.bold)
                            .padding(.horizontal)
                        
                        ForEach(Array(recipe.instructions.enumerated()), id: \.offset) { index, instruction in
                            InstructionRow(number: index + 1, text: instruction)
                        }
                    }
                    
                    // Tips (if available)
                    if let tips = recipe.tips, !tips.isEmpty {
                        Divider()
                        
                        VStack(alignment: .leading, spacing: 12) {
                            Text("💡 Pro Tips")
                                .font(.title2)
                                .fontWeight(.bold)
                                .padding(.horizontal)
                            
                            ForEach(Array(tips.enumerated()), id: \.offset) { _, tip in
                                HStack(alignment: .top) {
                                    Image(systemName: "lightbulb.fill")
                                        .foregroundColor(.yellow)
                                    Text(tip)
                                        .font(.body)
                                }
                                .padding()
                                .background(Color.gray.opacity(0.1))
                                .cornerRadius(8)
                                .padding(.horizontal)
                            }
                        }
                    }
                }
                .padding(.bottom, 40)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private func difficultyColor(_ difficulty: String) -> Color {
        switch difficulty.lowercased() {
        case "easy": return .green
        case "medium": return .orange
        case "hard": return .red
        default: return .gray
        }
    }
}

// MARK: - Helper Views
struct MetaTag: View {
    let icon: String
    let text: String
    var color: Color = .blue
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption)
            Text(text)
                .font(.caption)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(color.opacity(0.1))
        .foregroundColor(color)
        .cornerRadius(8)
    }
}

struct IngredientRow: View {
    let ingredient: Ingredient
    @State private var isChecked = false
    
    var body: some View {
        Button(action: { isChecked.toggle() }) {
            HStack(spacing: 12) {
                Image(systemName: isChecked ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isChecked ? .green : .gray)
                    .font(.title3)
                
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(ingredient.displayText)
                            .foregroundColor(isChecked ? .secondary : .primary)
                            .strikethrough(isChecked)
                        
                        if let onSale = ingredient.onSale, onSale {
                            Image(systemName: "tag.fill")
                                .foregroundColor(.green)
                                .font(.caption)
                        }
                    }
                    
                    if let store = ingredient.store, let aisle = ingredient.aisle {
                        Text("\(store) • \(aisle)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                Spacer()
                
                if let price = ingredient.priceDisplay {
                    Text(price)
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .foregroundColor(ingredient.onSale == true ? .green : .primary)
                }
            }
            .padding()
            .background(isChecked ? Color.green.opacity(0.05) : Color.clear)
            .cornerRadius(8)
        }
        .buttonStyle(PlainButtonStyle())
        .padding(.horizontal)
    }
}

struct InstructionRow: View {
    let number: Int
    let text: String
    @State private var isDone = false
    
    var body: some View {
        Button(action: { isDone.toggle() }) {
            HStack(alignment: .top, spacing: 12) {
                ZStack {
                    Circle()
                        .fill(isDone ? Color.green : Color.blue)
                        .frame(width: 32, height: 32)
                    Text("\(number)")
                        .foregroundColor(.white)
                        .font(.subheadline)
                        .fontWeight(.bold)
                }
                
                Text(text)
                    .font(.body)
                    .foregroundColor(isDone ? .secondary : .primary)
                    .strikethrough(isDone)
                    .multilineTextAlignment(.leading)
                
                Spacer()
            }
            .padding()
            .background(isDone ? Color.green.opacity(0.05) : Color.gray.opacity(0.05))
            .cornerRadius(8)
        }
        .buttonStyle(PlainButtonStyle())
        .padding(.horizontal)
    }
}
```

---

## 6️⃣ Keychain Helper (KeychainHelper.swift)

```swift
import Security
import Foundation

/// Secure storage for JWT tokens
class KeychainHelper {
    
    // MARK: - Save Token
    static func save(token: String) {
        let data = Data(token.utf8)
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "authToken",
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlocked
        ]
        
        // Delete any existing token first
        SecItemDelete(query as CFDictionary)
        
        // Add new token
        let status = SecItemAdd(query as CFDictionary, nil)
        
        if status == errSecSuccess {
            print("✅ Token saved to Keychain")
        } else {
            print("❌ Failed to save token: \(status)")
        }
    }
    
    // MARK: - Get Token
    static func getToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "authToken",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return token
    }
    
    // MARK: - Delete Token
    static func deleteToken() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "authToken"
        ]
        
        let status = SecItemDelete(query as CFDictionary)
        
        if status == errSecSuccess || status == errSecItemNotFound {
            print("✅ Token deleted from Keychain")
        } else {
            print("❌ Failed to delete token: \(status)")
        }
    }
}
```

---

## 🧪 Testing Your Integration

### 1. Test Authentication First
```swift
// In your login view after successful login:
KeychainHelper.save(token: responseToken)

// Verify it's saved:
if let token = KeychainHelper.getToken() {
    print("✅ Token exists: \(token.prefix(20))...")
}
```

### 2. Test Basic Recipe Generation
```swift
let service = RecipeService()

Task {
    do {
        let recipe = try await service.generateRecipe(
            ingredients: ["chicken", "broccoli"],
            cuisine: "Asian",
            servings: 4
        )
        print("✅ Recipe generated: \(recipe.name)")
    } catch {
        print("❌ Error: \(error)")
    }
}
```

### 3. Test Smart Recipe (with deals)
```swift
Task {
    do {
        let response = try await service.generateSmartRecipe(
            ingredients: ["chicken"],
            cuisine: "Mexican",
            useDeals: true,
            preferredStores: ["Kroger", "Walmart"],
            zipCode: "78701"
        )
        print("✅ Smart recipe: \(response.recipe.name)")
        print("💰 Savings: $\(response.metadata?.savings ?? 0)")
    } catch {
        print("❌ Error: \(error)")
    }
}
```

---

## ✅ Key Points

1. **✅ ChatGPT stays on server** - iOS app NEVER calls OpenAI directly
2. **✅ JWT authentication** - All requests require Bearer token
3. **✅ Secure token storage** - Uses iOS Keychain
4. **✅ Error handling** - Handles 401, 403, 404, 500 properly
5. **✅ Loading states** - Shows progress while server processes
6. **✅ Two modes** - Basic recipe OR smart recipe with deals

---

## 🎉 You're Done!

Add these files to your Xcode project and you're ready to go!

**The app will:**
1. Send request to YOUR server
2. YOUR server calls ChatGPT
3. YOUR server returns result
4. App displays it

**Your OpenAI API key stays safe on the server!** 🔒

---

## 📞 Quick Reference

### Server Endpoints:
- `POST /api/app/recipes/generate` - Basic recipe
- `POST /api/app/recipes/smart-generate` - Smart recipe with deals
- `POST /api/app/meal-plans/smart-generate` - Smart meal plan

### Swift Files:
- `NetworkManager.swift` - Base networking
- `Recipe.swift` - Data models
- `RecipeService.swift` - API calls
- `RecipeGeneratorView.swift` - UI
- `RecipeDetailView.swift` - Results
- `KeychainHelper.swift` - Token storage

---

**All ChatGPT processing happens on your server!** ✅🔒




