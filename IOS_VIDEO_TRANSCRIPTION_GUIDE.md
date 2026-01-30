# 🎬 iOS Video Transcription Integration Guide

## 📋 What's New

Your server now has **OpenAI Whisper API with smart caching** for video transcription!

### ✅ Features:
1. **Transcribe video audio** from TikTok, Instagram, YouTube
2. **Cache transcripts** to avoid re-transcribing the same video
3. **70-90% cost savings** from caching
4. **Community recipe database** of all imported recipes
5. **Analytics dashboard** showing cache hit rates and savings

---

## 🚀 How It Works

```
User shares video URL in iOS app
         ↓
iOS extracts audio from video
         ↓
Send audio to server (base64 encoded)
         ↓
Server checks: "Is this video cached?"
   → YES? Return cached transcript (FREE!) ✅
   → NO? Transcribe with Whisper ($0.006/min)
         ↓
Server caches transcript for future use
         ↓
Return transcript to iOS app
         ↓
iOS parses transcript with SmartRecipeParser
         ↓
Save recipe to community database
```

---

## 📡 API Endpoints

### **1. Transcribe Video** (with caching)

**Endpoint:** `POST /api/app/video/get-or-transcribe`

**Request:**
```swift
struct TranscriptionRequest: Codable {
    let videoUrl: String
    let platform: String  // "tiktok" | "instagram" | "youtube"
    let audioData: String // Base64 encoded audio
    let userId: String
}
```

**Example:**
```swift
let request = TranscriptionRequest(
    videoUrl: "https://www.tiktok.com/@user/video/7123456789",
    platform: "tiktok",
    audioData: audioData.base64EncodedString(),
    userId: currentUser.id
)
```

**Response (Cache HIT):**
```json
{
  "success": true,
  "cached": true,
  "transcript": "First, mix 2 cups of flour with 1 cup of sugar...",
  "segments": [
    { "text": "First, mix 2 cups of flour", "start": 0, "end": 3.5 },
    { "text": "with 1 cup of sugar", "start": 3.5, "end": 6.2 }
  ],
  "videoId": "7123456789",
  "platform": "tiktok",
  "language": "en",
  "durationSeconds": 45,
  "cost": 0,
  "accessCount": 5,
  "message": "Transcript retrieved from cache (no charge)"
}
```

**Response (Cache MISS - transcribed):**
```json
{
  "success": true,
  "cached": false,
  "transcript": "First, mix 2 cups of flour...",
  "segments": [...],
  "videoId": "7123456789",
  "platform": "tiktok",
  "language": "en",
  "durationSeconds": 45,
  "cost": 0.0045,
  "transcriptionTimeMs": 3250,
  "message": "Video transcribed and cached for future use"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Audio file too large",
  "message": "Audio must be under 25 MB",
  "maxSizeMB": 25,
  "actualSizeMB": 32.5
}
```

---

### **2. Save Community Recipe**

**Endpoint:** `POST /api/app/recipes/save-community-recipe`

**Request:**
```swift
struct CommunityRecipeRequest: Codable {
    let recipe: Recipe
    let sourceType: String      // "video"
    let sourcePlatform: String  // "tiktok" | "instagram" | "youtube"
    let sourceUrl: String
    let sourceVideoId: String
    let userId: String
    let username: String
    let isPublic: Bool
    let extractionMethod: String
    let extractionConfidence: Double
}
```

**Example:**
```swift
let request = CommunityRecipeRequest(
    recipe: parsedRecipe,
    sourceType: "video",
    sourcePlatform: "tiktok",
    sourceUrl: "https://www.tiktok.com/@user/video/123",
    sourceVideoId: "123",
    userId: currentUser.id,
    username: currentUser.username,
    isPublic: true,
    extractionMethod: "whisper_ai",
    extractionConfidence: 0.95
)
```

**Response (New Recipe):**
```json
{
  "success": true,
  "recipeId": "abc123xyz",
  "existed": false,
  "importCount": 1,
  "message": "Recipe saved to community database"
}
```

**Response (Existing Recipe):**
```json
{
  "success": true,
  "recipeId": "abc123xyz",
  "existed": true,
  "importCount": 5,
  "message": "Recipe already in database. Import count incremented."
}
```

---

## 📱 iOS Implementation

### **Step 1: Extract Audio from Video**

