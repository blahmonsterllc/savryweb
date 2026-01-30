# 🚀 SERVER SIDE IMPLEMENTATION GUIDE

## 📋 What We're Building

A **video transcript caching + recipe database system** for the iOS recipe app that:

1. ✅ **Caches video transcripts** (TikTok, Instagram, YouTube) so you never transcribe the same video twice
2. ✅ **Builds a community recipe database** of every recipe imported through the app
3. ✅ **Saves 70-90% on transcription costs** by reusing cached transcripts
4. ✅ **Uses OpenAI Whisper API** for audio transcription (client already has OpenAI key)
5. ✅ **Tracks analytics** (popular recipes, cost savings, success rates)

---

## 🎯 The Problem We're Solving

**Current State:**
- Users share video recipes (TikTok, Instagram, YouTube)
- App needs to transcribe audio to extract recipe
- Every user transcribing the same video = wasted money ($0.05 per video)
- No centralized recipe database

**New System:**
```
User shares TikTok video URL
         ↓
Server checks: "Do we have this transcript cached?"
   → YES? Return cached transcript (FREE!) ✅
   → NO? Transcribe with OpenAI Whisper ($0.05)
         ↓
Save transcript to Firestore
         ↓
Return transcript to iOS app
         ↓
iOS app parses with existing SmartRecipeParser
         ↓
Save parsed recipe to community database
```

**Cost Savings Example:**
- Viral TikTok shared by 1,000 users
- Without cache: 1,000 × $0.05 = **$50**
- With cache: 1 × $0.05 = **$0.05**
- **Savings: $49.95 (99.9% cheaper!)**

---

## 📊 Firestore Collections to Create

### **Collection 1: `video_transcripts`**
**Purpose:** Cache video transcripts to avoid re-transcribing

```typescript
Document ID: "tiktok_7123456789" (platform_videoId)

{
  // Identifiers
  id: "tiktok_7123456789",
  videoUrl: "https://www.tiktok.com/@user/video/7123456789",
  platform: "tiktok",  // "tiktok" | "instagram" | "youtube"
  videoId: "7123456789",
  
  // Transcript data
  transcript: "First, mix 2 cups of flour with 1 cup of sugar...",
  transcriptSegments: [
    { text: "First, mix 2 cups of flour", start: 0, end: 3.5 },
    { text: "with 1 cup of sugar", start: 3.5, end: 6.2 }
  ],
  durationSeconds: 45,
  language: "en",
  
  // Metadata
  createdAt: Timestamp("2026-01-26T10:30:00Z"),
  updatedAt: Timestamp("2026-01-26T10:30:00Z"),
  accessCount: 1,  // Increments each time it's used
  lastAccessedAt: Timestamp("2026-01-26T10:30:00Z"),
  
  // Cost tracking
  transcriptionCost: 0.05
}
```

**Why:** If another user shares the same TikTok URL, we return cached transcript instantly (free).

---

### **Collection 2: `community_recipes`**
**Purpose:** Store ALL recipes imported through the app (builds valuable database)

