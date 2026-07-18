// Main-thread client for the core worker. Promise-by-id request/response,
// with graceful fallback to on-main-thread conversion when the worker or
// OffscreenCanvas is unavailable.

import type { ConvertKind } from './wasm'
import { core } from './wasm'
import { convertImage as convertImageDom } from './image'
import type { ImageFormat } from './image-shared'
import type { WorkerRequest, WorkerResponse } from './worker-protocol'

export interface ImageResult {
  blob: Blob
  url: string
  width: number
  height: number
  bytes: number
  downscaled: boolean
}

interface Pending {
  resolve: (r: WorkerResponse) => void
  reject: (e: unknown) => void
}

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, Pending>()

function getWorker(): Worker | null {
  if (worker) return worker
  try {
    worker = new Worker(new URL('./core.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const p = pending.get(e.data.id)
      if (!p) return
      pending.delete(e.data.id)
      p.resolve(e.data)
    }
    worker.onerror = () => {
      // Fail all in-flight requests; callers fall back to the main thread.
      for (const [, p] of pending) p.reject(new Error('worker error'))
      pending.clear()
      worker = null
    }
  } catch {
    worker = null
  }
  return worker
}

function send(req: WorkerRequest): Promise<WorkerResponse> {
  const w = getWorker()
  if (!w) return Promise.reject(new Error('no worker'))
  return new Promise((resolve, reject) => {
    pending.set(req.id, { resolve, reject })
    w.postMessage(req)
  })
}

export async function convertText(kind: ConvertKind, input: string): Promise<string> {
  try {
    const res = await send({ id: ++seq, op: 'convert', kind, input })
    if (res.ok && res.op === 'convert') return res.out
    if (!res.ok) throw new Error(res.error)
    throw new Error('unexpected response')
  } catch (e) {
    // Worker missing/crashed → run on the main thread. (convert throws on bad input.)
    if (e instanceof Error && (e.message === 'no worker' || e.message === 'worker error'))
      return core.convert(kind, input)
    throw e
  }
}

export async function convertImage(
  file: Blob,
  opts: { format: ImageFormat; maxSize: number; quality: number },
): Promise<ImageResult> {
  const domFallback = async (): Promise<ImageResult> => {
    const r = await convertImageDom(file, opts)
    return { ...r, downscaled: r.downscaled }
  }
  try {
    const res = await send({ id: ++seq, op: 'image', file, ...opts })
    if (res.ok && res.op === 'image') {
      return {
        blob: res.blob,
        url: URL.createObjectURL(res.blob),
        width: res.width,
        height: res.height,
        bytes: res.bytes,
        downscaled: res.downscaled,
      }
    }
    if (!res.ok && res.code === 'no-offscreen') return domFallback()
    if (!res.ok) throw new Error(res.error)
    throw new Error('unexpected response')
  } catch (e) {
    if (e instanceof Error && e.message === 'no worker') return domFallback()
    throw e
  }
}
