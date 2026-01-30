import { NextApiRequest, NextApiResponse } from 'next'
import { verifyJWT } from '@/lib/auth'
import {
  extractVideoId,
  getCachedTranscript,
  cacheTranscript,
  transcribeAudioWithWhisper,
  calculateTranscriptionCost,
  updateTranscriptionStats,
} from '@/lib/whisper-transcription'

/**
 * Video Transcription API with Caching
 * 
 * Workflow:
 * 1. Check if transcript is cached in Firestore
 * 2. If cached → return immediately (FREE!)
 * 3. If not cached → transcribe with Whisper, cache it, return
 * 
 * Cost Savings: 70-90% by reusing cached transcripts
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.replace('Bearer ', '')
    const decoded = await verifyJWT(token)

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Parse request
    const {
      videoUrl,
      platform,
      audioData, // Base64 encoded audio from iOS
      userId,
    } = req.body

    // Validate inputs
    if (!videoUrl || !platform) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['videoUrl', 'platform'],
      })
    }

    if (!['tiktok', 'instagram', 'youtube'].includes(platform)) {
      return res.status(400).json({
        error: 'Invalid platform',
        allowed: ['tiktok', 'instagram', 'youtube'],
      })
    }

    console.log(`\n🎬 Video transcription request:`)
    console.log(`  User: ${decoded.email}`)
    console.log(`  Platform: ${platform}`)
    console.log(`  URL: ${videoUrl}`)

    // Extract video ID
    const videoId = extractVideoId(videoUrl, platform)
    console.log(`  Video ID: ${videoId}`)

    // Step 1: Check cache
    console.log(`\n🔍 Checking cache for ${platform}_${videoId}...`)
    const cachedTranscript = await getCachedTranscript(platform, videoId)

    if (cachedTranscript) {
      // CACHE HIT! 🎉
      console.log(`✅ CACHE HIT! Returning cached transcript`)
      console.log(`   Access count: ${cachedTranscript.accessCount}`)
      console.log(`   Original cost: $${cachedTranscript.transcriptionCost}`)
      console.log(`   Cost saved: $${cachedTranscript.transcriptionCost}`)

      // Update stats (cached)
      await updateTranscriptionStats(platform, true, true, 0)

      return res.status(200).json({
        success: true,
        cached: true,
        transcript: cachedTranscript.transcript,
        segments: cachedTranscript.segments,
        videoId: cachedTranscript.videoId,
        platform: cachedTranscript.platform,
        language: cachedTranscript.language,
        durationSeconds: cachedTranscript.durationSeconds,
        cost: 0, // FREE!
        accessCount: cachedTranscript.accessCount,
        message: 'Transcript retrieved from cache (no charge)',
      })
    }

    // Step 2: Cache miss - need to transcribe
    console.log(`❌ Cache miss. Need to transcribe.`)

    if (!audioData) {
      return res.status(400).json({
        error: 'Audio data required',
        message: 'Video not in cache. Please provide audioData (base64 encoded audio)',
      })
    }

    console.log(`\n🎤 Transcribing audio with Whisper...`)

    // Decode base64 audio
    let audioBuffer: Buffer
    try {
      audioBuffer = Buffer.from(audioData, 'base64')
      console.log(`   Audio size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`)
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid audio data',
        message: 'audioData must be valid base64 encoded audio',
      })
    }

    // Check file size (Whisper limit: 25 MB)
    const maxSizeBytes = 25 * 1024 * 1024 // 25 MB
    if (audioBuffer.length > maxSizeBytes) {
      return res.status(400).json({
        error: 'Audio file too large',
        message: 'Audio must be under 25 MB. Please send a shorter clip.',
        maxSizeMB: 25,
        actualSizeMB: (audioBuffer.length / 1024 / 1024).toFixed(2),
      })
    }

    // Transcribe with Whisper
    const startTime = Date.now()
    const result = await transcribeAudioWithWhisper(audioBuffer, `${videoId}.m4a`)
    const transcriptionTime = Date.now() - startTime

    console.log(`✅ Transcription complete in ${transcriptionTime}ms`)
    console.log(`   Text length: ${result.text.length} chars`)
    console.log(`   Segments: ${result.segments.length}`)
    console.log(`   Duration: ${result.duration}s`)
    console.log(`   Language: ${result.language}`)

    // Calculate cost
    const cost = calculateTranscriptionCost(result.duration)
    console.log(`   Cost: $${cost}`)

    // Cache the transcript for future use
    await cacheTranscript(
      videoUrl,
      platform,
      videoId,
      result.text,
      result.segments,
      result.duration,
      result.language,
      cost
    )

    // Update stats (transcribed)
    await updateTranscriptionStats(platform, true, false, cost)

    console.log(`✅ Transcript cached successfully`)

    return res.status(200).json({
      success: true,
      cached: false,
      transcript: result.text,
      segments: result.segments,
      videoId,
      platform,
      language: result.language,
      durationSeconds: result.duration,
      cost,
      transcriptionTimeMs: transcriptionTime,
      message: 'Video transcribed and cached for future use',
    })
  } catch (error: any) {
    console.error('❌ Transcription error:', error)

    // Update stats (failed)
    try {
      const { platform } = req.body
      if (platform) {
        await updateTranscriptionStats(platform, false, false, 0)
      }
    } catch (statsError) {
      // Ignore stats errors
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Transcription failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
}
