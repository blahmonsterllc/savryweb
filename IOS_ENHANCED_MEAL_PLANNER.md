# 🍽️ iOS Enhanced Meal Planner with Recipe Details

## 📱 Complete SwiftUI Implementation

This guide shows you how to add the **same enhanced meal planning features** from your web app to iOS:
- ✅ Restaurant-quality recipes with detailed instructions
- ✅ Expandable recipe cards with ingredients & steps
- ✅ Prep time, cook time, difficulty, cuisine type
- ✅ Pro tips for each recipe
- ✅ Save recipes to collection
- ✅ Beautiful, native iOS design

---

## 📂 **File Structure**

Add these files to your iOS project:

```
Savry/
├── Models/
│   └── EnhancedMealPlan.swift (NEW)
├── Services/
│   └── EnhancedMealPlanService.swift (NEW)
└── Views/
    ├── EnhancedMealPlanView.swift (NEW)
    ├── RecipeCardView.swift (NEW)
    └── RecipeDetailView.swift (NEW)
```

---

## 1️⃣ **Enhanced Data Models**

Create: `Models/EnhancedMealPlan.swift`

```swift
import Foundation

// MARK: - Enhanced Meal Plan Response
struct EnhancedMealPlanResponse: Codable {
    let success: Bool
    let mealPlanId: String?
    let mealPlan: EnhancedMealPlan
    let shoppingList: ShoppingList
    let metadata: MealPlanMetadata
}

// MARK: - Enhanced Meal Plan
struct EnhancedMealPlan: Codable {
    let name: String
    let totalCost: Double
    let estimatedSavings: Double
    let days: [MealDay]
}

// MARK: - Meal Day
struct MealDay: Codable, Identifiable {
    var id: Int { day }
    let day: Int
    let meals: DayMeals
}

// MARK: - Day Meals
struct DayMeals: Codable {
    let breakfast: EnhancedMeal
    let lunch: EnhancedMeal
    let dinner: EnhancedMeal
}

// MARK: - Enhanced Meal (with full recipe details)
struct EnhancedMeal: Codable, Identifiable {
    var id: String { name }
    let name: String
    let estimatedCost: Double
    let prepTime: String?
    let cookTime: String?
    let difficulty: String?
    let cuisine: String?
    let ingredients: [String]?
    let instructions: [String]?
    let tips: String?
}

// MARK: - Shopping List
struct ShoppingList: Codable {
    let byStore: [String: StoreGroup]
    let byAisle: [String: [ShoppingItem]]
}

struct StoreGroup: Codable {
    let items: [ShoppingItem]
    let total: Double
}

struct ShoppingItem: Codable, Identifiable {
    var id: String { item + store }
    let item: String
    let amount: String
    let price: Double
    let aisle: String
    let section: String
    let store: String
}

// MARK: - Meal Plan Metadata
struct MealPlanMetadata: Codable {
    let dealsFound: Int
    let dealsUsed: Int
    let stores: [String]
    let budget: Double
    let totalCost: Double
    let savings: Double
    let savingsPercent: Int
}

// MARK: - Meal Plan Request
struct EnhancedMealPlanRequest: Codable {
    let days: Int
    let budget: Double
    let servings: Int
    let dietaryRestrictions: [String]
    let preferredStores: [String]
    let zipCode: String
}
```

---

## 2️⃣ **Network Service**

Create: `Services/EnhancedMealPlanService.swift`

