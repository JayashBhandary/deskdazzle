import React, { useMemo, useState } from 'react'
import { Check, Copy, Download, FileCode, FileJson, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ExportDialog — turns a chosen palette (shade ramp, a harmony scheme, saved
// swatches, or the single colour) into every artefact a workflow needs:
//   • CSS custom properties        • SCSS variables
//   • Tailwind colour scale        • design-token JSON
//   • a plain JS hex array         • GIMP/Inkscape .gpl palette
//   • an SVG swatch strip          • a high-res PNG swatch strip
// Text formats copy to clipboard or download; images render + download.

const hexToRgb = (hex) => {
  let h = hex.replace(/^#/, '')
  if (h.length === 8) h = h.slice(0, 6) // drop alpha for image/gpl maths
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}
const textOn = (hex) => {
  const { r, g, b } = hexToRgb(hex)
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? '#000' : '#fff'
}

const FORMATS = [
  { id: 'css', label: 'CSS', ext: 'css', mime: 'text/css', icon: FileCode },
  { id: 'scss', label: 'SCSS', ext: 'scss', mime: 'text/x-scss', icon: FileCode },
  { id: 'tailwind', label: 'Tailwind', ext: 'js', mime: 'text/javascript', icon: FileCode },
  { id: 'json', label: 'JSON', ext: 'json', mime: 'application/json', icon: FileJson },
  { id: 'array', label: 'JS Array', ext: 'js', mime: 'text/javascript', icon: FileCode },
  { id: 'gpl', label: 'GIMP .gpl', ext: 'gpl', mime: 'text/plain', icon: FileCode },
  { id: 'svg', label: 'SVG', ext: 'svg', mime: 'image/svg+xml', icon: ImageIcon },
  { id: 'png', label: 'PNG', ext: 'png', mime: 'image/png', icon: ImageIcon },
]

function serialize(id, list, prefix) {
  const varName = (n) => `${prefix}-${n}`
  switch (id) {
    case 'css':
      return `:root {\n${list.map((c) => `  --${varName(c.name)}: ${c.hex};`).join('\n')}\n}`
    case 'scss':
      return list.map((c) => `$${varName(c.name)}: ${c.hex};`).join('\n')
    case 'tailwind':
      return (
        `// tailwind.config — theme.extend.colors\n'${prefix}': {\n` +
        list.map((c) => `  '${c.name}': '${c.hex}',`).join('\n') +
        `\n},`
      )
    case 'json':
      return JSON.stringify(
        Object.fromEntries(list.map((c) => [c.name, c.hex])),
        null,
        2,
      )
    case 'array':
      return `export const ${prefix.replace(/-/g, '_')} = [\n${list
        .map((c) => `  '${c.hex}',`)
        .join('\n')}\n]`
    case 'gpl':
      return (
        `GIMP Palette\nName: ${prefix}\nColumns: ${list.length}\n#\n` +
        list
          .map((c) => {
            const { r, g, b } = hexToRgb(c.hex)
            return `${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${varName(c.name)}`
          })
          .join('\n')
      )
    case 'svg': {
      const w = 120
      const h = 160
      const width = list.length * w
      const cells = list
        .map(
          (c, i) =>
            `  <rect x="${i * w}" y="0" width="${w}" height="${h}" fill="${c.hex}"/>\n` +
            `  <text x="${i * w + w / 2}" y="${h - 32}" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle" fill="${textOn(c.hex)}">${c.name}</text>\n` +
            `  <text x="${i * w + w / 2}" y="${h - 14}" font-family="monospace" font-size="12" text-anchor="middle" fill="${textOn(c.hex)}">${c.hex.toUpperCase()}</text>`,
        )
        .join('\n')
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">\n${cells}\n</svg>`
    }
    default:
      return ''
  }
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadPng(list, filename) {
  const scale = 2
  const w = 120 * scale
  const h = 160 * scale
  const canvas = document.createElement('canvas')
  canvas.width = list.length * w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  list.forEach((c, i) => {
    ctx.fillStyle = c.hex
    ctx.fillRect(i * w, 0, w, h)
    ctx.fillStyle = textOn(c.hex)
    ctx.textAlign = 'center'
    ctx.font = `bold ${14 * scale}px monospace`
    ctx.fillText(c.name, i * w + w / 2, h - 32 * scale)
    ctx.font = `${12 * scale}px monospace`
    ctx.fillText(c.hex.toUpperCase(), i * w + w / 2, h - 14 * scale)
  })
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(filename, blob)
  }, 'image/png')
}

export default function ExportDialog({ open, onOpenChange, sources }) {
  const sourceKeys = Object.keys(sources)
  const [source, setSource] = useState(sourceKeys[0] ?? '')
  const [format, setFormat] = useState('css')
  const [prefix, setPrefix] = useState('color')
  const [copied, setCopied] = useState(false)

  const activeSource = sources[source] ?? sources[sourceKeys[0]] ?? []
  const list = activeSource
  const fmt = FORMATS.find((f) => f.id === format) ?? FORMATS[0]

  const code = useMemo(() => {
    if (format === 'png') return ''
    return serialize(format, list, prefix)
  }, [format, list, prefix])

  const filename = `${prefix}-${source}`.replace(/\s+/g, '-').toLowerCase()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 1200)
    } catch {
      toast.error('Clipboard unavailable')
    }
  }

  const download = () => {
    if (format === 'png') {
      downloadPng(list, `${filename}.png`)
    } else {
      downloadBlob(`${filename}.${fmt.ext}`, new Blob([code], { type: fmt.mime }))
    }
    toast.success(`Downloaded ${filename}.${fmt.ext}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-3 overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-5" /> Export palette
          </DialogTitle>
          <DialogDescription>
            Pick a source and format — copy the snippet or download the file / image.
          </DialogDescription>
        </DialogHeader>

        {/* Source */}
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Source</div>
          <div className="flex flex-wrap gap-1.5">
            {sourceKeys.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSource(k)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  source === k
                    ? 'bg-primary text-primary-foreground'
                    : 'border text-muted-foreground hover:bg-muted'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Live swatch strip */}
        <div className="flex h-14 overflow-hidden rounded-lg border">
          {list.map((c) => (
            <div
              key={c.name}
              className="flex flex-1 items-end justify-center pb-1"
              style={{ background: c.hex, color: textOn(c.hex) }}
              title={`${c.name} · ${c.hex}`}
            >
              <span className="text-[9px] font-mono">{c.hex.slice(1, 4)}</span>
            </div>
          ))}
        </div>

        {/* Format */}
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Format</div>
          <div className="flex flex-wrap gap-1.5">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormat(f.id)}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  format === f.id
                    ? 'bg-primary text-primary-foreground'
                    : 'border text-muted-foreground hover:bg-muted'
                }`}
              >
                <f.icon className="size-3.5" />
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prefix / name */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="exp-prefix">
            Name
          </label>
          <input
            id="exp-prefix"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.replace(/[^\w-]/g, '') || 'color')}
            className="w-40 rounded-md border bg-background px-2 py-1 font-mono text-sm outline-none"
          />
        </div>

        {/* Preview */}
        {format === 'png' ? (
          <div className="rounded-lg border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
            High-res PNG ({list.length} × 120px swatches). Hit Download to save.
          </div>
        ) : (
          <pre className="max-h-56 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
            {code}
          </pre>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          {format !== 'png' && (
            <Button variant="outline" onClick={copy}>
              {copied ? <Check className="text-green-500" /> : <Copy />}
              Copy
            </Button>
          )}
          <Button onClick={download}>
            <Download /> Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
