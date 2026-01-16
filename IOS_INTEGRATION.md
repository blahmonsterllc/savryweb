# Savry iOS App - Server Integration Guide

This guide explains how to integrate your iOS app with the Savry web server to securely use ChatGPT APIs.

## Why Server-Side API Calls?

**Security**: By moving ChatGPT API calls to the server, your OpenAI API key remains secure and cannot be extracted from the iOS app binary.

## Authentication Flow

### 1. User Login

**Endpoint**: `POST /api/app/auth`

**Request**:
```json
{
  "email": "user@example.com",
  "password": "userpassword"
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "tier": "PRO"
  }
}
```

**Swift Example**:
```swift
struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct AuthResponse: Codable {
    let token: String
    let user: User
}

struct User: Codable {
    let id: String
    let email: String
    let name: String?
    let tier: String
}

func login(email: String, password: String) async throws -> AuthResponse {
    let url = URL(string: "\(baseURL)/api/app/auth")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let body = LoginRequest(email: email, password: password)
    request.httpBody = try JSONEncoder().encode(body)
    
    let (data, _) = try await URLSession.shared.data(for: request)
    let response = try JSONDecoder().decode(AuthResponse.self, from: data)
    
    // Store token securely in Keychain
    KeychainHelper.save(token: response.token)
    
    return response
}
```

### 2. Include Token in All Requests

All subsequent API calls must include the JWT token in the Authorization header:

```swift
var request = URLRequest(url: url)
request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
```

## Recipe Generation

**Endpoint**: `POST /api/app/recipes/generate`

**Request**:
```json
{
  "ingredients": ["chicken", "broccoli", "rice"],
  "cuisine": "Asian",
  "dietaryRestrictions": ["gluten-free"],
  "cookingTime": 30,
  "servings": 4,
  "difficulty": "medium",
  "budget": 15.00
}
```

**Response**:
```json
{
  "recipe": {
    "id": "recipe_id",
    "name": "Asian Chicken Stir Fry",
    "description": "A delicious gluten-free chicken stir fry...",
    "ingredients": [
      {
        "name": "chicken breast",
        "quantity": "1",
        "unit": "lb"
      }
    ],
    "instructions": [
      "Cut chicken into bite-sized pieces...",
      "Heat oil in a wok..."
    ],
    "prepTime": 15,
    "cookTime": 15,
    "servings": 4,
    "calories": 350,
    "difficulty": "medium",
    "cuisine": "Asian",
    "dietaryTags": ["gluten-free"]
  },
  "cached": false
}
```

**Swift Example**:
```swift
struct RecipeRequest: Codable {
    let ingredients: [String]?
    let cuisine: String?
    let dietaryRestrictions: [String]?
    let cookingTime: Int?
    let servings: Int?
    let difficulty: String?
    let budget: Double?
}

struct RecipeResponse: Codable {
    let recipe: Recipe
    let cached: Bool
}

struct Recipe: Codable {
    let id: String
    let name: String
    let description: String?
    let ingredients: [Ingredient]
    let instructions: [String]
    let prepTime: Int?
    let cookTime: Int?
    let servings: Int?
    let calories: Int?
    let difficulty: String?
    let cuisine: String?
    let dietaryTags: [String]
}

struct Ingredient: Codable {
    let name: String
    let quantity: String
    let unit: String
}

func generateRecipe(params: RecipeRequest) async throws -> RecipeResponse {
    let url = URL(string: "\(baseURL)/api/app/recipes/generate")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(getToken())", forHTTPHeaderField: "Authorization")
    
    request.httpBody = try JSONEncoder().encode(params)
    
    let (data, _) = try await URLSession.shared.data(for: request)
    return try JSONDecoder().decode(RecipeResponse.self, from: data)
}
```

## Meal Plan Generation

**Endpoint**: `POST /api/app/meal-plans/generate`

**Request**:
```json
{
  "days": 7,
  "budget": 100.00,
  "dietaryRestrictions": ["vegetarian"],
  "startDate": "2024-12-09",
  "zipCode": "90210"
}
```

**Important**: 
- `budget` and `zipCode` are only available for Pro tier users
- Free tier users will receive a 403 error with `"upgrade": true` if they try to use these features

**Response**:
```json
{
  "mealPlan": {
    "id": "plan_id",
    "name": "Weekly Meal Plan",
    "startDate": "2024-12-09T00:00:00Z",
    "endDate": "2024-12-15T00:00:00Z",
    "budget": 100.00,
    "totalCost": 87.50,
    "recipes": [
      {
        "id": "recipe_id",
        "name": "Breakfast Recipe",
        "dayOfWeek": 0,
        "mealType": "BREAKFAST",
        ...
      }
    ]
  },
  "discountsUsed": 12
}
```

