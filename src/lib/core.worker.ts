// Web Worker hosting the Rust/WASM core. Runs text conversions and image
// transcode/resize off the main thread so the UI never blocks on large data.

import init, { convert_text } from '@core/pocketknife_core.js'
import wasmUrl from '@core/pocketknife_core_bg.wasm?url'
import { MIME, targetSize } from './image-shared'
import type { WorkerRequest, WorkerResponse } from './worker-protocol'

let ready: Promise<unknown> | null = null
const boot = () => (ready ??= init({ module_or_path: wasmUrl }))

async function handleImage(
  req: Extract<WorkerRequest, { op: 'image' }>,
): Promise<WorkerResponse> {
  if (typeof OffscreenCanvas === 'undefined') {
    return { id: req.id, ok: false, error: 'OffscreenCanvas unavailable', code: 'no-offscreen' }
  }
  const bitmap = await createImageBitmap(req.file)
  const { width, height, downscaled } = targetSize(bitmap.width, bitmap.height, req.maxSize)
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return { id: req.id, ok: false, error: 'Canvas 2D context unavailable' }
  }
  if (req.format === 'jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await canvas.convertToBlob({ type: MIME[req.format], quality: req.quality })
  return { id: req.id, ok: true, op: 'image', blob, width, height, bytes: blob.size, downscaled }
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data
  try {
    await boot()
    let res: WorkerResponse
    if (req.op === 'convert') {
      res = { id: req.id, ok: true, op: 'convert', out: convert_text(req.kind, req.input) }
    } else {
      res = await handleImage(req)
    }
    ;(self as unknown as Worker).postMessage(res)
  } catch (err) {
    ;(self as unknown as Worker).postMessage({
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    } satisfies WorkerResponse)
  }
}
