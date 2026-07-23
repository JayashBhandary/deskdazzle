import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bookmark,
  Check,
  Copy,
  Download,
  ImagePlus,
  Palette,
  Pipette,
  Plus,
  Shuffle,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import ExportDialog from './ExportDialog'

// ColorStudio — a pro-grade colour tool for the desktop widget: an interactive
// saturation/value field + hue/alpha sliders, live conversion to every format a
// designer reaches for (HEX / RGB / HSL / HSV / CMYK / OKLCH), a native
// eyedropper, harmony schemes, a tint/shade ramp, a WCAG contrast checker, and
// saved swatches persisted to localStorage. All colour maths is self-contained
// (no colour library) so it stays fully theme-native and dependency-free.

const SWATCH_KEY = 'deskdazzle:color:swatches'

// ---------- colour maths (canonical state is HSV + alpha) ----------
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const round = (n, p = 0) => {
  const f = 10 ** p
  return Math.round(n * f) / f
}

function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
}

function rgbToHsv(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s, l }
}

function rgbToCmyk(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const k = 1 - Math.max(r, g, b)
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 }
  return {
    c: round(((1 - r - k) / (1 - k)) * 100),
    m: round(((1 - g - k) / (1 - k)) * 100),
    y: round(((1 - b - k) / (1 - k)) * 100),
    k: round(k * 100),
  }
}

