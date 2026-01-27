# 📱 iOS App Production Setup Guide

## Overview

This guide will help you connect your Savry iOS app to the production backend deployed on Vercel.

**Production Backend URL:** `https://savryweb.vercel.app`

---

## 🔧 Configuration Steps

### 1. Update API Base URL in Xcode

You need to update the `baseURL` in all your networking service files.

**Files to Update:**
- `SmartMealPlanService.swift`
- `SmartRecipeService.swift`
- `RecipesAPI.swift`
- `SyncService.swift`
- `NetworkManager.swift` (or similar)
- Any other files that make API calls

**Change from:**
```swift
private let baseURL = "http://localhost:3000"  // Development
```

**Change to:**
```swift
private let baseURL = "https://savryweb.vercel.app"  // Production
```

**Or use conditional compilation for easier development:**
```swift
#if DEBUG
private let baseURL = "http://localhost:3000"  // Local development
#else
private let baseURL = "https://savryweb.vercel.app"  // Production
#endif
```

---

### 2. JWT Authentication Setup

Your iOS app needs to send JWT tokens with each API request to authenticate users.

#### Option A: Implement Login Flow (Recommended for Production)

**1. Create a login endpoint call:**

```swift
struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct LoginResponse: Codable {
    let token: String
    let userId: String
    let email: String
    let tier: String // "FREE", "PRO", or "PREMIUM"
}

func login(email: String, password: String) async throws -> LoginResponse {
    let url = URL(string: "\(baseURL)/api/app/auth")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let loginData = LoginRequest(email: email, password: password)
    request.httpBody = try JSONEncoder().encode(loginData)
    
    let (data, _) = try await URLSession.shared.data(for: request)
    return try JSONDecoder().decode(LoginResponse.self, from: data)
}
```

**2. Store the token securely:**

```swift
import Security

class TokenManager {
    static let shared = TokenManager()
    
    func saveToken(_ token: String) {
        KeychainHelper.save(token, forKey: "userJWTToken")
        // Or use UserDefaults for development (less secure)
        // UserDefaults.standard.set(token, forKey: "userJWTToken")
    }
    
    func getToken() -> String? {
        return KeychainHelper.load(forKey: "userJWTToken")
        // Or: UserDefaults.standard.string(forKey: "userJWTToken")
    }
    
    func deleteToken() {
        KeychainHelper.delete(forKey: "userJWTToken")
    }
}
```

**3. Add token to all API requests:**

```swift
var request = URLRequest(url: url)
if let token = TokenManager.shared.getToken() {
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
}
```

#### Option B: Retrieve JWT_SECRET (Development/Testing Only)

⚠️ **WARNING:** Never ship your app with the JWT_SECRET hardcoded!

To get your JWT_SECRET for testing:
```bash
cd /Users/gordonlafler/Desktop/savryiowebsite
npx vercel env pull .env.production
cat .env.production | grep JWT_SECRET
```

You can use this to generate test tokens locally, but implement Option A before releasing to users.

---

### 3. Firebase Configuration

Your iOS app uses Firebase for storing user data, recipes, and meal plans.

**Firebase Project Details:**
```
Project ID: savry-13adf
```

**Setup in Xcode:**
1. Make sure `GoogleService-Info.plist` is in your Xcode project
2. Verify the project ID matches: `savry-13adf`
3. Initialize Firebase in your AppDelegate or App struct:

```swift
import Firebase

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

## 📡 Available API Endpoints

All endpoints are prefixed with: `https://savryweb.vercel.app`

### Authentication
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/app/auth` | Login and get JWT token | No |

**Example Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

---

### Recipes

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/app/recipes` | Get all user's recipes | Yes |
| GET | `/api/app/recipes/[id]` | Get specific recipe | Yes |
| POST | `/api/app/recipes` | Create new recipe | Yes |
| PUT | `/api/app/recipes/[id]` | Update recipe | Yes |
| DELETE | `/api/app/recipes/[id]` | Delete recipe | Yes |
| POST | `/api/app/recipes/generate` | AI generate recipe (basic) | Yes |
| POST | `/api/app/recipes/smart-generate` | AI generate recipe with deals | Yes (Pro) |

