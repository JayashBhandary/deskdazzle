// Message protocol shared between the main thread and the core worker.
import type { ConvertKind } from './wasm'
import type { ImageFormat } from './image-shared'

export type WorkerRequest =
  | { id: number; op: 'convert'; kind: ConvertKind; input: string }
  | { id: number; op: 'image'; file: Blob; format: ImageFormat; maxSize: number; quality: number }

export type WorkerResponse =
  | { id: number; ok: true; op: 'convert'; out: string }
  | {
      id: number
      ok: true
      op: 'image'
      blob: Blob
      width: number
      height: number
      bytes: number
      downscaled: boolean
    }
  | { id: number; ok: false; error: string; code?: 'no-offscreen' }
