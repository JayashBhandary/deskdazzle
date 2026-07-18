// Cross-tab bus over the BroadcastChannel API — keeps multiple open
// Desk Dazzle tabs in sync with no server. Degrades to a no-op where the
// API is unavailable.

export interface MediaState {
  tabId: string
  title: string
  artist?: string
  playing: boolean
  updatedMs: number
}

export type BusMessage =
  // A store was mutated in another tab; listeners should reload it.
  | { kind: 'data-changed'; store: string; tabId: string }
  // Media playback state advertised by a tab (for the now-playing widget).
  | { kind: 'media'; state: MediaState | null; tabId: string }
  // Remote play/pause request aimed at the tab owning playback.
  | { kind: 'media-control'; action: 'play' | 'pause'; targetTabId: string }

const CHANNEL = 'deskdazzle'

// A stable-per-tab id. Not cryptographic — just distinguishes tabs.
export const TAB_ID: string =
  (globalThis.crypto?.randomUUID?.() ?? `tab-${performance.now()}`).slice(0, 12)

type Handler = (msg: BusMessage) => void

class Bus {
  private ch: BroadcastChannel | null = null
  private handlers = new Set<Handler>()

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.ch = new BroadcastChannel(CHANNEL)
      this.ch.onmessage = (e: MessageEvent<BusMessage>) => {
        for (const h of this.handlers) h(e.data)
      }
    }
  }

  get supported() {
    return this.ch !== null
  }

  post(msg: BusMessage) {
    this.ch?.postMessage(msg)
  }

  /** Convenience: announce a mutation to a store. */
  dataChanged(store: string) {
    this.post({ kind: 'data-changed', store, tabId: TAB_ID })
  }

  on(handler: Handler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
}

export const bus = new Bus()