**Swift Example**:
```swift
struct MealPlanRequest: Codable {
    let days: Int
    let budget: Double?
    let dietaryRestrictions: [String]?
    let startDate: String?
    let zipCode: String?
}

func generateMealPlan(params: MealPlanRequest) async throws -> MealPlanResponse {
    let url = URL(string: "\(baseURL)/api/app/meal-plans/generate")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(getToken())", forHTTPHeaderField: "Authorization")
    
    request.httpBody = try JSONEncoder().encode(params)
    
    let (data, response) = try await URLSession.shared.data(for: request)
    
    // Handle Pro tier upgrade prompt
    if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 403 {
        let error = try JSONDecoder().decode(ErrorResponse.self, from: data)
        if error.upgrade == true {
            // Show upgrade prompt to user
            throw APIError.upgradeRequired(error.message)
        }
    }
    
    return try JSONDecoder().decode(MealPlanResponse.self, from: data)
}
```

## Grocery List Generation

**Endpoint**: `POST /api/app/grocery-list/generate`

**Request Option 1 - From Meal Plan**:
```json
{
  "mealPlanId": "plan_id"
}
```

**Request Option 2 - From Recipes**:
```json
{
  "recipeIds": ["recipe_id_1", "recipe_id_2", "recipe_id_3"]
}
```

**Response**:
```json
{
  "groceryList": {
    "id": "list_id",
    "name": "Grocery List for Meal Plan",
    "items": [
      {
        "name": "chicken breast",
        "quantity": "2",
        "unit": "lbs",
        "category": "Meat"
      },
      {
        "name": "broccoli",
        "quantity": "3",
        "unit": "cups",
        "category": "Produce"
      }
    ],
    "createdAt": "2024-12-05T12:00:00Z"
  }
}
```

## Data Sync

**Endpoint**: `GET /api/app/sync?lastSync=2024-12-01T00:00:00Z`

Use this to sync all user data between web and app.

**Response**:
```json
{
  "recipes": [...],
  "mealPlans": [...],
  "groceryLists": [...],
  "savedRecipes": [...],
  "syncTime": "2024-12-05T12:00:00Z"
}
```

**Swift Example**:
```swift
func syncData(lastSync: Date?) async throws -> SyncResponse {
    var urlString = "\(baseURL)/api/app/sync"
    if let lastSync = lastSync {
        let isoFormatter = ISO8601DateFormatter()
        urlString += "?lastSync=\(isoFormatter.string(from: lastSync))"
    }
    
    let url = URL(string: urlString)!
    var request = URLRequest(url: url)
    request.setValue("Bearer \(getToken())", forHTTPHeaderField: "Authorization")
    
    let (data, _) = try await URLSession.shared.data(for: request)
    return try JSONDecoder().decode(SyncResponse.self, from: data)
}
```

## Error Handling

### Common HTTP Status Codes

- `200` - Success
- `400` - Bad request (invalid input)
- `401` - Unauthorized (invalid or expired token)
- `403` - Forbidden (Pro feature for Free tier user)
- `404` - Resource not found
- `500` - Server error

### Error Response Format

```json
{
  "message": "Error description",
  "upgrade": true  // Only present when Pro tier is required
}
```

**Swift Error Handling**:
```swift
enum APIError: Error {
    case unauthorized
    case upgradeRequired(String)
    case invalidResponse
    case serverError(String)
}

func handleAPIError(response: HTTPURLResponse, data: Data) throws {
    switch response.statusCode {
    case 401:
        // Clear token and redirect to login
        KeychainHelper.deleteToken()
        throw APIError.unauthorized
        
    case 403:
        if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data),
           errorResponse.upgrade == true {
            throw APIError.upgradeRequired(errorResponse.message)
        }
        
    case 500...599:
        let message = String(data: data, encoding: .utf8) ?? "Server error"
        throw APIError.serverError(message)
        
    default:
        throw APIError.invalidResponse
    }
}
```

## Best Practices

### 1. Token Management
- Store JWT token in iOS Keychain
- Refresh token when it expires (30-day expiration)
- Clear token on logout

### 2. Caching
- Cache recipes locally to reduce API calls
- The server automatically returns cached popular recipes when available
- Sync data periodically (not on every app launch)

### 3. Loading States
- Show loading indicators during API calls
- Handle slow connections gracefully
- Implement retry logic for failed requests

### 4. Pro Tier Features
- Check user tier before showing Pro features
- Show upgrade prompts when users try to access Pro features
- Handle 403 errors with upgrade prompts

### 5. Offline Support
- Cache generated recipes locally
- Allow viewing saved recipes offline
- Queue sync operations when offline

## Testing

### Test Credentials
During development, create test accounts:
```
Free Tier: test@example.com / password123
Pro Tier: pro@example.com / password123
```

### Test Server
Development server: `http://localhost:3000`
Production server: `https://your-domain.com`

## Support

For integration issues or questions, contact the backend team.

## Security Notes

⚠️ **Important**:
- Never store the OpenAI API key in the iOS app
- Always use HTTPS in production
- Validate SSL certificates
- Don't log sensitive data (tokens, passwords)
- Use Keychain for token storage, never UserDefaults