```typescript
Document ID: Auto-generated (e.g., "abc123xyz")

{
  // Identifiers
  id: "abc123xyz",
  
  // Recipe content
  title: "Viral TikTok Pasta",
  description: "Creamy pasta recipe",
  cuisine: "Italian",
  difficulty: "easy",
  
  // Ingredients
  ingredients: [
    {
      name: "spaghetti",
      amount: "1",
      unit: "lb",
      preparation: ""
    },
    {
      name: "butter",
      amount: "4",
      unit: "tbsp",
      preparation: ""
    }
  ],
  
  // Instructions
  instructions: [
    { step: 1, text: "Boil pasta in salted water" },
    { step: 2, text: "Melt butter in pan" }
  ],
  
  // Nutrition (optional)
  nutrition: {
    calories: 450,
    protein: 15,
    carbs: 60,
    fat: 18,
    fiber: 3
  },
  
  // Serving info
  servings: 4,
  servingType: "servings",  // "servings" | "yields"
  yieldUnit: null,  // e.g., "cookies", "rolls" (if servingType is "yields")
  prepTime: 10,
  cookTime: 20,
  totalTime: 30,
  
  // Source tracking
  sourceType: "video",  // "video" | "website" | "blog" | "manual"
  sourcePlatform: "tiktok",  // "tiktok" | "instagram" | "youtube" | "pinterest" | null
  sourceUrl: "https://www.tiktok.com/@user/video/7123456789",
  sourceVideoId: "7123456789",
  
  // User who imported
  importedBy: "user_uid_123",
  importedByUsername: "cookielover99",
  
  // Metadata
  createdAt: Timestamp,
  updatedAt: Timestamp,
  importCount: 1,  // Increments if another user imports same recipe
  viewCount: 0,
  likeCount: 0,
  
  // Flags
  isPublic: true,
  isFeatured: false,
  isVerified: false,
  
  // Tags
  tags: ["pasta", "italian", "easy"],
  allergens: ["wheat", "dairy"],
  dietary: ["vegetarian"],
  
  // AI metadata
  extractionMethod: "whisper_ai",  // "whisper_ai" | "html_parser" | "json_ld"
  extractionConfidence: 0.95,
  
  // Images
  imageUrl: "https://storage.../pasta.jpg",
  thumbnailUrl: "https://storage.../pasta_thumb.jpg"
}
```

**Why:** 
- Track what recipes are popular
- Enable future features (recipe search, trending, recommendations)
- Build a valuable data asset
- Detect duplicates (if same sourceUrl, increment `importCount` instead of creating new)

---

### **Collection 3: `recipe_statistics`**
**Purpose:** Track daily stats (imports, costs, popular recipes)

```typescript
Document ID: "stats_2026-01-26" (stats_{date})

{
  date: "2026-01-26",
  
  // Import stats
  totalImports: 1247,
  successfulImports: 1189,
  failedImports: 58,
  successRate: 95.3,
  
  // Platform breakdown
  byPlatform: {
    tiktok: { count: 567, success: 540, failed: 27, cached: 412, transcribed: 155 },
    instagram: { count: 423, success: 405, failed: 18, cached: 301, transcribed: 122 },
    youtube: { count: 89, success: 87, failed: 2, cached: 50, transcribed: 39 },
    website: { count: 168, success: 157, failed: 11 }
  },
  
  // Transcription stats
  transcriptionsCreated: 316,  // New transcriptions today
  transcriptsCached: 931,  // Used cached transcriptions
  cacheHitRate: 74.7,  // Percentage
  
  // Cost tracking
  totalTranscriptionCost: 15.80,  // Money spent on new transcriptions
  transcriptionCostSaved: 46.55,  // Money saved from cache
  
  // Top recipes
  topRecipes: [
    { id: "abc123", title: "Viral TikTok Pasta", imports: 89 },
    { id: "xyz789", title: "Instagram Cookies", imports: 76 }
  ],
  
  // Popular cuisines
  topCuisines: {
    italian: 234,
    mexican: 189,
    american: 456
  },
  
  updatedAt: Timestamp
}
```

**Why:** Monitor system health, track costs, identify trends.

---

## 🚀 API Endpoints to Build

### **Priority 1: Video Transcript Caching**

#### **Endpoint 1: `/api/app/video/get-or-transcribe`**
**Method:** POST  
**Purpose:** Check cache or transcribe video

**Request:**
```typescript
{
  videoUrl: "https://www.tiktok.com/@user/video/7123456789",
  platform: "tiktok",  // "tiktok" | "instagram" | "youtube"
  userId: "user_uid_123"  // For tracking
}
```

**Response (Cache HIT):**
```typescript
{
  success: true,
  cached: true,  // 🎉 Found in cache!
  transcript: "First, mix 2 cups of flour...",
  segments: [
    { text: "First, mix 2 cups...", start: 0, end: 3.5 },
    { text: "with 1 cup of sugar", start: 3.5, end: 6.2 }
  ],
  videoId: "7123456789",
  cost: 0  // FREE!
}
```

