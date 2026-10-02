/**
 * Prepares a photo for the recipe-images bucket in the browser: scaled to at
 * most 1200 px on its long side and re-encoded as a JPEG comfortably under
 * the bucket's 2 MB limit, whatever the phone's camera produced.
 */
export function photoToJPEG(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectURL = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(objectURL)
      const longest = Math.max(image.naturalWidth, image.naturalHeight)
      const scale = longest > 1200 ? 1200 / longest : 1
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) return reject(new Error('Could not prepare this photo.'))
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const qualities = [0.8, 0.65, 0.5, 0.35]
      const attempt = (index: number) => {
        canvas.toBlob((blob) => {
          if (blob && blob.size <= 900_000) return resolve(blob)
          if (index + 1 < qualities.length) return attempt(index + 1)
          reject(new Error('That photo is too large. Try a smaller image.'))
        }, 'image/jpeg', qualities[index])
      }
      attempt(0)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectURL)
      reject(new Error('Savry could not read that photo.'))
    }
    image.src = objectURL
  })
}

/** A path in the member's own folder that has never been used, so the upload is a plain insert. */
export function newPhotoPath(userId: string, label: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1e9)}`
  return `${userId}/${label}-${random}.jpg`
}