**Smart Recipe Generation Request:**
```json
{
  "ingredients": ["chicken", "rice", "broccoli"],
  "zipCode": "78701",
  "servings": 4,
  "dietaryRestrictions": ["gluten-free"],
  "preferredStores": ["Kroger", "Walmart"]
}
```

---

### Meal Plans

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/app/meal-plans/generate` | Generate basic meal plan | Yes |
| POST | `/api/app/meal-plans/smart-generate` | Generate meal plan with deals | Yes (Pro) |

**Smart Meal Plan Generation Request:**
```json
{
  "days": 7,
  "servings": 4,
  "budget": 100,
  "zipCode": "78701",
  "preferredStores": ["Kroger", "Walmart", "Target"],
  "dietaryRestrictions": ["vegetarian"],
  "excludeIngredients": ["mushrooms"]
}
```

---

### Shopping Lists

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/app/grocery-list/generate` | Generate shopping list from recipes | Yes |
| GET | `/api/app/grocery-list/locations` | Get aisle locations for items | Yes |

---

### Stores & Deals

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/stores/by-zip?zipCode={zip}` | Get stores near zip code | No |
| GET | `/api/discounts/{location}` | Get deals (currently disabled) | No |

---

### Firebase Sync Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/sync/recipes` | Backup recipe to server | Yes |
| GET | `/api/sync/recipes/[recipeId]` | Get recipe from server | Yes |
| DELETE | `/api/sync/recipes/[recipeId]` | Delete synced recipe | Yes |
| POST | `/api/sync/meal-plans` | Backup meal plan | Yes |
| POST | `/api/sync/user` | Sync user data | Yes |
| PUT | `/api/sync/user/preferences` | Update user preferences | Yes |
| PUT | `/api/sync/shopping-lists/[listId]/items/[itemId]` | Update shopping list item | Yes |

---

## 🔨 Example Network Manager Implementation

Here's a complete network manager you can use:

```swift
import Foundation

enum NetworkError: Error, LocalizedError {
    case invalidURL
    case unauthorized
    case serverError(String)
    case decodingError
    case noData
    
    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .unauthorized: return "Unauthorized - please login"
        case .serverError(let msg): return msg
        case .decodingError: return "Failed to decode response"
        case .noData: return "No data received"
        }
    }
}

class NetworkManager {
    static let shared = NetworkManager()
    
    // MARK: - Configuration
    #if DEBUG
    private let baseURL = "http://localhost:3000"  // Local development
    #else
    private let baseURL = "https://savryweb.vercel.app"  // Production
    #endif
    
    private init() {}
    
    // MARK: - Token Management
    private var jwtToken: String? {
        TokenManager.shared.getToken()
    }
    
    // MARK: - Generic Request Method
    func request<T: Decodable>(
        endpoint: String,
        method: String = "GET",
        body: Encodable? = nil,
        requiresAuth: Bool = true
    ) async throws -> T {
        // Build URL
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw NetworkError.invalidURL
        }
        
        // Create request
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add authentication header
        if requiresAuth {
            guard let token = jwtToken else {
                throw NetworkError.unauthorized
            }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        // Add body if provided
        if let body = body {
            request.httpBody = try JSONEncoder().encode(body)
        }
        
        // Make request
        let (data, response) = try await URLSession.shared.data(for: request)
        
        // Check response
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.serverError("Invalid response")
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            if httpResponse.statusCode == 401 {
                throw NetworkError.unauthorized
            }
            
            // Try to decode error message
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw NetworkError.serverError(errorResponse.message)
            }
            
            throw NetworkError.serverError("HTTP \(httpResponse.statusCode)")
        }
        
        // Decode response
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            print("Decoding error: \(error)")
            throw NetworkError.decodingError
        }
    }
}

// MARK: - Error Response Model
struct ErrorResponse: Codable {
    let message: String
}
```