**Response (Cache MISS - had to transcribe):**
```typescript
{
  success: true,
  cached: false,  // Had to transcribe
  transcript: "First, mix 2 cups of flour...",
  segments: [...],
  videoId: "7123456789",
  cost: 0.05  // Charged for transcription
}
```

**Implementation Steps:**
1. Extract video ID from URL (see helper functions below)
2. Check Firestore: `video_transcripts/{platform}_{videoId}`
3. If found:
   - Update `accessCount` (increment by 1)
   - Update `lastAccessedAt`
   - Return cached transcript
4. If NOT found:
   - Download video from URL
   - Extract audio using `ffmpeg`
   - Send audio to OpenAI Whisper API
   - Save transcript to Firestore
   - Return transcript

**Helper Functions Needed:**
```typescript
// Extract video ID from URL
function extractVideoId(url: string, platform: string): string {
  if (platform === 'tiktok') {
    // From: https://www.tiktok.com/@user/video/1234567890
    const match = url.match(/video\/(\d+)/);
    return match ? match[1] : url;
  } else if (platform === 'instagram') {
    // From: https://www.instagram.com/reel/ABC123/
    const match = url.match(/reel\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : url;
  } else if (platform === 'youtube') {
    // From: https://www.youtube.com/watch?v=ABC123
    const match = url.match(/[?&]v=([A-Za-z0-9_-]+)/);
    return match ? match[1] : url;
  }
  return url;
}

// Download video (you may need a service for TikTok/Instagram)
async function downloadVideo(url: string): Promise<string> {
  // Download video to temp file
  // Return path to video file
}

// Extract audio from video
async function extractAudio(videoPath: string): Promise<string> {
  // Use ffmpeg to extract audio
  // Return path to audio file (.m4a or .mp3)
}

// Transcribe with OpenAI Whisper
async function transcribeWithWhisper(audioPath: string) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment']
  });
  
  return {
    text: transcription.text,
    segments: transcription.segments,
    duration: transcription.duration,
    language: transcription.language
  };
}

// Calculate cost (Whisper: $0.006 per minute)
function calculateCost(durationSeconds: number): number {
  const minutes = durationSeconds / 60;
  return Math.round(minutes * 0.006 * 100) / 100;
}
```

---

### **Priority 2: Community Recipe Database**

#### **Endpoint 2: `/api/app/recipes/save-community-recipe`**
**Method:** POST  
**Purpose:** Save imported recipe to community database

**Request:**
```typescript
{
  recipe: {
    title: "Viral TikTok Pasta",
    description: "Creamy pasta",
    cuisine: "Italian",
    difficulty: "Easy",
    ingredients: [
      { name: "spaghetti", amount: "1", unit: "lb" },
      { name: "butter", amount: "4", unit: "tbsp" }
    ],
    instructions: [
      { step: 1, text: "Boil pasta" },
      { step: 2, text: "Melt butter" }
    ],
    servings: 4,
    servingType: "servings",
    yieldUnit: null,
    prepTime: 10,
    cookTime: 20,
    totalTime: 30,
    imageUrl: null
  },
  sourceType: "video",
  sourcePlatform: "tiktok",
  sourceUrl: "https://www.tiktok.com/@user/video/123",
  sourceVideoId: "123",
  userId: "user_uid_123",
  username: "cookielover99",
  isPublic: true,
  extractionMethod: "whisper_ai",
  extractionConfidence: 0.95
}
```

**Response:**
```typescript
{
  success: true,
  recipeId: "abc123xyz",
  existed: false,  // false = new recipe, true = already existed
  importCount: 1
}
```

**Implementation Steps:**
1. Check if recipe already exists (by `sourceUrl`)
2. If exists:
   - Increment `importCount`
   - Update `updatedAt`
   - Return existing recipe ID