```swift
import AVFoundation

class VideoProcessor {
    
    /// Extract audio from video URL
    func extractAudio(from videoURL: URL) async throws -> Data {
        let asset = AVAsset(url: videoURL)
        
        guard let audioTrack = try await asset.loadTracks(withMediaType: .audio).first else {
            throw VideoError.noAudioTrack
        }
        
        // Create export session
        guard let exportSession = AVAssetExportSession(
            asset: asset,
            presetName: AVAssetExportPresetAppleM4A
        ) else {
            throw VideoError.exportSessionFailed
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
        
        // Clean up
        try? FileManager.default.removeItem(at: outputURL)
        
        return audioData
    }
}

enum VideoError: Error {
    case noAudioTrack
    case exportSessionFailed
    case exportFailed
}
```

### **Step 2: Call Transcription API**

```swift
class TranscriptionService {
    private let baseURL = "https://savryweb.vercel.app"
    
    func transcribeVideo(
        videoUrl: String,
        platform: String,
        audioData: Data,
        userId: String,
        token: String
    ) async throws -> TranscriptionResponse {
        
        // Create request
        let url = URL(string: "\(baseURL)/api/app/video/get-or-transcribe")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
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
            throw NetworkError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            throw NetworkError.httpError(httpResponse.statusCode)
        }
        
        // Parse response
        let decoder = JSONDecoder()
        return try decoder.decode(TranscriptionResponse.self, from: data)
    }
}

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

### **Step 3: Parse Transcript into Recipe**

```swift
class SmartRecipeParser {
    
    func parseTranscript(_ transcript: String, segments: [TranscriptSegment]) async throws -> Recipe {
        // Use your existing SmartRecipeParser
        // Or implement a simple parser here
        
        // You can also send the transcript to your server's ChatGPT endpoint
        // to parse it into structured recipe data
        
        return try await parseWithChatGPT(transcript)
    }
    
