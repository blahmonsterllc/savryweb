import OpenAI, { toFile } from 'openai'
import { db } from './firebase'
import { Timestamp } from 'firebase-admin/firestore'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface TranscriptSegment {
  text: string
  start: number
  end: number
}

export interface VideoTranscript {
  id: string
  videoUrl: string
  platform: 'tiktok' | 'instagram' | 'youtube'
  videoId: string
  transcript: string
  segments: TranscriptSegment[]
  durationSeconds: number
  language: string
  createdAt: Date
  updatedAt: Date
  accessCount: number
  lastAccessedAt: Date
  transcriptionCost: number
}

/**
 * Extract video ID from URL
 */
export function extractVideoId(url: string, platform: string): string {
  try {
    if (platform === 'tiktok') {
      // From: https://www.tiktok.com/@user/video/1234567890
      const match = url.match(/video\/(\d+)/)
      return match ? match[1] : url
    } else if (platform === 'instagram') {
      // From: https://www.instagram.com/reel/ABC123/
      const match = url.match(/reel\/([A-Za-z0-9_-]+)/)
      return match ? match[1] : url
    } else if (platform === 'youtube') {
      // From: https://www.youtube.com/watch?v=ABC123 or https://youtu.be/ABC123
      const match = url.match(/(?:watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/)
      return match ? match[1] : url
    }
    return url
  } catch (error) {
    console.error('Error extracting video ID:', error)
    return url
  }
}

/**
 * Calculate Whisper transcription cost
 * OpenAI Whisper: $0.006 per minute
 */
export function calculateTranscriptionCost(durationSeconds: number): number {
  const minutes = durationSeconds / 60
  return Math.round(minutes * 0.006 * 100) / 100
}

/**
 * Get cached transcript from Firestore
 */
export async function getCachedTranscript(
  platform: string,
  videoId: string
): Promise<VideoTranscript | null> {
  try {
    const docId = `${platform}_${videoId}`
    const docRef = db.collection('video_transcripts').doc(docId)
    const docSnap = await docRef.get()

    if (!docSnap.exists) {
      return null
    }

    const data = docSnap.data()
    if (!data) {
      return null
    }

    // Update access count
    await docRef.update({
      accessCount: (data.accessCount || 0) + 1,
      lastAccessedAt: new Date(),
    })

    return {
      id: docSnap.id,
      videoUrl: data.videoUrl,
      platform: data.platform,
      videoId: data.videoId,
      transcript: data.transcript,
      segments: data.segments || [],
      durationSeconds: data.durationSeconds || 0,
      language: data.language || 'en',
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      accessCount: (data.accessCount || 0) + 1,
      lastAccessedAt: new Date(),
      transcriptionCost: data.transcriptionCost || 0,
    }
  } catch (error) {
    console.error('Error getting cached transcript:', error)
    return null
  }
}

/**
 * Save transcript to Firestore cache
 */
export async function cacheTranscript(
  videoUrl: string,
  platform: string,
  videoId: string,
  transcript: string,
  segments: TranscriptSegment[],
  durationSeconds: number,
  language: string,
  cost: number
): Promise<void> {
  try {
    const docId = `${platform}_${videoId}`
    const now = new Date()

    await db.collection('video_transcripts').doc(docId).set({
      id: docId,
      videoUrl,
      platform,
      videoId,
      transcript,
      segments,
      durationSeconds,
      language,
      createdAt: now,
      updatedAt: now,
      accessCount: 1,
      lastAccessedAt: now,
      transcriptionCost: cost,
    })

    console.log(`✅ Cached transcript for ${platform}_${videoId}`)
  } catch (error) {
    console.error('Error caching transcript:', error)
    throw error
  }
}

/**
 * Transcribe audio file with OpenAI Whisper
 */
export async function transcribeAudioWithWhisper(
  audioBuffer: Buffer,
  filename: string = 'audio.m4a'
): Promise<{
  text: string
  segments: TranscriptSegment[]
  duration: number
  language: string
}> {
  try {
    console.log(`🎤 Transcribing audio with Whisper (${audioBuffer.length} bytes)...`)

    // Use OpenAI's toFile helper to properly convert Buffer to File
    const audioFile = await toFile(audioBuffer, filename, { type: 'audio/mp4' })

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    })

    // Extract segments with timestamps
    const segments: TranscriptSegment[] = (transcription.segments || []).map((seg: any) => ({
      text: seg.text?.trim() || '',
      start: seg.start || 0,
      end: seg.end || 0,
    }))

    console.log(`✅ Whisper transcription complete: ${transcription.text?.substring(0, 100)}...`)

    return {
      text: transcription.text || '',
      segments,
      duration: transcription.duration || 0,
      language: transcription.language || 'en',
    }
  } catch (error: any) {
    console.error('❌ Whisper transcription error:', error.message)
    throw new Error(`Whisper transcription failed: ${error.message}`)
  }
}

/**
 * Update daily statistics for transcriptions
 */
export async function updateTranscriptionStats(
  platform: string,
  success: boolean,
  cached: boolean,
  cost: number
): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const statsDocId = `stats_${today}`
    const statsRef = db.collection('recipe_statistics').doc(statsDocId)

    // Get existing stats
    const statsSnap = await statsRef.get()
    const existingStats = statsSnap.exists ? statsSnap.data() : {}

    // Initialize if needed
    const byPlatform = existingStats?.byPlatform || {}
    const platformStats = byPlatform[platform] || {
      count: 0,
      success: 0,
      failed: 0,
      cached: 0,
      transcribed: 0,
    }

    // Update counts
    platformStats.count++
    if (success) {
      platformStats.success++
      if (cached) {
        platformStats.cached++
      } else {
        platformStats.transcribed++
      }
    } else {
      platformStats.failed++
    }

    byPlatform[platform] = platformStats

    // Update totals
    const totalImports = (existingStats?.totalImports || 0) + 1
    const successfulImports = success
      ? (existingStats?.successfulImports || 0) + 1
      : existingStats?.successfulImports || 0
    const failedImports = !success
      ? (existingStats?.failedImports || 0) + 1
      : existingStats?.failedImports || 0
    const transcriptionsCreated = !cached
      ? (existingStats?.transcriptionsCreated || 0) + 1
      : existingStats?.transcriptionsCreated || 0
    const transcriptsCached = cached
      ? (existingStats?.transcriptsCached || 0) + 1
      : existingStats?.transcriptsCached || 0
    const totalTranscriptionCost = (existingStats?.totalTranscriptionCost || 0) + cost

    // Calculate cache hit rate
    const totalTranscriptRequests = transcriptionsCreated + transcriptsCached
    const cacheHitRate =
      totalTranscriptRequests > 0
        ? Math.round((transcriptsCached / totalTranscriptRequests) * 1000) / 10
        : 0

    // Calculate success rate
    const successRate =
      totalImports > 0 ? Math.round((successfulImports / totalImports) * 1000) / 10 : 0

    // Update document
    await statsRef.set(
      {
        date: today,
        totalImports,
        successfulImports,
        failedImports,
        successRate,
        byPlatform,
        transcriptionsCreated,
        transcriptsCached,
        cacheHitRate,
        totalTranscriptionCost,
        updatedAt: new Date(),
      },
      { merge: true }
    )

    console.log(`📊 Updated stats for ${today}: ${cached ? 'CACHE HIT' : 'TRANSCRIBED'}`)
  } catch (error) {
    console.error('Error updating transcription stats:', error)
    // Don't throw - stats update failure shouldn't break the main flow
  }
}
