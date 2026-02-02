/**
 * Image Compression Utility
 * Compresses images before uploading to Supabase storage
 * Optimized for delivery notes and label photos
 */

export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png'
}

export interface CompressionResult {
  blob: Blob
  base64: string
  originalSize: number
  compressedSize: number
  compressionRatio: number
  width: number
  height: number
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.75,
  mimeType: 'image/jpeg',
}

/**
 * Load an image from a File or Blob
 */
function loadImage(source: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    
    if (typeof source === 'string') {
      img.src = source
    } else {
      img.src = URL.createObjectURL(source)
    }
  })
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth
  let height = originalHeight

  // Scale down if necessary
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width)
    width = maxWidth
  }

  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height)
    height = maxHeight
  }

  return { width, height }
}

/**
 * Compress an image file
 */
export async function compressImage(
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const originalSize = file.size

  // Load the image
  const img = await loadImage(file)
  
  // Calculate new dimensions
  const { width, height } = calculateDimensions(
    img.width,
    img.height,
    opts.maxWidth!,
    opts.maxHeight!
  )

  // Create canvas and draw resized image
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not get canvas context')
  }

  // Enable image smoothing for better quality
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  
  // Draw the image
  ctx.drawImage(img, 0, 0, width, height)

  // Clean up object URL if we created one
  if (typeof file !== 'string') {
    URL.revokeObjectURL(img.src)
  }

  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error('Failed to create blob'))
      },
      opts.mimeType,
      opts.quality
    )
  })

  // Convert to base64
  const base64 = await blobToBase64(blob)

  const compressedSize = blob.size
  const compressionRatio = originalSize > 0 
    ? Math.round((1 - compressedSize / originalSize) * 100)
    : 0

  return {
    blob,
    base64,
    originalSize,
    compressedSize,
    compressionRatio,
    width,
    height,
  }
}

/**
 * Convert Blob to base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Convert base64 string to Blob
 */
export function base64ToBlob(base64: string, mimeType = 'image/jpeg'): Blob {
  // Remove data URL prefix if present
  const base64Data = base64.includes(',') 
    ? base64.split(',')[1] 
    : base64

  const byteCharacters = atob(base64Data)
  const byteNumbers = new Array(byteCharacters.length)
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

/**
 * Compress multiple images
 */
export async function compressImages(
  files: File[],
  options: CompressionOptions = {},
  onProgress?: (index: number, total: number) => void
): Promise<CompressionResult[]> {
  const results: CompressionResult[] = []
  
  for (let i = 0; i < files.length; i++) {
    const result = await compressImage(files[i], options)
    results.push(result)
    onProgress?.(i + 1, files.length)
  }
  
  return results
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Compression presets for different use cases
 */
export const COMPRESSION_PRESETS = {
  // For delivery notes - need to be readable
  deliveryNote: {
    maxWidth: 2048,
    maxHeight: 2048,
    quality: 0.8,
    mimeType: 'image/jpeg' as const,
  },
  // For protein labels - moderate quality
  proteinLabel: {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.75,
    mimeType: 'image/jpeg' as const,
  },
  // For thumbnails
  thumbnail: {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.7,
    mimeType: 'image/jpeg' as const,
  },
  // High quality for important documents
  highQuality: {
    maxWidth: 3000,
    maxHeight: 3000,
    quality: 0.9,
    mimeType: 'image/jpeg' as const,
  },
}