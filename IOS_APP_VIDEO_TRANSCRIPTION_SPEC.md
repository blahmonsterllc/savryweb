# 🎬 iOS App - Video Transcription Integration Spec

**Version:** 1.0  
**Server URL:** `https://savryweb.vercel.app`  
**Status:** ✅ Server Deployed & Ready

---

## 📋 Overview

This document contains **everything your iOS app needs** to integrate video recipe transcription with server-side caching.

**What it does:**
- User selects video from camera roll (TikTok/Instagram/YouTube recipe)
- iOS extracts audio from video
- Sends audio to server for transcription
- Server checks cache (saves money!)
- Returns recipe transcript with timestamps
- iOS parses transcript into structured recipe
- Saves to community database

**Cost Savings:** 70-90% reduction in transcription costs through intelligent caching.

---

## 🔐 Authentication

**All endpoints require JWT authentication.**

Use the **same JWT token** you're already using for AI Chef endpoints.

**Header format:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Token should include:**
- `userId` - User's unique ID
- `email` - User's email
- `tier` - User tier ("FREE" | "PRO" | "PREMIUM")

---

## 📡 API Endpoint #1: Video Transcription

### **POST /api/app/video/get-or-transcribe**

**Full URL:** `https://savryweb.vercel.app/api/app/video/get-or-transcribe`

**Purpose:** Transcribe video audio with intelligent caching

**Rate Limits:**
- TestFlight users: 999 requests/month
- Free users: 2 requests/month
- Pro users: Unlimited

---

### **Request Format**

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "videoUrl": "https://www.tiktok.com/@user/video/7123456789",
  "platform": "tiktok",
  "audioData": "BASE64_ENCODED_AUDIO_HERE",
  "userId": "user_unique_id"
}
```

**Field Specifications:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `videoUrl` | string | Yes | Full URL of the video (TikTok/Instagram/YouTube) |
| `platform` | string | Yes | Must be: `"tiktok"`, `"instagram"`, or `"youtube"` |
| `audioData` | string | Yes | Base64 encoded audio file (M4A/MP3/WAV) |
| `userId` | string | Yes | Current user's ID for tracking |

**Audio Requirements:**
- **Format:** M4A, MP3, WAV, or WEBM
- **Max Size:** 25 MB (Whisper API limit)
- **Max Duration:** ~5 minutes (most recipes are 60-90 seconds)
- **Encoding:** Base64 string
- **Recommended:** Extract first 2 minutes if video is longer

---

### **Response Format**

#### **Success Response (Cache HIT):**

```json
{
  "success": true,
  "cached": true,
  "transcript": "First, mix 2 cups of flour with 1 cup of sugar. Then add 3 eggs and whisk until smooth...",
  "segments": [
    {
      "text": "First, mix 2 cups of flour with 1 cup of sugar.",
      "start": 0,
      "end": 3.5
    },
    {
      "text": "Then add 3 eggs and whisk until smooth.",
      "start": 3.5,
      "end": 7.2
    }
  ],
  "videoId": "7123456789",
  "platform": "tiktok",
  "language": "en",
  "durationSeconds": 45.5,
  "cost": 0,
  "accessCount": 15,
  "message": "Transcript retrieved from cache (no charge)"
}
```

**Key Fields:**
- `cached: true` - This video was already transcribed (FREE!)
- `cost: 0` - No charge for cached transcripts
- `accessCount: 15` - This video has been imported 15 times

---

#### **Success Response (Cache MISS - Transcribed):**

```json
{
  "success": true,
  "cached": false,
  "transcript": "First, mix 2 cups of flour...",
  "segments": [
    {
      "text": "First, mix 2 cups of flour with 1 cup of sugar.",
      "start": 0,
      "end": 3.5
    }
  ],
  "videoId": "7123456789",
  "platform": "tiktok",
  "language": "en",
  "durationSeconds": 45.5,
  "cost": 0.0045,
  "transcriptionTimeMs": 3250,
  "message": "Video transcribed and cached for future use"
}
```

**Key Fields:**
- `cached: false` - First time transcribing this video
- `cost: 0.0045` - Whisper API cost ($0.006 per minute)
- `transcriptionTimeMs: 3250` - Took 3.25 seconds to transcribe

---

#### **Error Responses:**

**401 Unauthorized:**
```json
{
  "error": "No token provided"
}
```
or
```json
{
  "error": "Invalid token"
}
```

**400 Bad Request - Missing Fields:**
```json
{
  "error": "Missing required fields",
  "required": ["videoUrl", "platform"]
}
```

**400 Bad Request - Invalid Platform:**
```json
{
  "error": "Invalid platform",
  "allowed": ["tiktok", "instagram", "youtube"]
}
```

**400 Bad Request - File Too Large:**
```json
{
  "success": false,
  "error": "Audio file too large",
  "message": "Audio must be under 25 MB. Please send a shorter clip.",
  "maxSizeMB": 25,
  "actualSizeMB": 32.5
}
```

**400 Bad Request - Audio Required:**
```json
{
  "error": "Audio data required",
  "message": "Video not in cache. Please provide audioData (base64 encoded audio)"
}
```

**500 Server Error:**
```json
{
  "success": false,
  "error": "Transcription failed",
  "message": "Whisper transcription failed: [error details]"
}
```

---

## 📡 API Endpoint #2: Save Community Recipe

### **POST /api/app/recipes/save-community-recipe**

**Full URL:** `https://savryweb.vercel.app/api/app/recipes/save-community-recipe`

