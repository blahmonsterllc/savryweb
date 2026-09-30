import { getStorage } from 'firebase-admin/storage'
import '@/lib/firebase' // ensures the admin app is initialized

/**
 * Upload a base64 JPEG to Firebase Storage and return its public URL.
 * Returns null (and logs) if storage isn't configured or the upload fails,
 * so callers can degrade to "no photo" instead of failing the request.
 */
export async function uploadJPEG(path: string, base64: string, maxBytes = 900_000): Promise<string | null> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  if (!bucketName) {
    console.warn('storage: no bucket configured, skipping upload')
    return null
  }
  try {
    const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    if (buffer.length === 0 || buffer.length > maxBytes) return null
    const bucket = getStorage().bucket(bucketName)
    const file = bucket.file(path)
    await file.save(buffer, {
      contentType: 'image/jpeg',
      public: true,
      resumable: false,
      metadata: { cacheControl: 'public, max-age=31536000' },
    })
    return `https://storage.googleapis.com/${bucket.name}/${path}`
  } catch (error) {
    console.error('storage: upload failed', error)
    return null
  }
}