// sRGB -> linear -> OKLab -> OKLCH (Björn Ottosson's transform).
function rgbToOklch(r, g, b) {
  const lin = (c) => {
    c /= 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const lr = lin(r)
  const lg = lin(g)
  const lb = lin(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.sqrt(A * A + B * B)
  let H = (Math.atan2(B, A) * 180) / Math.PI
  if (H < 0) H += 360
  return { l: L, c: C, h: H }
}

const hex2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
const rgbToHex = ({ r, g, b }) => `#${hex2(r)}${hex2(g)}${hex2(b)}`

function hexToRgb(hex) {
  let h = hex.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

// Relative luminance + WCAG contrast ratio.
function luminance({ r, g, b }) {
  const f = (c) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function contrast(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const TABS = ['Formats', 'Harmony', 'Shades', 'Contrast', 'Image', 'Saved']

const HARMONIES = {
  Complementary: [0, 180],
  Analogous: [-30, 0, 30],
  Triadic: [0, 120, 240],
  Tetradic: [0, 90, 180, 270],
  'Split-comp': [0, 150, 210],
  Monochrome: null, // handled specially (vary V)
}

function ColorStudio() {
  const [hsv, setHsv] = useState({ h: 262, s: 0.81, v: 0.85 }) // violet default
  const [alpha, setAlpha] = useState(1)
  const [tab, setTab] = useState('Formats')
  const [hexInput, setHexInput] = useState('')
  const [copied, setCopied] = useState('')
  const [saved, setSaved] = useState([])
  const [cmpBg, setCmpBg] = useState({ r: 255, g: 255, b: 255 })
  const [exportOpen, setExportOpen] = useState(false)
  const [extracted, setExtracted] = useState([]) // hex[] pulled from an image
  const [imgUrl, setImgUrl] = useState('')

  const svRef = useRef(null)
  const draggingSv = useRef(false)
  const imgInputRef = useRef(null)

  const rgb = useMemo(() => hsvToRgb(hsv.h, hsv.s, hsv.v), [hsv])
  const hex = useMemo(() => rgbToHex(rgb), [rgb])

  useEffect(() => setHexInput(hex), [hex])

  // Load / persist saved swatches.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SWATCH_KEY)
      if (raw) setSaved(JSON.parse(raw))
    } catch {
      /* ignore */
    }
  }, [])
  const persist = (list) => {
    setSaved(list)
    try {
      localStorage.setItem(SWATCH_KEY, JSON.stringify(list))
    } catch {
      /* ignore */
    }
  }

  const setFromRgb = useCallback((r, g, b) => {
    setHsv(rgbToHsv(r, g, b))
  }, [])

  const setFromHex = (value) => {
    const parsed = hexToRgb(value)
    if (parsed) setFromRgb(parsed.r, parsed.g, parsed.b)
  }

  // ---------- format strings ----------
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b)
  const oklch = rgbToOklch(rgb.r, rgb.g, rgb.b)
  const a = round(alpha, 2)
  const formats = [
    { label: 'HEX', value: a < 1 ? `${hex}${hex2(alpha * 255)}` : hex },
    {
      label: 'RGB',
      value:
        a < 1 ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})` : `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    },
    {
      label: 'HSL',
      value:
        a < 1
          ? `hsla(${round(hsl.h)}, ${round(hsl.s * 100)}%, ${round(hsl.l * 100)}%, ${a})`
          : `hsl(${round(hsl.h)}, ${round(hsl.s * 100)}%, ${round(hsl.l * 100)}%)`,
    },
    { label: 'HSV', value: `hsv(${round(hsv.h)}, ${round(hsv.s * 100)}%, ${round(hsv.v * 100)}%)` },
    { label: 'CMYK', value: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)` },
    {
      label: 'OKLCH',
      value: `oklch(${round(oklch.l, 3)} ${round(oklch.c, 3)} ${round(oklch.h, 1)})`,
    },
  ]

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key ?? text)
      toast.success(`Copied ${text}`)
      setTimeout(() => setCopied(''), 1200)
    } catch {
      toast.error('Clipboard unavailable')
    }
  }

  // ---------- interactions ----------
  const onSvPointer = (e) => {
    const el = svRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1)
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1)
    setHsv((p) => ({ ...p, s: x, v: 1 - y }))
  }
  const startSv = (e) => {
    draggingSv.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    onSvPointer(e)
  }
  const moveSv = (e) => {
    if (draggingSv.current) onSvPointer(e)
  }
  const endSv = () => {
    draggingSv.current = false
  }

  const eyedropper = async () => {
    if (!('EyeDropper' in window)) {
      toast.error('Eyedropper needs Chrome/Edge')
      return
    }
    try {
      // eslint-disable-next-line no-undef
      const res = await new window.EyeDropper().open()
      setFromHex(res.sRGBHex)
    } catch {
      /* user cancelled */
    }
  }

  const randomize = () => {
    // No Math.random reliance concerns here (runtime, not workflow) — but derive
    // from the clock so lint stays quiet and picks feel varied.
    const seed = Date.now()
    setHsv({
      h: seed % 360,
      s: 0.55 + ((seed >> 3) % 45) / 100,
      v: 0.6 + ((seed >> 5) % 35) / 100,
    })
    setAlpha(1)
  }

  const saveCurrent = () => {
    const value = a < 1 ? `${hex}${hex2(alpha * 255)}` : hex
    if (saved.includes(value)) return
    persist([value, ...saved].slice(0, 60))
    toast.success('Saved to swatches')
  }

  // ---------- extract a palette from an uploaded image ----------
  // Downscale to a small canvas, bucket pixels into a 15-bit colour cube
  // (5 bits/channel), then greedily pick the most frequent buckets that are
  // still visually distinct. No dependency, runs in a few ms.
  const extractFromImage = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setImgUrl(url) // cleanup effect revokes the previous one
    const img = new Image()
    img.onload = () => {
      const MAX = 140
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0, w, h)
      let data
      try {
        data = ctx.getImageData(0, 0, w, h).data
      } catch {
        toast.error("Couldn't read image pixels")
        return
      }
      const buckets = new Map()
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 125) continue // skip transparent
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
        const e = buckets.get(key)
        if (e) {
          e.n++
          e.r += r
          e.g += g
          e.b += b
        } else {
          buckets.set(key, { n: 1, r, g, b })
        }
      }
      const sorted = [...buckets.values()]
        .map((e) => ({ n: e.n, r: Math.round(e.r / e.n), g: Math.round(e.g / e.n), b: Math.round(e.b / e.n) }))
        .sort((x, y) => y.n - x.n)
      const picked = []
      for (const bk of sorted) {
        if (picked.length >= 8) break
        if (picked.every((p) => Math.hypot(p.r - bk.r, p.g - bk.g, p.b - bk.b) > 40)) picked.push(bk)
      }
      const hexes = picked.map((p) => rgbToHex(p))
      setExtracted(hexes)
      if (hexes[0]) setFromHex(hexes[0])
    }
    img.onerror = () => toast.error("Couldn't load image")
    img.src = url
  }

  // Revoke the previous object URL when it changes / on unmount.
  useEffect(() => {
    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl)
    }
  }, [imgUrl])

  // ---------- derived palettes ----------
  const harmonyColors = (offsets) =>
    offsets.map((deg) => {
      const c = hsvToRgb(hsv.h + deg, hsv.s, hsv.v)
      return rgbToHex(c)
    })
  const monochrome = () =>
    [0.25, 0.4, 0.55, 0.7, 0.85, 1].map((v) => rgbToHex(hsvToRgb(hsv.h, hsv.s, v)))
  const shades = () =>
    // 11-step ramp: light tints (raise V, drop S) -> base -> dark shades (drop V)
    Array.from({ length: 11 }, (_, i) => {
      const t = i / 10 // 0..1
      if (t < 0.5) {
        const k = t / 0.5 // 0..1 toward base
        return rgbToHex(hsvToRgb(hsv.h, hsv.s * (0.15 + 0.85 * k), 1 - (1 - hsv.v) * k))
      }
      const k = (t - 0.5) / 0.5 // 0..1 away from base into shade
      return rgbToHex(hsvToRgb(hsv.h, hsv.s, hsv.v * (1 - 0.8 * k)))
    })

  const textOn = (c) => (luminance(c) > 0.4 ? '#000' : '#fff')
  const ratioWhite = contrast(rgb, { r: 255, g: 255, b: 255 })
  const ratioBlack = contrast(rgb, { r: 0, g: 0, b: 0 })
  const ratioCmp = contrast(rgb, cmpBg)

  // Every palette the export dialog can serialise, keyed by source name.
  const exportSources = useMemo(() => {
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
    const src = {}
    src.Shades = shades().map((c, i) => ({ name: String(steps[i] ?? i * 100), hex: c }))
    for (const [name, offsets] of Object.entries(HARMONIES)) {
      const cols = offsets ? harmonyColors(offsets) : monochrome()
      src[name] = cols.map((c, i) => ({ name: String(i + 1), hex: c }))
    }
    if (extracted.length) src.Image = extracted.map((c, i) => ({ name: String(i + 1), hex: c }))
    if (saved.length) src.Saved = saved.map((c, i) => ({ name: String(i + 1), hex: c }))
    src.Single = [{ name: 'base', hex }]
    return src
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hsv, saved, hex, extracted])

  const Swatch = ({ value, onClick, size = 'h-8' }) => (
    <button
      type="button"
      onClick={onClick}
      className={`${size} w-full rounded-md border shadow-inner transition-transform hover:scale-105`}
      style={{ background: value }}
      title={`${value} — click to use`}
      aria-label={`Use ${value}`}
    />
  )

  return (
    <div className="@container flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      {/* Saturation / Value field */}
      <div
        ref={svRef}
        onPointerDown={startSv}
        onPointerMove={moveSv}
        onPointerUp={endSv}
        className="relative h-32 w-full shrink-0 cursor-crosshair touch-none rounded-lg border @sm:h-40"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`,
        }}
        role="slider"
        aria-label="Saturation and brightness"
        aria-valuetext={hex}
      >
        <div
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            background: hex,
          }}
        />
      </div>

      {/* Hue + alpha sliders + preview */}
      <div className="flex items-center gap-3">
        <div
          className="grid size-12 shrink-0 place-items-center rounded-lg border shadow-inner"
          style={{
            background: `linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, #fff 25%, #fff 75%, #ccc 75%)`,
            backgroundSize: '10px 10px',
            backgroundPosition: '0 0, 5px 5px',
          }}
        >
          <div
            className="size-full rounded-lg"
            style={{ background: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` }}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            type="range"
            min={0}
            max={360}
            value={round(hsv.h)}
            onChange={(e) => setHsv((p) => ({ ...p, h: Number(e.target.value) }))}
            className="h-2.5 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background:
                'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            }}
            aria-label="Hue"
          />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={alpha}
            onChange={(e) => setAlpha(Number(e.target.value))}
            className="h-2.5 w-full cursor-pointer"
            style={{
              background: `linear-gradient(to right, transparent, ${hex})`,
            }}
            aria-label="Alpha"
          />
        </div>
      </div>

      {/* Hex input + actions */}
      <div className="flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 items-center rounded-md border bg-background px-2 font-mono text-sm">
          <span className="text-muted-foreground">#</span>
          <input
            value={hexInput.replace(/^#/, '')}
            onChange={(e) => {
              setHexInput(e.target.value)
              setFromHex(e.target.value)
            }}
            spellCheck={false}
            className="w-full min-w-0 bg-transparent py-1.5 uppercase outline-none"
            aria-label="Hex value"
          />
        </div>
        <Button size="icon" variant="outline" className="size-8 shrink-0" onClick={eyedropper} title="Eyedropper">
          <Pipette />
        </Button>
        <Button size="icon" variant="outline" className="size-8 shrink-0" onClick={randomize} title="Random colour">
          <Shuffle />
        </Button>
        <Button size="icon" variant="outline" className="size-8 shrink-0" onClick={saveCurrent} title="Save swatch">
          <Bookmark />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="size-8 shrink-0"
          onClick={() => setExportOpen(true)}
          title="Export palette"
        >
          <Download />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab bodies */}
      {tab === 'Formats' && (
        <div className="space-y-1.5">
          {formats.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => copy(f.value, f.label)}
              className="group flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left hover:bg-muted"
            >
              <span className="w-12 shrink-0 text-xs font-semibold text-muted-foreground">
                {f.label}
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-xs">{f.value}</code>
              {copied === f.label ? (
                <Check className="size-3.5 shrink-0 text-green-500" />
              ) : (
                <Copy className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
              )}
            </button>
          ))}
        </div>
      )}

      {tab === 'Harmony' && (
        <div className="space-y-3">
          {Object.entries(HARMONIES).map(([name, offsets]) => {
            const cols = offsets ? harmonyColors(offsets) : monochrome()
            return (
              <div key={name}>
                <div className="mb-1 text-xs font-medium text-muted-foreground">{name}</div>
                <div className="flex gap-1">
                  {cols.map((c, i) => (
                    <Swatch key={`${name}-${i}`} value={c} onClick={() => setFromHex(c)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'Shades' && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Tints → base → shades</div>
          <div className="grid grid-cols-1 gap-1">
            {shades().map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => copy(c, `shade-${i}`)}
                className="flex h-7 items-center justify-between rounded-md px-2 font-mono text-[11px] transition-transform hover:scale-[1.01]"
                style={{ background: c, color: textOn(hexToRgb(c)) }}
                title="Click to copy"
              >
                <span>{(i - 5) * 100 === 0 ? 'base' : `${i * 100}`}</span>
                <span>{c.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'Contrast' && (
        <div className="space-y-3 text-sm">
          {[
            { label: 'On white', bg: { r: 255, g: 255, b: 255 }, ratio: ratioWhite },
            { label: 'On black', bg: { r: 0, g: 0, b: 0 }, ratio: ratioBlack },
          ].map((row) => (
            <ContrastRow key={row.label} {...row} fg={rgb} />
          ))}
          <div className="rounded-lg border p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Vs custom bg</span>
              <input
                type="color"
                value={rgbToHex(cmpBg)}
                onChange={(e) => {
                  const p = hexToRgb(e.target.value)
                  if (p) setCmpBg(p)
                }}
                className="h-6 w-8 cursor-pointer rounded border bg-transparent"
                aria-label="Comparison background"
              />
            </div>
            <ContrastRow label="Sample" bg={cmpBg} ratio={ratioCmp} fg={rgb} showSample />
          </div>
        </div>
      )}

      {tab === 'Image' && (
        <div className="space-y-3">
          <input
            ref={imgInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) extractFromImage(e.target.files[0])
              e.target.value = ''
            }}
          />
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (e.dataTransfer?.files?.[0]) extractFromImage(e.dataTransfer.files[0])
            }}
            onClick={() => imgInputRef.current?.click()}
            className="grid cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed"
          >
            {imgUrl ? (
              <img src={imgUrl} alt="Source" className="max-h-40 w-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
                <ImagePlus className="size-8" />
                <p className="text-sm">Drop an image or click to extract its colours.</p>
              </div>
            )}
          </div>

          {extracted.length > 0 && (
            <>
              <div className="flex h-12 overflow-hidden rounded-lg border">
                {extracted.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFromHex(c)}
                    className="flex-1 transition-transform hover:scale-y-110"
                    style={{ background: c }}
                    title={`${c} — click to use`}
                    aria-label={`Use ${c}`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => imgInputRef.current?.click()}
                >
                  <Upload className="mr-1 size-4" /> New image
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    const merged = [...extracted.filter((c) => !saved.includes(c)), ...saved].slice(0, 60)
                    persist(merged)
                    toast.success('Palette saved to swatches')
                  }}
                >
                  <Plus className="mr-1 size-4" /> Save palette
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'Saved' && (
        <div className="space-y-2">
          {saved.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
              <Palette className="size-6" />
              <p className="text-sm">
                No swatches yet. Hit <Bookmark className="inline size-3.5" /> to save.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-6 gap-1.5 @sm:grid-cols-8">
                {saved.map((c) => (
                  <div key={c} className="group relative">
                    <button
                      type="button"
                      onClick={() => setFromHex(c)}
                      className="aspect-square w-full rounded-md border shadow-inner transition-transform hover:scale-110"
                      style={{ background: c }}
                      title={c}
                      aria-label={`Use ${c}`}
                    />
                    <button
                      type="button"
                      onClick={() => persist(saved.filter((s) => s !== c))}
                      className="absolute -right-1 -top-1 hidden rounded-full bg-destructive p-0.5 text-white group-hover:block"
                      aria-label={`Remove ${c}`}
                    >
                      <Trash2 className="size-2.5" />
                    </button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={saveCurrent}>
                <Plus className="mr-1 size-4" /> Add current
              </Button>
            </>
          )}
        </div>
      )}

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} sources={exportSources} />
    </div>
  )
}

// Small contrast-result row: sample text on bg + ratio + AA/AAA badges.
function ContrastRow({ label, bg, fg, ratio, showSample }) {
  const bgHex = rgbToHex(bg)
  const fgHex = rgbToHex(fg)
  const badge = (ok, text) => (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        ok ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-destructive/15 text-destructive'
      }`}
    >
      {text} {ok ? '✓' : '✕'}
    </span>
  )
  return (
    <div className="flex items-center gap-2">
      <div
        className="grid h-9 w-16 shrink-0 place-items-center rounded-md border font-semibold"
        style={{ background: bgHex, color: fgHex }}
      >
        {showSample ? 'Aa' : label.replace('On ', '')}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-sm">{round(ratio, 2)}:1</div>
        <div className="mt-0.5 flex flex-wrap gap-1">
          {badge(ratio >= 4.5, 'AA')}
          {badge(ratio >= 7, 'AAA')}
          {badge(ratio >= 3, 'AA Lg')}
        </div>
      </div>
    </div>
  )
}

export default ColorStudio