**Purpose:** Save imported recipes to community database (deduplicates, tracks popularity)

---

### **Request Format**

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "recipe": {
    "title": "Viral TikTok Pasta",
    "description": "Creamy pasta recipe that went viral",
    "cuisine": "Italian",
    "difficulty": "Easy",
    "ingredients": [
      {
        "name": "spaghetti",
        "amount": "1",
        "unit": "lb",
        "preparation": ""
      },
      {
        "name": "butter",
        "amount": "4",
        "unit": "tbsp",
        "preparation": ""
      }
    ],
    "instructions": [
      {
        "step": 1,
        "text": "Boil pasta in salted water for 10 minutes"
      },
      {
        "step": 2,
        "text": "Melt butter in pan and add cooked pasta"
      }
    ],
    "servings": 4,
    "servingType": "servings",
    "yieldUnit": null,
    "prepTime": 10,
    "cookTime": 20,
    "totalTime": 30,
    "imageUrl": null,
    "tags": ["pasta", "easy", "viral"],
    "allergens": ["wheat", "dairy"],
    "dietary": ["vegetarian"]
  },
  "sourceType": "video",
  "sourcePlatform": "tiktok",
  "sourceUrl": "https://www.tiktok.com/@user/video/7123456789",
  "sourceVideoId": "7123456789",
  "userId": "user_unique_id",
  "username": "cookielover99",
  "isPublic": true,
  "extractionMethod": "whisper_ai",
  "extractionConfidence": 0.95
}
```

**Field Specifications:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `recipe` | object | Yes | Complete recipe object (see below) |
| `sourceType` | string | Yes | Always `"video"` for video imports |
| `sourcePlatform` | string | Yes | `"tiktok"`, `"instagram"`, or `"youtube"` |
| `sourceUrl` | string | Yes | Full video URL (used for deduplication) |
| `sourceVideoId` | string | Yes | Video ID extracted from URL |
| `userId` | string | Yes | Current user's ID |
| `username` | string | Yes | Current user's username/display name |
| `isPublic` | boolean | No | Default: `true` |
| `extractionMethod` | string | No | Default: `"whisper_ai"` |
| `extractionConfidence` | number | No | 0-1 confidence score |

**Recipe Object Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Recipe name |
| `description` | string | No | Brief description |
| `cuisine` | string | No | e.g., "Italian", "Mexican" |
| `difficulty` | string | No | "Easy", "Medium", "Hard" |
| `ingredients` | array | Yes | Array of ingredient objects |
| `instructions` | array | Yes | Array of instruction objects |
| `servings` | number | No | Number of servings |
| `servingType` | string | No | "servings" or "yields" |
| `prepTime` | number | No | Minutes |
| `cookTime` | number | No | Minutes |
| `totalTime` | number | No | Minutes |
| `tags` | array | No | Array of strings |
| `allergens` | array | No | Array of strings |
| `dietary` | array | No | Array of strings |

---

### **Response Format**

#### **Success (New Recipe):**

```json
{
  "success": true,
  "recipeId": "abc123xyz",
  "existed": false,
  "importCount": 1,
  "message": "Recipe saved to community database"
}
```

#### **Success (Existing Recipe):**

```json
{
  "success": true,
  "recipeId": "abc123xyz",
  "existed": true,
  "importCount": 15,
  "message": "Recipe already in database. Import count incremented."
}
```

**Key Fields:**
- `existed: true` - This recipe was already imported by another user
- `importCount: 15` - 15 users have imported this recipe
- **Use this to show popularity!** "This recipe has been imported by 15 other users!"

---

## 🔧 iOS Implementation

### **Step 1: Import UIKit & AVFoundation**

```swift
import UIKit
import AVFoundation
import UniformTypeIdentifiers
```

---

### **Step 2: Let User Pick Video from Camera Roll**

```swift
class RecipeImportViewController: UIViewController, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    
    func showVideoPicker() {
        let picker = UIImagePickerController()
        picker.delegate = self
        picker.sourceType = .photoLibrary
        picker.mediaTypes = [UTType.movie.identifier]
        picker.allowsEditing = false
        present(picker, animated: true)
    }
    
    func imagePickerController(
        _ picker: UIImagePickerController,
        didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]
    ) {
        picker.dismiss(animated: true)
        
        guard let videoURL = info[.mediaURL] as? URL else {
            showError("Failed to get video URL")
            return
        }
        
        // Process video
        Task {
            await processVideo(url: videoURL)
        }
    }
}
```

---

### **Step 3: Extract Audio from Video**

```swift
class VideoProcessor {
    