---

## 🧪 Testing Your Integration

### Test with cURL

Before testing in your iOS app, verify endpoints work with cURL:

```bash
# 1. Test health check (no auth required)
curl https://savryweb.vercel.app/api/health

# 2. Test stores by zip (no auth required)
curl "https://savryweb.vercel.app/api/stores/by-zip?zipCode=78701"

# 3. Test authenticated endpoint (replace YOUR_TOKEN)
curl -X GET https://savryweb.vercel.app/api/app/recipes \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Test recipe generation (replace YOUR_TOKEN)
curl -X POST https://savryweb.vercel.app/api/app/recipes/smart-generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ingredients": ["chicken", "rice", "broccoli"],
    "zipCode": "78701",
    "servings": 4
  }'
```

### Test in Xcode Simulator

1. Build and run your app in the simulator
2. Try logging in (if you have login implemented)
3. Test each feature:
   - Recipe generation
   - Meal plan generation
   - Shopping list generation
   - Recipe sync

### TestFlight Testing

Before releasing to production:
1. Build and upload to TestFlight
2. Test on real devices
3. Verify all API calls work over cellular and WiFi
4. Check error handling
5. Test with different user tiers (Free, Pro)

---

## ✅ Pre-Launch Checklist

- [ ] All `localhost:3000` replaced with `savryweb.vercel.app`
- [ ] JWT authentication implemented and tested
- [ ] Token stored securely (KeyChain, not hardcoded)
- [ ] All API endpoints tested with production backend
- [ ] Firebase sync working correctly
- [ ] Error handling implemented for network failures
- [ ] Tested on real devices via TestFlight
- [ ] Pro features properly gated (check user tier)
- [ ] Privacy Policy and Terms updated in app
- [ ] Analytics/crash reporting configured

---

## 🆘 Troubleshooting

### "Unauthorized" errors
- Check that JWT token is being sent with requests
- Verify token format: `Bearer {token}`
- Check token expiration (tokens expire after 30 days)
- Implement token refresh logic

### "Invalid token" errors
- Token may be expired - implement re-login
- JWT_SECRET may have changed - get new token
- Token format incorrect - should be `Bearer {token}`

### Network request failures
- Check internet connectivity
- Verify URL is correct: `https://savryweb.vercel.app`
- Check Vercel deployment status
- Look at network logs in Xcode debugger

### Firebase errors
- Verify `GoogleService-Info.plist` is in project
- Check project ID matches: `savry-13adf`
- Ensure Firebase is initialized before use
- Check Firebase console for any issues

### CORS errors
- Should not happen with native iOS apps
- If testing in web view, CORS may apply
- Native URLSession requests bypass CORS

---

## 📞 Support

If you need help:
1. Check the admin dashboard: `https://savryweb.vercel.app/admin`
2. View API health: `https://savryweb.vercel.app/health`
3. Check Vercel deployment logs
4. Review error messages in Xcode console

---

## 📚 Additional Documentation

- [Complete iOS Integration Guide](./COMPLETE_IOS_INTEGRATION_GUIDE.md)
- [Smart Meal Planner](./IOS_SMART_MEAL_PLANNER.md)
- [Smart Recipe Generator](./IOS_SMART_RECIPE_GENERATOR.md)
- [Firebase Sync Guide](./CROSS_PLATFORM_SYNC_GUIDE.md)
- [Server Architecture](./SERVER_SIDE_CHATGPT_ARCHITECTURE.md)

---

**Last Updated:** January 27, 2026  
**Backend Version:** Production (Vercel)  
**Base URL:** `https://savryweb.vercel.app`
