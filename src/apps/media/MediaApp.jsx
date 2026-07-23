import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Link as LinkIcon,
  MonitorPlay,
  Music,
  Pause,
  Play,
  Plus,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Video as VideoIcon,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// The Media app — a self-contained player for local files AND YouTube, unified
// under one transport bar. Local files run client-side via object URLs (revoked
// on removal / unmount) so nothing leaves the machine. YouTube is embedded and
// driven through the IFrame Player API — the video plays *inside* this widget.
//
// Note on "control another tab (real Spotify/YouTube/Apple Music)": browsers
// forbid a web page from reaching into a different origin's tab, so that needs a
// browser extension, not a web app. Embedding the player here is the in-page
// equivalent that IS possible.

let TRACK_SEQ = 0

const AUDIO_RE = /^audio\//
const VIDEO_RE = /^video\//

// Some browsers report an empty MIME type for known extensions; fall back to
// the extension so we still classify (and accept) the file.
const kindOf = (file) => {
  if (VIDEO_RE.test(file.type)) return 'video'
  if (AUDIO_RE.test(file.type)) return 'audio'
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (['mp4', 'webm', 'ogv', 'mov', 'mkv', 'm4v'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus'].includes(ext)) return 'audio'
  return null
}

// Pull an 11-char video id out of any common YouTube URL shape, or a bare id.
const parseYtId = (raw) => {
  const s = raw.trim()
  try {
    const u = new URL(s)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
    if (u.hostname.replace(/^www\./, '').endsWith('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const m = u.pathname.match(/\/(embed|shorts|v|live)\/([^/?]+)/)
      if (m) return m[2]
    }
  } catch {
    // not a URL — fall through to bare-id test
  }
  return /^[\w-]{11}$/.test(s) ? s : null
}

const fmt = (s) => {
  if (!Number.isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

// Load the YouTube IFrame API once and resolve when window.YT is ready.
let ytApiPromise = null
const loadYouTubeApi = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (ytApiPromise) return ytApiPromise
  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT)
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return ytApiPromise
}

function MediaApp() {
  const [tracks, setTracks] = useState([]) // { id, name, url?, kind, videoId? }
  const [current, setCurrent] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [loop, setLoop] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [urlInput, setUrlInput] = useState('')

  const mediaRef = useRef(null) // <audio>/<video> element
  const inputRef = useRef(null) // hidden file input
  const ytHostRef = useRef(null) // div the YT API turns into an iframe
  const ytPlayerRef = useRef(null) // YT.Player instance
  const [ytReady, setYtReady] = useState(false)
  const tracksRef = useRef(tracks)
  tracksRef.current = tracks

  const track = current >= 0 ? tracks[current] : null
  const isYoutube = track?.kind === 'youtube'
  const isVideo = track?.kind === 'video'

  // Revoke object URLs on unmount so blobs don't leak.
  useEffect(() => {
    return () => {
      for (const t of tracksRef.current) if (t.url) URL.revokeObjectURL(t.url)
    }
  }, [])

  const addFiles = useCallback((fileList) => {
    const incoming = []
    for (const file of fileList) {
      const kind = kindOf(file)
      if (!kind) continue
      incoming.push({
        id: `t${TRACK_SEQ++}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        url: URL.createObjectURL(file),
        kind,
      })
    }
    if (!incoming.length) return
    setTracks((prev) => {
      if (prev.length === 0) setCurrent(0)
      return [...prev, ...incoming]
    })
  }, [])

  const addYoutube = useCallback((raw) => {
    const videoId = parseYtId(raw)
    if (!videoId) return false
    const id = `t${TRACK_SEQ++}`
    setTracks((prev) => {
      if (prev.length === 0) setCurrent(0)
      return [...prev, { id, name: 'YouTube video', kind: 'youtube', videoId }]
    })
    // Best-effort title via public oEmbed (no key). CORS-permitted; ignore fail.
    fetch(`https://www.youtube.com/oembed?format=json&url=https://youtu.be/${videoId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.title) {
          setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, name: d.title } : t)))
        }
      })
      .catch(() => {})
    return true
  }, [])

  const onPick = (e) => {
    if (e.target.files?.length) addFiles(e.target.files)
    e.target.value = ''
  }

  const submitUrl = (e) => {
    e.preventDefault()
    if (addYoutube(urlInput)) setUrlInput('')
  }

  const removeTrack = (idx) => {
    setTracks((prev) => {
      const t = prev[idx]
      if (t?.url) URL.revokeObjectURL(t.url)
      const next = prev.filter((_, i) => i !== idx)
      setCurrent((cur) => {
        if (next.length === 0) return -1
        if (idx < cur) return cur - 1
        if (idx === cur) return Math.min(cur, next.length - 1)
        return cur
      })
      return next
    })
  }

  const pickNextIndex = useCallback(
    (dir) => {
      const n = tracksRef.current.length
      if (n === 0) return -1
      if (shuffle && n > 1) {
        let r = current
        while (r === current) r = Math.floor((Date.now() + TRACK_SEQ) % n)
        return r
      }
      return (current + dir + n) % n
    },
    [current, shuffle],
  )

  const goTo = useCallback((idx) => {
    setCurrent(idx)
    setTime(0)
    setDuration(0)
    setPlaying(true)
  }, [])

  const next = useCallback(() => goTo(pickNextIndex(1)), [goTo, pickNextIndex])
  const prev = useCallback(() => {
    // Restart if we're a few seconds in, else step back.
    const cur = isYoutube ? ytPlayerRef.current?.getCurrentTime?.() : mediaRef.current?.currentTime
    if (cur > 3) {
      if (isYoutube) ytPlayerRef.current?.seekTo?.(0, true)
      else if (mediaRef.current) mediaRef.current.currentTime = 0
      setTime(0)
      return
    }
    goTo(pickNextIndex(-1))
  }, [goTo, pickNextIndex, isYoutube])

  const togglePlay = () => {
    if (!track) return
    setPlaying((p) => !p)
  }

  // onEnded reads loop/shuffle/current — keep a live ref so the YT callback
  // (registered once per track) always sees the latest values.
  const onEnded = useCallback(() => {
    if (loop) {
      if (isYoutube) {
        ytPlayerRef.current?.seekTo?.(0, true)
        ytPlayerRef.current?.playVideo?.()
      } else if (mediaRef.current) {
        mediaRef.current.currentTime = 0
        mediaRef.current.play().catch(() => setPlaying(false))
      }
      return
    }
    if (!shuffle && current === tracksRef.current.length - 1) {
      setPlaying(false)
      return
    }
    next()
  }, [loop, shuffle, current, isYoutube, next])
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  // ----- YouTube player lifecycle: create on entering a YT track, destroy on
  // leaving it (or switching to a different YT track, keyed by track.id). -----
  useEffect(() => {
    if (!isYoutube || !ytHostRef.current) return undefined
    let destroyed = false
    setYtReady(false)
    loadYouTubeApi().then((YT) => {
      if (destroyed || !ytHostRef.current) return
      ytPlayerRef.current = new YT.Player(ytHostRef.current, {
        videoId: track.videoId,
        playerVars: { controls: 0, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: (e) => {
            setYtReady(true)
            setDuration(e.target.getDuration?.() || 0)
            e.target.setVolume(Math.round((muted ? 0 : volume) * 100))
            if (playing) e.target.playVideo()
          },
          onStateChange: (e) => {
            const S = window.YT?.PlayerState
            if (!S) return
            if (e.data === S.PLAYING) {
              setPlaying(true)
              setDuration(e.target.getDuration?.() || 0)
            } else if (e.data === S.PAUSED) {
              setPlaying(false)
            } else if (e.data === S.ENDED) {
              onEndedRef.current()
            }
          },
        },
      })
    })
    return () => {
      destroyed = true
      setYtReady(false)
      try {
        ytPlayerRef.current?.destroy?.()
      } catch {
        /* noop */
      }
      ytPlayerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYoutube, track?.id])

  // Poll YouTube playback time while playing (the API has no timeupdate event).
  useEffect(() => {
    if (!isYoutube || !playing || !ytReady) return undefined
    const id = setInterval(() => {
      const p = ytPlayerRef.current
      if (p?.getCurrentTime) setTime(p.getCurrentTime())
    }, 500)
    return () => clearInterval(id)
  }, [isYoutube, playing, ytReady])

  // Drive play/pause into whichever engine is active.
  useEffect(() => {
    if (isYoutube) {
      const p = ytPlayerRef.current
      if (!p || !ytReady) return
      if (playing) p.playVideo?.()
      else p.pauseVideo?.()
      return
    }
    const el = mediaRef.current
    if (!el) return
    if (playing) el.play().catch(() => setPlaying(false))
    else el.pause()
  }, [playing, current, isYoutube, ytReady])

  // Push volume/mute into whichever engine is active.
  useEffect(() => {
    if (isYoutube) {
      const p = ytPlayerRef.current
      if (!p || !ytReady) return
      p.setVolume?.(Math.round(volume * 100))
      if (muted || volume === 0) p.mute?.()
      else p.unMute?.()
      return
    }
    const el = mediaRef.current
    if (!el) return
    el.volume = volume
    el.muted = muted
  }, [volume, muted, current, isYoutube, ytReady])

  const seek = (e) => {
    const v = Number(e.target.value)
    if (isYoutube) ytPlayerRef.current?.seekTo?.(v, true)
    else if (mediaRef.current) mediaRef.current.currentTime = v
    setTime(v)
  }

  // OS media controls (best-effort; support varies).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
    try {
      if (track) {
        // eslint-disable-next-line no-undef
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.name,
          album: 'Desk Dazzle',
        })
        navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
        navigator.mediaSession.setActionHandler('play', () => setPlaying(true))
        navigator.mediaSession.setActionHandler('pause', () => setPlaying(false))
        navigator.mediaSession.setActionHandler('previoustrack', prev)
        navigator.mediaSession.setActionHandler('nexttrack', next)
      } else {
        navigator.mediaSession.metadata = null
        navigator.mediaSession.playbackState = 'none'
      }
    } catch {
      /* never let media-session quirks break the app */
    }
  }, [track, playing, prev, next])

  return (
    <div
      className="@container flex h-full min-h-0 flex-col gap-2"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,video/*"
        multiple
        className="hidden"
        onChange={onPick}
      />

      {/* URL bar */}
      <form onSubmit={submitUrl} className="flex items-center gap-1.5 px-1">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border bg-background px-2">
          <MonitorPlay className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste a YouTube link…"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            aria-label="YouTube URL"
          />
        </div>
        <Button type="submit" size="sm" variant="outline" className="shrink-0" disabled={!urlInput.trim()}>
          <LinkIcon className="size-4" />
        </Button>
      </form>

      {/* Stage: YouTube iframe, local video, or audio art */}
      <div className="relative grid min-h-0 flex-1 place-items-center overflow-hidden rounded-lg bg-muted">
        {isYoutube ? (
          <div className="h-full w-full bg-black">
            <div ref={ytHostRef} className="h-full w-full" />
          </div>
        ) : track ? (
          isVideo ? (
            <video
              key={track.id}
              ref={mediaRef}
              src={track.url}
              className="h-full w-full bg-black object-contain"
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => onEndedRef.current()}
              playsInline
            />
          ) : (
            <>
              <audio
                key={track.id}
                ref={mediaRef}
                src={track.url}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => onEndedRef.current()}
              />
              <div className="flex flex-col items-center gap-2 p-4 text-center">
                <div className="grid size-16 @sm:size-20 place-items-center rounded-full bg-background/60">
                  <Music className="size-8 @sm:size-10 text-muted-foreground" />
                </div>
                <div className="max-w-full truncate text-sm @sm:text-base font-medium">
                  {track.name}
                </div>
              </div>
            </>
          )
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center gap-2 p-6 text-center text-muted-foreground transition-colors ${
              dragOver ? 'text-foreground' : ''
            }`}
          >
            <Music className="size-8 @sm:size-10" />
            <p className="text-sm @sm:text-base">
              Paste a YouTube link above, or drop / open audio &amp; video files.
            </p>
          </button>
        )}
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg border-2 border-dashed border-primary bg-background/70 text-sm font-medium">
            Drop to add
          </div>
        )}
      </div>

      {track && <div className="truncate px-1 text-sm font-medium">{track.name}</div>}

      {/* Seek bar */}
      <div className="flex items-center gap-2 px-1">
        <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
          {fmt(time)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step="any"
          value={Math.min(time, duration || 0)}
          onChange={seek}
          disabled={!track}
          className="h-1.5 flex-1 cursor-pointer disabled:opacity-50"
          aria-label="Seek"
        />
        <span className="w-9 shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {fmt(duration)}
        </span>
      </div>

      {/* Transport */}
      <div className="flex items-center justify-center gap-1 @sm:gap-2">
        <Button
          size="icon"
          variant={shuffle ? 'default' : 'ghost'}
          aria-label="Shuffle"
          aria-pressed={shuffle}
          onClick={() => setShuffle((s) => !s)}
        >
          <Shuffle />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Previous" onClick={prev} disabled={!track}>
          <SkipBack />
        </Button>
        <Button
          size="icon"
          variant="default"
          className="@sm:size-11"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={togglePlay}
          disabled={!track}
        >
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button size="icon" variant="ghost" aria-label="Next" onClick={next} disabled={!track}>
          <SkipForward />
        </Button>
        <Button
          size="icon"
          variant={loop ? 'default' : 'ghost'}
          aria-label="Loop"
          aria-pressed={loop}
          onClick={() => setLoop((l) => !l)}
        >
          <Repeat />
        </Button>
      </div>

      {/* Volume + add files */}
      <div className="flex items-center gap-2 px-1">
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0"
          aria-label={muted ? 'Unmute' : 'Mute'}
          onClick={() => setMuted((m) => !m)}
        >
          {muted || volume === 0 ? <VolumeX /> : <Volume2 />}
        </Button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => {
            setVolume(Number(e.target.value))
            setMuted(false)
          }}
          className="h-1.5 w-20 cursor-pointer"
          aria-label="Volume"
        />
        <div className="flex-1" />
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => inputRef.current?.click()}
        >
          <Plus className="mr-1 size-4" /> Files
        </Button>
      </div>

      {/* Playlist */}
      {tracks.length > 0 && (
        <ul className="min-h-0 max-h-32 shrink-0 space-y-0.5 overflow-y-auto px-1 pb-1">
          {tracks.map((t, i) => (
            <li key={t.id}>
              <div
                className={`group flex items-center gap-2 rounded-md px-2 py-1 text-sm ${
                  i === current ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                }`}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => goTo(i)}
                >
                  {t.kind === 'youtube' ? (
                    <MonitorPlay className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : t.kind === 'video' ? (
                    <VideoIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <Music className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{t.name}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${t.name}`}
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  onClick={() => removeTrack(i)}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MediaApp