    enum VideoError: Error {
        case noAudioTrack
        case exportFailed
        case fileTooBig
    }
    
    /// Extract audio from video and return as Data
    func extractAudio(from videoURL: URL) async throws -> Data {
        let asset = AVAsset(url: videoURL)
        
        // Check for audio track
        guard let audioTrack = try await asset.loadTracks(withMediaType: .audio).first else {
            throw VideoError.noAudioTrack
        }
        
        // Create export session
        guard let exportSession = AVAssetExportSession(
            asset: asset,
            presetName: AVAssetExportPresetAppleM4A
        ) else {
            throw VideoError.exportFailed
        }
        
        // Configure export
        let outputURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("m4a")
        
        exportSession.outputURL = outputURL
        exportSession.outputFileType = .m4a
        
        // Export audio
        await exportSession.export()
        
        guard exportSession.status == .completed else {
            throw VideoError.exportFailed
        }
        
        // Read audio data
        let audioData = try Data(contentsOf: outputURL)
        
        // Check size (25 MB limit)
        let maxSize = 25 * 1024 * 1024 // 25 MB
        if audioData.count > maxSize {
            // Clean up
            try? FileManager.default.removeItem(at: outputURL)
            throw VideoError.fileTooBig
        }
        
        // Clean up temp file
        try? FileManager.default.removeItem(at: outputURL)
        
        return audioData
    }
}
```

---

### **Step 4: Transcription Service**

```swift
class TranscriptionService {
    
    private let baseURL = "https://savryweb.vercel.app"
    
    enum TranscriptionError: Error {
        case networkError(Error)
        case invalidResponse
        case serverError(String)
        case unauthorized
    }
    
    /// Transcribe video audio (checks cache first!)
    func transcribeVideo(
        videoUrl: String,
        platform: String,
        audioData: Data,
        userId: String,
        token: String
    ) async throws -> TranscriptionResponse {
        
        let url = URL(string: "\(baseURL)/api/app/video/get-or-transcribe")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 60 // Transcription can take time
        
        // Prepare body
        let body: [String: Any] = [
            "videoUrl": videoUrl,
            "platform": platform,
            "audioData": audioData.base64EncodedString(),
            "userId": userId
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        // Make request
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw TranscriptionError.invalidResponse
        }
        
        if httpResponse.statusCode == 401 {
            throw TranscriptionError.unauthorized
        }
        
        guard httpResponse.statusCode == 200 else {
            // Try to parse error message
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let errorMsg = json["error"] as? String {
                throw TranscriptionError.serverError(errorMsg)
            }
            throw TranscriptionError.serverError("HTTP \(httpResponse.statusCode)")
        }
        
        // Parse response
        let decoder = JSONDecoder()
        return try decoder.decode(TranscriptionResponse.self, from: data)
    }
}

// MARK: - Response Models

struct TranscriptionResponse: Codable {
    let success: Bool
    let cached: Bool
    let transcript: String
    let segments: [TranscriptSegment]
    let videoId: String
    let platform: String
    let language: String
    let durationSeconds: Double
    let cost: Double
    let accessCount: Int?
    let transcriptionTimeMs: Int?
    let message: String
}

