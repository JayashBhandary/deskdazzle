// Main-thread image conversion + resize via Canvas (fallback path when the
// worker / OffscreenCanvas is unavailable). Nothing leaves the device.

import { MIME, targetSize, type ImageFormat } from './image-shared'

export { MIME, EXT, humanBytes, type ImageFormat } from './image-shared'

export interface ConvertOpts {
  format: ImageFormat
  /** cap the longest side; 0 = keep original (still bounded by SAFE_MAX) */
  maxSize?: number
  /** 0..1, for jpeg/webp */
  quality?: number
}

export interface ConvertedImage {
  blob: Blob
  url: string
  width: number
  height: number
  bytes: number
  downscaled: boolean
}

export async function convertImage(file: File | Blob, opts: ConvertOpts): Promise<ConvertedImage> {
  const bitmap = await createImageBitmap(file)
  const { width, height, downscaled } = targetSize(bitmap.width, bitmap.height, opts.maxSize ?? 0)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Canvas 2D context unavailable')
  }
  if (opts.format === 'jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, MIME[opts.format], opts.quality ?? 0.92),
  )
  if (!blob) throw new Error('Image encoding failed')

  return { blob, url: URL.createObjectURL(blob), width, height, bytes: blob.size, downscaled }
}
