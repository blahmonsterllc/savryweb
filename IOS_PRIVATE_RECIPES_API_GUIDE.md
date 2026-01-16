# Savry iOS — Private Recipes REST API (No Firestore SDK in iOS)

This guide documents the **server REST API** you can use from your iOS app to **save private user recipes** in the server’s **Firestore** database, without integrating Firebase/Firestore SDKs into the iOS app.

## Goal

- ✅ iOS app sends recipes to your server
- ✅ Server stores recipes in Firestore `recipes` collection
- ✅ Recipes are **private** (owned by user, `isPublic=false`)
- ✅ Later you can add “publish” to create a shared/community database

---

## Authentication

All endpoints below require:

- Header: `Authorization: Bearer <JWT>`

You already have an auth endpoint in this repo:

- `POST /api/app/auth`

It returns a `token` you store in Keychain and send as Bearer.

---

## Base URL

- Dev: `http://localhost:3000`
- Prod: `https://your-domain.com`

---

## Endpoints

### 1) List my recipes

**GET** `/api/app/recipes?limit=20&cursor=2025-12-31T00:00:00.000Z`

- `limit` (optional): 1–50 (default 20)
- `cursor` (optional): ISO8601 string based on `updatedAt` for pagination

**Response (200)**:

```json
{
  "success": true,
  "recipes": [
    { "id": "abc123", "userId": "uid", "name": "Chicken Stir Fry", "isPublic": false }
  ],
  "nextCursor": "2025-12-31T00:00:00.000Z"
}
```

### 2) Create a private recipe

**POST** `/api/app/recipes`

**Body**:

```json
{
  "name": "Chicken Stir Fry",
  "description": "Fast weeknight dinner",
  "ingredients": [
    { "name": "chicken breast", "quantity": "1", "unit": "lb" },
    { "name": "broccoli", "quantity": "2", "unit": "cups" }
  ],
  "instructions": ["Cut chicken", "Cook chicken", "Add veggies"],
  "prepTime": 10,
  "cookTime": 15,
  "servings": 4,
  "calories": 450,
  "difficulty": "easy",
  "cuisine": "Asian",
  "dietaryTags": ["gluten-free"],
  "imageUrl": null,
  "estimatedCost": 12.5
}
```

**Response (201)**:

```json
{
  "success": true,
  "recipeId": "newRecipeId",
  "recipe": {
    "id": "newRecipeId",
    "userId": "uid",
    "name": "Chicken Stir Fry",
    "isPublic": false
  }
}
```

### 3) Get a recipe by id

**GET** `/api/app/recipes/:id`

**Response (200)**:

```json
{
  "success": true,
  "recipe": { "id": "abc123", "userId": "uid", "name": "Chicken Stir Fry" }
}
```

### 4) Update a recipe

**PATCH** `/api/app/recipes/:id`

You can send **any subset** of these fields:

```json
{
  "name": "Better Chicken Stir Fry",
  "dietaryTags": ["gluten-free", "dairy-free"]
}
```

**Response (200)**:

```json
{
  "success": true,
  "recipe": { "id": "abc123", "name": "Better Chicken Stir Fry" }
}
```

### 5) Delete a recipe

**DELETE** `/api/app/recipes/:id`

**Response (200)**:

```json
{ "success": true }
```

---

## Errors

- **401 Unauthorized**: missing/invalid token
- **403 Forbidden**: trying to access someone else’s recipe
- **404 Not Found**: recipe id doesn’t exist
- **400 Bad Request**: invalid JSON payload

Error body shape:

```json
{ "message": "Unauthorized" }
```

---

## Swift (copy/paste) — API client

### Models

```swift
import Foundation

struct APIErrorResponse: Codable {
    let message: String
}

struct RecipeIngredient: Codable {
    let name: String
    let quantity: String?
    let unit: String?
    let price: Double?
    let store: String?
    let onSale: Bool?
    let aisle: String?
    let section: String?
}

struct Recipe: Codable {
    let id: String?
    let userId: String?
    let name: String
    let description: String?
    let ingredients: [RecipeIngredient]?
    let instructions: [String]?
    let prepTime: Int?
    let cookTime: Int?
    let servings: Int?
    let calories: Int?
    let difficulty: String?
    let cuisine: String?
    let dietaryTags: [String]?
    let imageUrl: String?
    let estimatedCost: Double?
    let isPublic: Bool?
}

struct CreateRecipeRequest: Codable {
    let name: String
    let description: String?
    let ingredients: [RecipeIngredient]
    let instructions: [String]
    let prepTime: Int?
    let cookTime: Int?
    let servings: Int?
    let calories: Int?
    let difficulty: String?
    let cuisine: String?
    let dietaryTags: [String]?
    let imageUrl: String?
    let estimatedCost: Double?
}

struct CreateRecipeResponse: Codable {
    let success: Bool
    let recipeId: String
    let recipe: Recipe
}

struct ListRecipesResponse: Codable {
    let success: Bool
    let recipes: [Recipe]
    let nextCursor: String?
}

struct GetRecipeResponse: Codable {
    let success: Bool
    let recipe: Recipe
}

struct UpdateRecipeResponse: Codable {
    let success: Bool
    let recipe: Recipe
}
```