struct TranscriptSegment: Codable {
    let text: String
    let start: Double
    let end: Double
}
```

---

### **Step 5: Save to Community Database**

```swift
extension TranscriptionService {
    
    /// Save recipe to community database
    func saveCommunityRecipe(
        recipe: Recipe,
        sourceUrl: String,
        sourceVideoId: String,
        sourcePlatform: String,
        userId: String,
        username: String,
        token: String
    ) async throws -> CommunityRecipeResponse {
        
        let url = URL(string: "\(baseURL)/api/app/recipes/save-community-recipe")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "recipe": recipe.toDictionary(),
            "sourceType": "video",
            "sourcePlatform": sourcePlatform,
            "sourceUrl": sourceUrl,
            "sourceVideoId": sourceVideoId,
            "userId": userId,
            "username": username,
            "isPublic": true,
            "extractionMethod": "whisper_ai",
            "extractionConfidence": 0.95
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw TranscriptionError.serverError("Failed to save recipe")
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(CommunityRecipeResponse.self, from: data)
    }
}

struct CommunityRecipeResponse: Codable {
    let success: Bool
    let recipeId: String
    let existed: Bool
    let importCount: Int
    let message: String
}
```

---

### **Step 6: Complete Import Workflow**

```swift
class RecipeImportViewController: UIViewController {
    
    private let videoProcessor = VideoProcessor()
    private let transcriptionService = TranscriptionService()
    private var currentUser: User!
    private var authToken: String!
    
    func processVideo(url: URL) async {
        do {
            // 1. Show loading
            await showLoading("Extracting audio...")
            
            // 2. Extract audio
            let audioData = try await videoProcessor.extractAudio(from: url)
            
            await updateLoading("Transcribing recipe...")
            
            // 3. Transcribe (with caching!)
            let transcription = try await transcriptionService.transcribeVideo(
                videoUrl: url.absoluteString,
                platform: detectPlatform(from: url),
                audioData: audioData,
                userId: currentUser.id,
                token: authToken
            )
            
            // 4. Show cache status
            if transcription.cached {
                await showAlert(
                    title: "Already Transcribed! 🎉",
                    message: "This video has been imported \(transcription.accessCount ?? 1) times. No charge!"
                )
            } else {
                await showAlert(
                    title: "Transcribed Successfully",
                    message: "Cost: $\(String(format: "%.4f", transcription.cost))"
                )
            }
            
            await updateLoading("Parsing recipe...")
            
            // 5. Parse transcript into recipe
            let recipe = try await parseTranscript(transcription.transcript)
            
            await updateLoading("Saving to database...")
            
            // 6. Save to community database
            let result = try await transcriptionService.saveCommunityRecipe(
                recipe: recipe,
                sourceUrl: url.absoluteString,
                sourceVideoId: transcription.videoId,
                sourcePlatform: transcription.platform,
                userId: currentUser.id,
                username: currentUser.username,
                token: authToken
            )
            
            // 7. Save to user's personal recipes
            try await saveToUserRecipes(recipe)
            
            // 8. Show success
            await hideLoading()
            
            var successMessage = "Recipe imported successfully!"
            if result.existed {
                successMessage += "\n\nThis recipe has been imported by \(result.importCount) users!"
            }
            
            await showSuccess(successMessage)
            
        } catch VideoProcessor.VideoError.noAudioTrack {
            await showError("This video has no audio track")
        } catch VideoProcessor.VideoError.fileTooBig {
            await showError("Video is too long. Please use a shorter video (under 5 minutes)")
        } catch TranscriptionService.TranscriptionError.unauthorized {
            await showError("Authentication failed. Please log in again.")
        } catch {
            await showError("Import failed: \(error.localizedDescription)")
        }
    }
    
    // Helper: Detect platform from URL
    private func detectPlatform(from url: URL) -> String {
        let urlString = url.absoluteString.lowercased()
        
        if urlString.contains("tiktok.com") {
            return "tiktok"
        } else if urlString.contains("instagram.com") {
            return "instagram"
        } else if urlString.contains("youtube.com") || urlString.contains("youtu.be") {
            return "youtube"
        } else {
            return "tiktok" // Default
        }
    }
}
```

---

## 🎨 UI/UX Recommendations

### **Show Cache Status:**

```swift
// When cached:
"🎉 This recipe was already imported by 15 other users! (No charge)"