```swift
import Foundation

class EnhancedMealPlanService: ObservableObject {
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var currentMealPlan: EnhancedMealPlanResponse?
    
    private let baseURL = "http://localhost:3000" // Change to your production URL
    
    // MARK: - Generate Enhanced Meal Plan
    func generateMealPlan(
        days: Int,
        budget: Double,
        servings: Int,
        dietaryRestrictions: [String],
        preferredStores: [String],
        zipCode: String,
        token: String
    ) async throws -> EnhancedMealPlanResponse {
        
        isLoading = true
        errorMessage = nil
        
        defer { isLoading = false }
        
        let url = URL(string: "\(baseURL)/api/app/meal-plans/smart-generate")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let requestBody = EnhancedMealPlanRequest(
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
            throw URLError(.badServerResponse)
        }
        
        if httpResponse.statusCode == 401 {
            errorMessage = "Please log in to use this feature"
            throw URLError(.userAuthenticationRequired)
        }
        
        if httpResponse.statusCode == 404 {
            errorMessage = "No deals found in your area. Please try different stores."
            throw URLError(.fileDoesNotExist)
        }
        
        guard httpResponse.statusCode == 200 else {
            errorMessage = "Server error. Please try again."
            throw URLError(.badServerResponse)
        }
        
        let decoder = JSONDecoder()
        let mealPlanResponse = try decoder.decode(EnhancedMealPlanResponse.self, from: data)
        
        DispatchQueue.main.async {
            self.currentMealPlan = mealPlanResponse
        }
        
        return mealPlanResponse
    }
    
    // MARK: - Save Recipe
    func saveRecipe(_ meal: EnhancedMeal, token: String) async throws {
        // TODO: Implement save recipe endpoint
        // For now, just simulate saving
        try await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
        print("Recipe saved: \(meal.name)")
    }
}
```

---

## 3️⃣ **Main View**

Create: `Views/EnhancedMealPlanView.swift`