### API client

```swift
import Foundation

enum RecipesAPIError: Error {
    case missingToken
    case unauthorized
    case forbidden
    case notFound
    case badRequest(String)
    case serverError(String)
    case invalidResponse
}

final class RecipesAPI {
    private let baseURL: String
    private let urlSession: URLSession

    init(baseURL: String, urlSession: URLSession = .shared) {
        self.baseURL = baseURL
        self.urlSession = urlSession
    }

    private func token() throws -> String {
        guard let t = KeychainHelper.getToken(), !t.isEmpty else {
            throw RecipesAPIError.missingToken
        }
        return t
    }

    private func makeRequest(path: String, method: String) throws -> URLRequest {
        guard let url = URL(string: baseURL + path) else {
            throw RecipesAPIError.invalidResponse
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(try token())", forHTTPHeaderField: "Authorization")
        req.timeoutInterval = 30
        return req
    }

    private func mapError(_ http: HTTPURLResponse, data: Data) -> RecipesAPIError {
        let msg = (try? JSONDecoder().decode(APIErrorResponse.self, from: data).message)
            ?? String(data: data, encoding: .utf8)
            ?? "Request failed"

        switch http.statusCode {
        case 400: return .badRequest(msg)
        case 401: return .unauthorized
        case 403: return .forbidden
        case 404: return .notFound
        default: return .serverError(msg)
        }
    }

    func listRecipes(limit: Int = 20, cursor: String? = nil) async throws -> ListRecipesResponse {
        var path = "/api/app/recipes?limit=\(limit)"
        if let cursor = cursor?.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
            path += "&cursor=\(cursor)"
        }

        var req = try makeRequest(path: path, method: "GET")
        req.httpBody = nil

        let (data, resp) = try await urlSession.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw RecipesAPIError.invalidResponse }
        guard (200...299).contains(http.statusCode) else { throw mapError(http, data: data) }

        return try JSONDecoder().decode(ListRecipesResponse.self, from: data)
    }

    func createRecipe(_ body: CreateRecipeRequest) async throws -> CreateRecipeResponse {
        var req = try makeRequest(path: "/api/app/recipes", method: "POST")
        req.httpBody = try JSONEncoder().encode(body)

        let (data, resp) = try await urlSession.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw RecipesAPIError.invalidResponse }
        guard (200...299).contains(http.statusCode) else { throw mapError(http, data: data) }

        return try JSONDecoder().decode(CreateRecipeResponse.self, from: data)
    }

    func getRecipe(id: String) async throws -> GetRecipeResponse {
        let req = try makeRequest(path: "/api/app/recipes/\(id)", method: "GET")
        let (data, resp) = try await urlSession.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw RecipesAPIError.invalidResponse }
        guard (200...299).contains(http.statusCode) else { throw mapError(http, data: data) }
        return try JSONDecoder().decode(GetRecipeResponse.self, from: data)
    }

    func updateRecipe(id: String, patch: [String: Any]) async throws -> UpdateRecipeResponse {
        var req = try makeRequest(path: "/api/app/recipes/\(id)", method: "PATCH")
        req.httpBody = try JSONSerialization.data(withJSONObject: patch, options: [])

        let (data, resp) = try await urlSession.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw RecipesAPIError.invalidResponse }
        guard (200...299).contains(http.statusCode) else { throw mapError(http, data: data) }
        return try JSONDecoder().decode(UpdateRecipeResponse.self, from: data)
    }

    func deleteRecipe(id: String) async throws {
        let req = try makeRequest(path: "/api/app/recipes/\(id)", method: "DELETE")
        let (data, resp) = try await urlSession.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw RecipesAPIError.invalidResponse }
        guard (200...299).contains(http.statusCode) else { throw mapError(http, data: data) }
    }
}
```

---

## Where this is implemented in the server

- `pages/api/app/recipes/index.ts`
- `pages/api/app/recipes/[id].ts`

---

## Next (when you’re ready for shared/community recipes)

Add an endpoint like:

- `POST /api/app/recipes/:id/publish`

That flips `isPublic=true` (and optionally copies into a curated “community” collection). This is a good time to add moderation + rate limits.



