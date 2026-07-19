// Pure image helpers shared by the main thread and the worker (no DOM here).

export type ImageFormat = 'png' | 'jpeg' | 'webp'

export const MIME: Record<ImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export const EXT: Record<ImageFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
}

// Hard ceiling on the longest side. Guards against canvas-area caps
// (mobile Safari ~16.7 MP / 4096-side) that silently produce blank output.
export const SAFE_MAX = 8192

export interface TargetSize {
  width: number
  height: number
  downscaled: boolean
}

/** Compute output dimensions, applying the user cap then the safety ceiling. */
export function targetSize(w: number, h: number, maxSize: number): TargetSize {
  const longest = Math.max(w, h)
  const cap = maxSize > 0 ? Math.min(maxSize, SAFE_MAX) : SAFE_MAX
  if (longest <= cap) return { width: w, height: h, downscaled: false }
  const scale = cap / longest
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    downscaled: true,
  }
}

export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

/** Human-readable elapsed time from a millisecond duration (e.g. "820 ms", "3.4 s"). */
export function humanDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  return `${m}m ${s}s`
}