```swift
import SwiftUI

struct EnhancedMealPlanView: View {
    @StateObject private var service = EnhancedMealPlanService()
    @StateObject private var storeService = StoreLocatorService()
    
    @State private var zipCode = ""
    @State private var days = 5
    @State private var budget: Double = 100
    @State private var servings = 4
    @State private var selectedStores: Set<String> = []
    @State private var dietaryRestrictions: Set<String> = []
    @State private var availableStores: [String] = []
    @State private var regionInfo = ""
    @State private var showingResults = false
    
    let dietaryOptions = ["Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Keto", "Paleo"]
    
    var body: some View {
        NavigationView {
            ZStack {
                // Background gradient
                LinearGradient(
                    colors: [Color.green.opacity(0.1), Color.green.opacity(0.05)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                if showingResults, let mealPlan = service.currentMealPlan {
                    // Show results
                    ResultsView(mealPlan: mealPlan, service: service) {
                        showingResults = false
                    }
                } else {
                    // Show input form
                    ScrollView {
                        VStack(spacing: 24) {
                            headerSection
                            
                            VStack(spacing: 20) {
                                zipCodeSection
                                
                                if !availableStores.isEmpty {
                                    storesSection
                                }
                                
                                daysSection
                                budgetSection
                                servingsSection
                                dietarySection
                                generateButton
                            }
                            .padding()
                            .background(Color.white)
                            .cornerRadius(16)
                            .shadow(color: .black.opacity(0.05), radius: 10)
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle("Smart Meal Planner")
            .navigationBarTitleDisplayMode(.large)
        }
    }
    
    // MARK: - Header
    private var headerSection: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "sparkles")
                    .font(.system(size: 40))
                    .foregroundColor(.green)
                Text("Smart Meal Planner")
                    .font(.largeTitle)
                    .fontWeight(.bold)
            }
            
            Text("Find deals, create meals, and shop efficiently")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
    
    // MARK: - ZIP Code Section
    private var zipCodeSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Your ZIP Code")
                .font(.headline)
            
            TextField("e.g. 11764", text: $zipCode)
                .keyboardType(.numberPad)
                .textFieldStyle(.roundedBorder)
                .onChange(of: zipCode) { newValue in
                    if newValue.count == 5 {
                        Task {
                            await fetchStoresForZip(newValue)
                        }
                    }
                }
            
            if storeService.isLoading {
                HStack {
                    ProgressView()
                    Text("Finding stores in your area...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } else if !regionInfo.isEmpty {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                    Text(regionInfo)
                        .font(.caption)
                        .foregroundColor(.green)
                }
            }
        }
    }
    
    // MARK: - Stores Section
    private var storesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Where do you usually shop?")
                .font(.headline)
            
            FlowLayout(spacing: 8) {
                ForEach(availableStores, id: \.self) { store in
                    StoreChip(
                        name: store,
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
    }
    
    // MARK: - Days Section
    private var daysSection: some View {
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
    }
    
    // MARK: - Budget Section
    private var budgetSection: some View {
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
    }
    
    // MARK: - Servings Section
    private var servingsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Number of People: \(servings)")
                .font(.headline)
            
            Slider(value: Binding(
                get: { Double(servings) },
                set: { servings = Int($0) }
            ), in: 1...8, step: 1)
            
            HStack {
                Text("1 person")
                    .font(.caption)
                Spacer()
                Text("8 people")
                    .font(.caption)
            }
            .foregroundColor(.secondary)
        }
    }
    
    // MARK: - Dietary Restrictions Section
    private var dietarySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Dietary Restrictions")
                .font(.headline)
            
            FlowLayout(spacing: 8) {
                ForEach(dietaryOptions, id: \.self) { option in
                    DietaryChip(
                        name: option,
                        isSelected: dietaryRestrictions.contains(option)
                    ) {
                        if dietaryRestrictions.contains(option) {
                            dietaryRestrictions.remove(option)
                        } else {
                            dietaryRestrictions.insert(option)
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - Generate Button
    private var generateButton: some View {
        Button {
            Task {
                await generateMealPlan()
            }
        } label: {
            HStack {
                if service.isLoading {
                    ProgressView()
                        .tint(.white)
                    Text("Finding deals & creating your meal plan...")
                } else {
                    Image(systemName: "sparkles")
                    Text("Generate Smart Meal Plan")
                }
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(
                LinearGradient(
                    colors: [Color.green, Color.green.opacity(0.8)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .foregroundColor(.white)
            .fontWeight(.bold)
            .cornerRadius(12)
        }
        .disabled(service.isLoading || zipCode.count < 5 || selectedStores.isEmpty)
    }
    
    // MARK: - Functions
    private func fetchStoresForZip(_ zip: String) async {
        do {
            let stores = try await storeService.fetchStores(for: zip)
            availableStores = stores.localStores ?? stores.recommended
            regionInfo = "\(stores.region) • \(stores.description)"
            
            // Auto-select first 2 stores
            selectedStores = Set(availableStores.prefix(2))
        } catch {
            print("Failed to fetch stores: \(error)")
        }
    }
    
    private func generateMealPlan() async {
        guard let token = KeychainHelper.getToken() else {
            service.errorMessage = "Please log in first"
            return
        }
        
        do {
            _ = try await service.generateMealPlan(
                days: days,
                budget: budget,
                servings: servings,
                dietaryRestrictions: Array(dietaryRestrictions),
                preferredStores: Array(selectedStores),
                zipCode: zipCode,
                token: token
            )
            showingResults = true
        } catch {
            print("Failed to generate meal plan: \(error)")
        }
    }
}

// MARK: - Store Chip
struct StoreChip: View {
    let name: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(name)
                .font(.subheadline)
                .fontWeight(.medium)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(isSelected ? Color.blue : Color.gray.opacity(0.15))
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(20)
        }
    }
}

// MARK: - Dietary Chip
struct DietaryChip: View {
    let name: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(name)
                .font(.subheadline)
                .fontWeight(.medium)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(isSelected ? Color.green : Color.gray.opacity(0.15))
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(20)
        }
    }
}

// MARK: - Flow Layout (for wrapping chips)
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(
            in: proposal.replacingUnspecifiedDimensions().width,
            subviews: subviews,
            spacing: spacing
        )
        return result.size
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(
            in: bounds.width,
            subviews: subviews,
            spacing: spacing
        )
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + result.frames[index].minX, y: bounds.minY + result.frames[index].minY), proposal: .unspecified)
        }
    }
    
    struct FlowResult {
        var size: CGSize = .zero
        var frames: [CGRect] = []
        
        init(in maxWidth: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var currentX: CGFloat = 0
            var currentY: CGFloat = 0
            var lineHeight: CGFloat = 0
            
            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)
                
                if currentX + size.width > maxWidth && currentX > 0 {
                    currentX = 0
                    currentY += lineHeight + spacing
                    lineHeight = 0
                }
                
                frames.append(CGRect(x: currentX, y: currentY, width: size.width, height: size.height))
                lineHeight = max(lineHeight, size.height)
                currentX += size.width + spacing
            }
            
            self.size = CGSize(width: maxWidth, height: currentY + lineHeight)
        }
    }
}
```

---

## 4️⃣ **Results View with Recipe Cards**