3. If NOT exists:
   - Create new document in `community_recipes`
   - Set `importCount: 1`
   - Return new recipe ID
4. Update daily stats (`recipe_statistics`)

---

### **Priority 3: Analytics (Optional)**

#### **Endpoint 3: `/api/app/stats/daily`**
**Method:** GET  
**Purpose:** Get today's stats (for admin dashboard)

**Response:**
```typescript
{
  success: true,
  date: "2026-01-26",
  stats: {
    totalImports: 1247,
    successRate: 95.3,
    cacheHitRate: 74.7,
    costSaved: 46.55,
    topRecipes: [
      { title: "Viral Pasta", imports: 89 },
      { title: "Cookies", imports: 76 }
    ]
  }
}
```

---

## 📦 Dependencies Needed

```json
{
  "dependencies": {
    "openai": "^4.0.0",  // For Whisper API
    "fluent-ffmpeg": "^2.1.2",  // For audio extraction
    "axios": "^1.6.0",  // For downloading videos
    "@google-cloud/firestore": "^7.0.0"  // For Firestore
  }
}
```

---

## 🔧 Implementation Priority

### **Phase 1: Core Functionality (4-6 hours)**
1. Create 3 Firestore collections
2. Implement `/api/app/video/get-or-transcribe`
   - Cache check logic
   - OpenAI Whisper integration
   - Video download (may need TikTok/Instagram API)
3. Implement `/api/app/recipes/save-community-recipe`
4. Test with Postman

### **Phase 2: iOS Integration (2 hours)**
- iOS app already implemented (client side)
- Test end-to-end with real videos

### **Phase 3: Analytics (Optional, 2 hours)**
- Stats dashboard
- Cost tracking
- Popular recipes view

**Total Estimate: 6-10 hours**

---

## 🎯 Success Metrics

After implementation, you should see:

1. **Cache Hit Rate:** 70-80% within 1 month
2. **Cost Savings:** $200-400/month (at 10K imports/month)
3. **Recipe Database:** 10,000+ recipes within 6 months
4. **Import Success Rate:** 95%+

---

## 🚨 Important Notes

### **Video Download Challenge:**
- TikTok and Instagram don't provide direct video URLs
- You may need:
  - **Option 1:** Use a service like RapidAPI's TikTok downloader
  - **Option 2:** User provides video file directly (not just URL)
  - **Option 3:** Use TikTok/Instagram official APIs (requires approval)

### **Whisper API Limits:**
- File size limit: 25 MB
- If video is too large, extract shorter audio clip (first 2 minutes)

### **Security:**
- OpenAI API key stays on server (never exposed to iOS app)
- Use Firebase Auth to verify user tokens

---

## 📋 Testing Checklist

### **Test Cache System:**
- [ ] Submit TikTok URL (cache MISS - should transcribe)
- [ ] Submit same TikTok URL again (cache HIT - should be instant)
- [ ] Verify `accessCount` incremented in Firestore

### **Test Recipe Database:**
- [ ] Save recipe from video
- [ ] Save same recipe again (should increment `importCount`)
- [ ] Verify recipe appears in `community_recipes`

### **Test Stats:**
- [ ] Check `recipe_statistics` document created
- [ ] Verify counts are accurate
- [ ] Check cost tracking

---

## 🎉 Expected Results

**Month 1:**
- 1,000 videos imported
- 200 cached hits (20%)
- **$40 spent** on transcription (vs $50 without cache)

**Month 3:**
- 5,000 videos imported
- 3,500 cached hits (70%)
- **$75 spent** (vs $250 without cache)
- **$175 saved!**

**Month 6:**
- 10,000 videos imported
- 8,000 cached hits (80%)
- **$100 spent** (vs $500 without cache)
- **$400 saved per month!**

**Year 1 Total Savings: $3,000+**

---

## 📞 Questions?

If you need clarification on:
- API request/response formats
- Firestore structure
- OpenAI Whisper integration
- Video download strategies

Just ask! The iOS app is ready and waiting for your server APIs. 🚀