// When transcribed:
"✅ Recipe transcribed successfully! (Cost: $0.006)"
```

### **Import Instructions:**

```swift
"""
Import Recipe from Video

1. Save the video to your camera roll
   (Use TikTok/Instagram's "Save" button)
   
2. Tap "Select Video" below

3. We'll transcribe it for you!

Note: Repeated imports are FREE thanks to smart caching!
"""
```

### **Loading States:**

```swift
"Extracting audio..." // 1-2 seconds
"Transcribing recipe..." // 3-10 seconds
"Parsing ingredients..." // 1-2 seconds
"Saving to database..." // 1-2 seconds
```

---

## ⚠️ Legal Compliance

### **✅ DO:**
- Let user pick video from camera roll
- Show clear instructions to download manually first
- Respect platform terms of service

### **❌ DON'T:**
- Automatically download videos from TikTok/Instagram
- Scrape video URLs without user action
- Bypass platform APIs

### **App Copy Example:**

```
⚖️ Legal Notice

We respect TikTok, Instagram, and YouTube's terms of service.

Please manually download videos to your camera roll first, 
then import them here. We do not automatically download 
videos from social media platforms.
```

---

## 🧪 Testing

### **Test Cases:**

1. **First Import (Cache Miss):**
   - Import new video
   - Should transcribe
   - Should show cost
   - Should cache transcript

2. **Second Import (Cache Hit):**
   - Import same video again
   - Should return instantly
   - Should show "cached" message
   - Should show $0 cost

3. **Error Cases:**
   - Video with no audio → Should show error
   - Video too long → Should show error
   - Invalid auth token → Should show login prompt
   - Network error → Should retry

---

## 📊 Analytics to Track

### **Suggested Metrics:**

```swift
// Track in your analytics
analytics.track("video_import_started", properties: [
    "platform": "tiktok",
    "video_duration": 45.5
])

analytics.track("video_transcription_complete", properties: [
    "cached": true,
    "cost": 0.0,
    "transcription_time_ms": 150,
    "access_count": 15
])

analytics.track("community_recipe_saved", properties: [
    "recipe_id": "abc123",
    "existed": true,
    "import_count": 15
])
```

---

## 🐛 Error Handling

### **Common Errors & Solutions:**

| Error | Cause | Solution |
|-------|-------|----------|
| `noAudioTrack` | Video has no audio | Show error, ask for different video |
| `fileTooBig` | Audio > 25 MB | Extract shorter clip or compress |
| `unauthorized` | Invalid/expired token | Refresh auth token |
| `networkError` | No internet | Show retry button |
| `serverError` | Server issue | Show error, contact support |

---

## 📱 Complete Example Flow

```swift
// 1. User taps "Import from Video"
@IBAction func importVideoTapped() {
    showVideoPicker()
}

// 2. User selects video
func imagePickerController(...) {
    Task {
        await processVideo(url: videoURL)
    }
}

// 3. Extract audio
let audioData = try await videoProcessor.extractAudio(from: url)

// 4. Transcribe (cached or new)
let transcription = try await transcriptionService.transcribeVideo(...)

// 5. Show cache status
if transcription.cached {
    showAlert("This video was already transcribed! Free!")
}

// 6. Parse recipe
let recipe = try await parseTranscript(transcription.transcript)

// 7. Save to community DB
let result = try await saveCommunityRecipe(...)

// 8. Show success
showSuccess("Recipe imported! \(result.importCount) users have imported this.")
```

---

## 🎯 Summary Checklist

### **iOS Implementation:**
- [ ] Add video picker (UIImagePickerController)
- [ ] Implement audio extraction (AVFoundation)
- [ ] Add transcription service (URLSession)
- [ ] Implement community recipe save
- [ ] Add loading states
- [ ] Handle errors gracefully
- [ ] Show cache status to user
- [ ] Track analytics

### **Server Configuration:**
- [x] Whisper API integrated
- [x] Caching system active
- [x] API endpoints deployed
- [x] Authentication configured
- [x] Rate limiting enabled

### **Legal Compliance:**
- [ ] User downloads videos manually
- [ ] No automatic scraping
- [ ] Clear instructions in app
- [ ] Terms of service respected

---

## 🚀 Ready to Integrate!

**Server Status:** ✅ LIVE  
**API Base URL:** `https://savryweb.vercel.app`  
**Auth:** Use existing JWT token  
**Cost:** $0.006 per minute (70-90% savings from caching)

Everything is deployed and waiting for your iOS app! 🎉