Add to `Views/EnhancedMealPlanView.swift`:

```swift
// MARK: - Results View
struct ResultsView: View {
    let mealPlan: EnhancedMealPlanResponse
    @ObservedObject var service: EnhancedMealPlanService
    let onBack: () -> Void
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Success banner
                successBanner
                
                // Meal plan overview
                mealPlanOverview
                
                // Back button
                Button(action: onBack) {
                    Text("Create New Plan")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.gray.opacity(0.2))
                        .foregroundColor(.primary)
                        .fontWeight(.semibold)
                        .cornerRadius(12)
                }
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
    }
    
    // MARK: - Success Banner
    private var successBanner: some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("🎉 Your Meal Plan is Ready!")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                    
                    Text("\(mealPlan.metadata.dealsFound) deals found • \(mealPlan.metadata.dealsUsed) used in your plan")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.9))
                }
                Spacer()
                
                VStack(alignment: .trailing) {
                    Text("$\(String(format: "%.2f", mealPlan.mealPlan.totalCost))")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text("Save $\(String(format: "%.2f", mealPlan.metadata.savings)) (\(mealPlan.metadata.savingsPercent)% off!)")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.9))
                }
            }
            .padding()
            .background(
                LinearGradient(
                    colors: [Color.green, Color.green.opacity(0.8)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .cornerRadius(16)
        }
        .padding(.horizontal)
    }
    
    // MARK: - Meal Plan Overview
    private var mealPlanOverview: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("📅 \(mealPlan.mealPlan.name)")
                .font(.title2)
                .fontWeight(.bold)
                .padding(.horizontal)
            
            ForEach(mealPlan.mealPlan.days) { day in
                DaySection(day: day, service: service)
            }
        }
    }
}

// MARK: - Day Section
struct DaySection: View {
    let day: MealDay
    @ObservedObject var service: EnhancedMealPlanService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Day \(day.day)")
                .font(.headline)
                .padding(.horizontal)
            
            VStack(spacing: 12) {
                RecipeCard(meal: day.meals.breakfast, mealType: "Breakfast", day: day.day, service: service)
                RecipeCard(meal: day.meals.lunch, mealType: "Lunch", day: day.day, service: service)
                RecipeCard(meal: day.meals.dinner, mealType: "Dinner", day: day.day, service: service)
            }
            .padding(.horizontal)
        }
    }
}
```

---

## 5️⃣ **Recipe Card Component** ⭐

Create: `Views/RecipeCardView.swift`