    private func parseWithChatGPT(_ transcript: String) async throws -> Recipe {
        let prompt = """
        Parse this recipe transcript into structured JSON:
        
        \(transcript)
        
        Return JSON with: title, ingredients (name, amount, unit), instructions (steps), prepTime, cookTime, servings.
        """
        
        // Call your existing /api/app/chatgpt/generate endpoint
        // ...
    }
}
```

### **Step 4: Save to Community Database**

```swift
func saveCommunityRecipe(
    recipe: Recipe,
    videoUrl: String,
    videoId: String,
    platform: String,
    token: String
) async throws -> CommunityRecipeResponse {
    
    let url = URL(string: "https://savryweb.vercel.app/api/app/recipes/save-community-recipe")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let body: [String: Any] = [
        "recipe": recipe.toDictionary(),
        "sourceType": "video",
        "sourcePlatform": platform,
        "sourceUrl": videoUrl,
        "sourceVideoId": videoId,
        "userId": currentUser.id,
        "username": currentUser.username,
        "isPublic": true,
        "extractionMethod": "whisper_ai",
        "extractionConfidence": 0.95
    ]
    
    request.httpBody = try JSONSerialization.data(withJSONObject: body)
    
    let (data, _) = try await URLSession.shared.data(for: request)
    
    return try JSONDecoder().decode(CommunityRecipeResponse.self, from: data)
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

## 🎯 Complete Workflow Example

```swift
class RecipeImportViewController: UIViewController {
    
    func importRecipeFromVideo(url: String, platform: String) async {
        do {
            // 1. Show loading
            showLoading("Downloading video...")
            
            // 2. Download video (you may need a service for TikTok/Instagram)
            let videoURL = try await downloadVideo(from: url)
            
            showLoading("Extracting audio...")
            
            // 3. Extract audio
            let audioData = try await VideoProcessor().extractAudio(from: videoURL)
            
            showLoading("Transcribing...")
            
            // 4. Transcribe (with caching!)
            let transcription = try await TranscriptionService().transcribeVideo(
                videoUrl: url,
                platform: platform,
                audioData: audioData,
                userId: currentUser.id,
                token: authToken
            )
            
            // Show if cached
            if transcription.cached {
                showAlert("This video was already transcribed! (No charge)")
            } else {
                showAlert("Transcribed for $\(String(format: "%.4f", transcription.cost))")
            }
            
            showLoading("Parsing recipe...")
            
            // 5. Parse transcript into recipe
            let recipe = try await SmartRecipeParser().parseTranscript(
                transcription.transcript,
                segments: transcription.segments
            )
            
            showLoading("Saving to database...")
            
            // 6. Save to community database
            let result = try await saveCommunityRecipe(
                recipe: recipe,
                videoUrl: url,
                videoId: transcription.videoId,
                platform: platform,
                token: authToken
            )
            
            // 7. Save to user's personal recipes
            try await saveToUserRecipes(recipe)
            
            // 8. Show success
            hideLoading()
            showSuccess("Recipe imported successfully!")
            
            if result.existed {
                showAlert("This recipe has been imported by \(result.importCount) users!")
            }
            
        } catch {
            hideLoading()
            showError("Failed to import recipe: \(error.localizedDescription)")
        }
    }
}
```

---

## 💰 Cost Savings Example

### Without Caching:
```
Viral TikTok shared by 1,000 users
Each transcription: $0.005 (60 second video)
Total cost: 1,000 × $0.005 = $5.00
```

### With Caching (Your System):
```
Viral TikTok shared by 1,000 users
First transcription: $0.005
Next 999 requests: CACHED (FREE!)
Total cost: $0.005
Savings: $4.995 (99.9%)
```

### Real-World Scenario:
```
Month 1: 1,000 imports, 20% cache rate
Without cache: $5.00
With cache: $4.00
Savings: $1.00

Month 3: 5,000 imports, 70% cache rate
Without cache: $25.00
With cache: $7.50
Savings: $17.50

Year 1: 100,000 imports, 80% cache rate
Without cache: $500.00
With cache: $100.00
Savings: $400.00
```

---

## 📊 Admin Dashboard

View transcription analytics at:
**https://savryweb.vercel.app/admin**

You'll see:
- Total transcriptions
- Cache hit rate
- Cost spent vs saved
- Platform breakdown (TikTok, Instagram, YouTube)
- Daily trends
- Top cached videos (biggest savers!)

---

## ⚠️ Important Notes

### **File Size Limits:**
- OpenAI Whisper: 25 MB max
- If video is too long, extract first 2 minutes of audio
- Most cooking videos are under 2 minutes anyway

### **Video Download:**
TikTok and Instagram don't provide direct video URLs. You have 3 options:

**Option 1: User Provides Video File** (Recommended)
```swift
// Let user pick video from Photos library
let picker = UIImagePickerController()
picker.sourceType = .photoLibrary
picker.mediaTypes = [UTType.movie.identifier]
```

**Option 2: Use Third-Party API**
- RapidAPI TikTok downloader
- Instagram scraper services
- Requires additional API keys

**Option 3: Official APIs**
- TikTok API (requires approval)
- Instagram Graph API (requires Facebook app)

### **Audio Format:**
- Whisper supports: MP3, MP4, MPEG, MPGA, M4A, WAV, WEBM
- Recommended: M4A (best quality/size ratio)

### **Authentication:**
- All endpoints require JWT token
- Token must include `userId` and `email`
- Same token used for other AI Chef features

---

## 🧪 Testing

### Test Transcription API:
```bash
# Test with curl (replace TOKEN and AUDIO_BASE64)
curl -X POST https://savryweb.vercel.app/api/app/video/get-or-transcribe \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://www.tiktok.com/@user/video/123",
    "platform": "tiktok",
    "audioData": "BASE64_ENCODED_AUDIO",
    "userId": "test_user"
  }'
```

### Test Community Recipe Save:
```bash
curl -X POST https://savryweb.vercel.app/api/app/recipes/save-community-recipe \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipe": {
      "title": "Test Recipe",
      "ingredients": [{"name": "flour", "amount": "2", "unit": "cups"}],
      "instructions": [{"step": 1, "text": "Mix ingredients"}],
      "servings": 4
    },
    "sourceUrl": "https://www.tiktok.com/@user/video/123",
    "sourceType": "video",
    "sourcePlatform": "tiktok",
    "sourceVideoId": "123",
    "userId": "test_user",
    "username": "test",
    "isPublic": true
  }'
```

---

## 🎉 What You Get

### Server-Side:
- ✅ OpenAI Whisper integration
- ✅ Transcript caching (Firestore)
- ✅ Community recipe database
- ✅ Cost tracking & analytics
- ✅ Platform statistics
- ✅ Admin dashboard

### iOS-Side (You Need to Implement):
- [ ] Video picker/downloader
- [ ] Audio extraction (AVFoundation)
- [ ] API integration (see code above)
- [ ] Recipe parsing UI
- [ ] Success/error handling

---

## 📞 Need Help?

If you need clarification on:
- Audio extraction from videos
- Base64 encoding
- API integration
- Error handling
- Video download strategies

Just ask! The server is ready and waiting for your iOS app. 🚀

---

## 🚀 Next Steps

1. **Implement audio extraction** in iOS (AVFoundation)
2. **Call transcription API** with base64 audio
3. **Parse transcript** into recipe (use existing SmartRecipeParser or ChatGPT)
4. **Save to community database** for analytics
5. **Test with real TikTok/Instagram videos**
6. **Monitor cache hit rate** in admin dashboard
7. **Celebrate cost savings!** 💰

Your server is production-ready and will start caching transcripts as soon as iOS sends the first request!
