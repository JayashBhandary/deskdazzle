import React, { useEffect, useState } from 'react'
import { Music, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { bus } from '@/lib/broadcast'

// Entries older than this are considered abandoned (tab crashed or closed
// without posting a null state) and get swept.
const EXPIRE_MS = 60_000
const SWEEP_MS = 10_000

function MediaWidget() {
  // Most recent non-null MediaState per tab, keyed by tabId.
  const [states, setStates] = useState({})

  useEffect(() => {
    const off = bus.on((msg) => {
      if (msg.kind !== 'media') return
      setStates((prev) => {
        const next = { ...prev }
        if (msg.state === null) delete next[msg.tabId]
        else next[msg.tabId] = msg.state
        return next
      })
    })
    const sweep = setInterval(() => {
      setStates((prev) => {
        const now = Date.now()
        if (!Object.values(prev).some((s) => now - s.updatedMs > EXPIRE_MS)) return prev
        const next = {}
        for (const [id, s] of Object.entries(prev)) {
          if (now - s.updatedMs <= EXPIRE_MS) next[id] = s
        }
        return next
      })
    }, SWEEP_MS)
    return () => {
      off()
      clearInterval(sweep)
    }
  }, [])

  const all = Object.values(states)
  const active =
    all.find((s) => s.playing) ?? [...all].sort((a, b) => b.updatedMs - a.updatedMs)[0]

  const control = (action) => {
    if (!active) return
    bus.post({ kind: 'media-control', action, targetTabId: active.tabId })
  }

  // Mirror the freshest state into the OS media controls (best-effort).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    try {
      if (active) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: active.title,
          artist: active.artist ?? '',
          album: 'Desk Dazzle',
        })
        navigator.mediaSession.playbackState = active.playing ? 'playing' : 'paused'
        navigator.mediaSession.setActionHandler('play', () =>
          bus.post({ kind: 'media-control', action: 'play', targetTabId: active.tabId }),
        )
        navigator.mediaSession.setActionHandler('pause', () =>
          bus.post({ kind: 'media-control', action: 'pause', targetTabId: active.tabId }),
        )
      } else {
        navigator.mediaSession.metadata = null
        navigator.mediaSession.playbackState = 'none'
        navigator.mediaSession.setActionHandler('play', null)
        navigator.mediaSession.setActionHandler('pause', null)
      }
    } catch {
      // Media Session support varies; never let it break the widget.
    }
  }, [active?.tabId, active?.title, active?.artist, active?.playing])

  if (!active) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <Music className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Nothing playing in your tabs. Try Text-to-Speech!
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full items-center gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-md bg-muted">
        <Music className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{active.title}</div>
        <div className="truncate text-xs text-muted-foreground">
          {active.artist || 'Another tab'}
        </div>
      </div>
      <Button
        size="icon"
        variant={active.playing ? 'default' : 'outline'}
        className="shrink-0"
        aria-label={active.playing ? 'Pause' : 'Play'}
        onClick={() => control(active.playing ? 'pause' : 'play')}
      >
        {active.playing ? <Pause /> : <Play />}
      </Button>
    </div>
  )
}

export default MediaWidget