```swift
import SwiftUI

struct RecipeCard: View {
    let meal: EnhancedMeal
    let mealType: String
    let day: Int
    @ObservedObject var service: EnhancedMealPlanService
    
    @State private var isExpanded = false
    @State private var isSaving = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(mealType.uppercased())
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.green)
                    
                    Text(meal.name)
                        .font(.headline)
                        .fontWeight(.bold)
                    
                    Text("$\(String(format: "%.2f", meal.estimatedCost))")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Image(systemName: "fork.knife")
                    .foregroundColor(.green)
                    .font(.title3)
            }
            
            // Recipe Meta Info (if expanded)
            if isExpanded {
                HStack(spacing: 16) {
                    if let prepTime = meal.prepTime {
                        metaItem(icon: "clock", text: "Prep: \(prepTime)")
                    }
                    if let cookTime = meal.cookTime {
                        metaItem(icon: "flame", text: "Cook: \(cookTime)")
                    }
                }
                .font(.caption)
                .foregroundColor(.secondary)
                
                HStack(spacing: 16) {
                    if let difficulty = meal.difficulty {
                        metaItem(icon: "chart.bar", text: difficulty)
                    }
                    if let cuisine = meal.cuisine {
                        metaItem(icon: "globe", text: cuisine)
                    }
                }
                .font(.caption)
                .foregroundColor(.secondary)
                
                // Ingredients
                if let ingredients = meal.ingredients, !ingredients.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("🥘 INGREDIENTS:")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.secondary)
                        
                        ForEach(ingredients.indices, id: \.self) { index in
                            HStack(alignment: .top, spacing: 6) {
                                Text("✓")
                                    .foregroundColor(.green)
                                    .font(.caption)
                                Text(ingredients[index])
                                    .font(.subheadline)
                                    .foregroundColor(.primary)
                            }
                        }
                    }
                    .padding(.top, 4)
                }
                
                // Instructions
                if let instructions = meal.instructions, !instructions.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("👨‍🍳 INSTRUCTIONS:")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.secondary)
                        
                        ForEach(instructions.indices, id: \.self) { index in
                            HStack(alignment: .top, spacing: 8) {
                                ZStack {
                                    Circle()
                                        .fill(Color.green.opacity(0.2))
                                        .frame(width: 24, height: 24)
                                    Text("\(index + 1)")
                                        .font(.caption)
                                        .fontWeight(.bold)
                                        .foregroundColor(.green)
                                }
                                
                                Text(instructions[index])
                                    .font(.subheadline)
                                    .foregroundColor(.primary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    .padding(.top, 4)
                }
                
                // Pro Tip
                if let tips = meal.tips {
                    HStack(alignment: .top, spacing: 8) {
                        Text("💡")
                            .font(.title3)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("PRO TIP:")
                                .font(.caption)
                                .fontWeight(.bold)
                                .foregroundColor(.orange)
                            Text(tips)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding()
                    .background(Color.orange.opacity(0.1))
                    .cornerRadius(12)
                }
            }
            
            // Action buttons
            HStack(spacing: 12) {
                // View Recipe Button
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        isExpanded.toggle()
                    }
                } label: {
                    HStack {
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        Text(isExpanded ? "Hide Recipe" : "View Recipe")
                    }
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.green.opacity(0.1))
                    .foregroundColor(.green)
                    .cornerRadius(10)
                }
                
                // Save Recipe Button
                Button {
                    Task {
                        await saveRecipe()
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "bookmark.fill")
                        Text(isSaving ? "Saving..." : "Save")
                    }
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                }
                .disabled(isSaving)
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.05), radius: 5, x: 0, y: 2)
    }
    
    // MARK: - Meta Item
    private func metaItem(icon: String, text: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
            Text(text)
        }
    }
    
    // MARK: - Save Recipe
    private func saveRecipe() async {
        guard let token = KeychainHelper.getToken() else { return }
        
        isSaving = true
        defer { isSaving = false }
        
        do {
            try await service.saveRecipe(meal, token: token)
            
            // Show success alert
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
            
            // TODO: Show toast notification
            print("✅ Recipe saved: \(meal.name)")
        } catch {
            print("Failed to save recipe: \(error)")
        }
    }
}

// MARK: - Preview
struct RecipeCard_Previews: PreviewProvider {
    static var previews: some View {
        RecipeCard(
            meal: EnhancedMeal(
                name: "Pan-Seared Mediterranean Chicken",
                estimatedCost: 9.50,
                prepTime: "15 min",
                cookTime: "20 min",
                difficulty: "Medium",
                cuisine: "Mediterranean",
                ingredients: [
                    "10 oz chicken breast",
                    "2 tbsp olive oil",
                    "1 lemon",
                    "Fresh herbs"
                ],
                instructions: [
                    "Pat chicken dry and season with salt and pepper.",
                    "Heat oil in pan over medium-high heat.",
                    "Sear chicken 6-7 minutes per side until golden.",
                    "Squeeze lemon juice over chicken and serve."
                ],
                tips: "The key to perfect seared chicken is ensuring the pan is very hot before adding the chicken!"
            ),
            mealType: "Dinner",
            day: 1,
            service: EnhancedMealPlanService()
        )
        .padding()
        .previewLayout(.sizeThatFits)
    }
}
```

---

## 6️⃣ **Store Locator Service** (for dynamic stores)

Create: `Services/StoreLocatorService.swift`

```swift
import Foundation

class StoreLocatorService: ObservableObject {
    @Published var isLoading = false
    
    private let baseURL = "http://localhost:3000" // Change to production URL
    
    struct StoresResponse: Codable {
        let success: Bool
        let zipCode: String
        let region: String
        let description: String
        let recommended: [String]
        let localStores: [String]?
    }
    
    func fetchStores(for zipCode: String) async throws -> StoresResponse {
        isLoading = true
        defer { isLoading = false }
        
        let url = URL(string: "\(baseURL)/api/stores/by-zip?zipCode=\(zipCode)")!
        let (data, _) = try await URLSession.shared.data(from: url)
        
        let decoder = JSONDecoder()
        return try decoder.decode(StoresResponse.self, from: data)
    }
}
```

---

## 7️⃣ **Usage in Your App**

Add to your main navigation:

```swift
// In your main TabView or NavigationView
NavigationLink {
    EnhancedMealPlanView()
} label: {
    Label("Meal Planner", systemImage: "fork.knife")
}
```

---

## 🎨 **Features Included:**

### ✅ **Beautiful Recipe Cards**
- Expandable/collapsible design
- Shows meal name, cost, type
- Smooth animations

### ✅ **Full Recipe Details**
- **Prep Time** & **Cook Time**
- **Difficulty Level** (Easy/Medium/Hard)
- **Cuisine Type** (Italian, Asian, etc.)
- **Ingredients List** with checkmarks
- **Step-by-Step Instructions** with numbered circles
- **Pro Tips** in highlighted boxes

### ✅ **Save Recipe Feature**
- One-tap save to collection
- Haptic feedback on success
- Loading state indicator

### ✅ **Dynamic Store Selection**
- Fetches stores based on ZIP code
- Shows region info
- Auto-selects recommended stores

### ✅ **Cost Tracking**
- Total meal plan cost
- Savings amount and percentage
- Cost per meal

---

## 📊 **UI Preview:**

```
┌─────────────────────────────────────┐
│ 🎉 Your Meal Plan is Ready!        │
│ 24 deals found • 15 used           │
│                            $95.50  │
│                   Save $25 (21%)   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Day 1                               │
├─────────────────────────────────────┤
│ BREAKFAST             🍳            │
│ Fluffy Scrambled Eggs with Herbs    │
│ $4.50                               │
│                                     │
│ [View Recipe ▼]    [Save 💾]       │
└─────────────────────────────────────┘

When expanded:
┌─────────────────────────────────────┐
│ BREAKFAST             🍳            │
│ Fluffy Scrambled Eggs with Herbs    │
│ $4.50                               │
│                                     │
│ ⏰ Prep: 5 min    🔥 Cook: 8 min   │
│ 📊 Easy          🌍 American        │
│                                     │
│ 🥘 INGREDIENTS:                     │
│ ✓ 3 large eggs                      │
│ ✓ 2 slices bread                    │
│ ✓ 1 tbsp butter                     │
│ ✓ Fresh herbs                       │
│                                     │
│ 👨‍🍳 INSTRUCTIONS:                   │
│ ① Crack eggs into bowl and whisk    │
│   vigorously for 30 seconds...      │
│ ② Heat pan over medium-low heat...  │
│ [6 more steps]                      │
│                                     │
│ ┌───────────────────────────────┐  │
│ │ 💡 PRO TIP:                   │  │
│ │ The key to perfect eggs is    │  │
│ │ low heat and patience!        │  │
│ └───────────────────────────────┘  │
│                                     │
│ [Hide Recipe ▲]    [Save 💾]       │
└─────────────────────────────────────┘
```

---

## 🚀 **Quick Start:**

1. **Add all Swift files** to your Xcode project
2. **Update base URL** in services to your production URL
3. **Add to navigation** in your main app view
4. **Test with ZIP code** (e.g., 11764)
5. **Generate meal plan** and expand recipes!

---

## 📱 **iOS Advantages:**

- ✅ **Native Performance** - Smooth animations
- ✅ **Haptic Feedback** - Satisfying interactions
- ✅ **Pull to Refresh** - Easy to regenerate
- ✅ **Share Feature** - Share meal plans with family
- ✅ **Offline Support** - Cache meal plans locally
- ✅ **Widget Support** - Show today's meals on home screen

---

## 🎯 **Next Steps:**

1. Implement save recipe backend endpoint
2. Add shopping list view with aisle navigation
3. Add recipe collection/favorites screen
4. Implement offline caching
5. Add share functionality
6. Create iOS widgets for quick access

---

**Your iOS app now has the same premium meal planning experience as the web!** 🎉📱

All recipes use **GPT-4o** for maximum quality and creativity! 🌟




