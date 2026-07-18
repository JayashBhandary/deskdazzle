import React, { useEffect, useRef, useState } from 'react';
import { Download, FileArchive, ImagePlus, Images, Loader2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import ToolPage from '../components/ToolPage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { convertImage } from '@/lib/converter-client';
import { zipBlobs } from '@/lib/zip';
import { EXT, humanBytes } from '@/lib/image-shared';

const FORMATS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
];

// How many images are converted at once. The heavy lifting happens in the
// wasm Web Worker, so this mostly bounds decode/encode memory pressure.
const CONCURRENCY = 3;

let nextId = 0;

function outName(name, format) {
  return `${name.replace(/\.[^.]+$/, '')}.${EXT[format]}`;
}

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

// Batch image conversion: every file runs through the Rust/WASM core in a
// background worker, a few at a time, and never leaves the device.
export function BatchPanel() {
  // Each item: { id, file, status: 'pending'|'working'|'done'|'error', result?, name?, error? }
  const [items, setItems] = useState([]);
  const [format, setFormat] = useState('webp');
  const [maxSize, setMaxSize] = useState(0);
  const [quality, setQuality] = useState(85);
  const [busy, setBusy] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const runRef = useRef(0); // bumped to cancel in-flight batches
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Revoke any leftover object URLs when the page unmounts.
  useEffect(
    () => () => {
      for (const it of itemsRef.current) {
        if (it.result?.url) URL.revokeObjectURL(it.result.url);
      }
    },
    [],
  );

  const addFiles = (fileList) => {
    const images = Array.from(fileList || []).filter(
      (f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(f.name),
    );
    if (!images.length) {
      toast.error('No image files found in that selection');
      return;
    }
    setItems((prev) => [
      ...prev,
      ...images.map((file) => ({ id: ++nextId, file, status: 'pending' })),
    ]);
  };

  // Settings changed → previous results no longer match; back to pending.
  const resetResults = (updater) => {
    runRef.current += 1;
    setItems((prev) =>
      prev.map((it) => {
        if (it.result?.url) URL.revokeObjectURL(it.result.url);
        return { id: it.id, file: it.file, status: 'pending' };
      }),
    );
    updater();
  };

  const removeItem = (id) => {
    setItems((prev) =>
      prev.filter((it) => {
        if (it.id !== id) return true;
        if (it.result?.url) URL.revokeObjectURL(it.result.url);
        return false;
      }),
    );
  };

  const clearAll = () => {
    runRef.current += 1;
    setItems((prev) => {
      for (const it of prev) if (it.result?.url) URL.revokeObjectURL(it.result.url);
      return [];
    });
  };

  const convertAll = async () => {
    const queue = itemsRef.current.filter((it) => it.status !== 'done');
    if (!queue.length || busy) return;
    setBusy(true);
    const run = ++runRef.current;
    const opts = {
      format,
      maxSize: Math.max(0, Math.floor(Number(maxSize) || 0)),
      quality: quality / 100,
    };
    let failed = 0;

    const worker = async () => {
      while (queue.length) {
        if (runRef.current !== run) return;
        const item = queue.shift();
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: 'working' } : it)),
        );
        try {
          const out = await convertImage(item.file, opts);
          setItems((prev) => {
            // Batch cancelled or row removed mid-flight → drop the result.
            if (runRef.current !== run || !prev.some((it) => it.id === item.id)) {
              URL.revokeObjectURL(out.url);
              return prev;
            }
            return prev.map((it) =>
              it.id === item.id
                ? { ...it, status: 'done', result: out, name: outName(item.file.name, opts.format) }
                : it,
            );
          });
        } catch (err) {
          failed += 1;
          const message = err instanceof Error ? err.message : String(err);
          setItems((prev) =>
            prev.map((it) => (it.id === item.id ? { ...it, status: 'error', error: message } : it)),
          );
        }
      }
    };

    const total = queue.length;
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
    setBusy(false);
    if (runRef.current !== run) return;
    if (failed === 0) toast.success(`Converted ${total} image${total === 1 ? '' : 's'}`);
    else toast.error(`${failed} of ${total} conversion${total === 1 ? '' : 's'} failed`);
  };

  const downloadAll = async () => {
    const done = itemsRef.current.filter((it) => it.status === 'done');
    if (!done.length || zipping) return;
    setZipping(true);
    try {
      const blob = await zipBlobs(done.map((it) => ({ name: it.name, blob: it.result.blob })));
      const url = URL.createObjectURL(blob);
      triggerDownload(url, 'deskdazzle-images.zip');
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success(`Zipped ${done.length} image${done.length === 1 ? '' : 's'} (${humanBytes(blob.size)})`);
    } catch (err) {
      toast.error(`Zip failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setZipping(false);
    }
  };

  const doneCount = items.filter((it) => it.status === 'done').length;
  const pendingCount = items.filter((it) => it.status !== 'done').length;
  const lossy = format === 'jpeg' || format === 'webp';

  return (
    <>
      <div className="space-y-4">
        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-muted/30 px-6 py-10 text-center transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring ${
            dragging ? 'border-primary bg-muted/60' : 'border-border'
          }`}
        >
          <ImagePlus className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">Drop images here, or click to browse</p>
          <p className="text-xs text-muted-foreground">
            Add as many as you like, in as many batches as you like.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {/* Settings + actions */}
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="batch-format">Format</Label>
                <Select
                  value={format}
                  onValueChange={(v) => resetResults(() => setFormat(v))}
                  disabled={busy}
                >
                  <SelectTrigger id="batch-format" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="batch-max-size">Max size (px, 0 = original)</Label>
                <Input
                  id="batch-max-size"
                  type="number"
                  min="0"
                  step="1"
                  className="w-40"
                  value={maxSize}
                  disabled={busy}
                  onChange={(e) => resetResults(() => setMaxSize(e.target.value))}
                />
              </div>

              <div className="grid min-w-44 gap-1.5">
                <Label htmlFor="batch-quality" className={lossy ? '' : 'text-muted-foreground'}>
                  Quality: {quality}%{lossy ? '' : ' (PNG is lossless)'}
                </Label>
                <input
                  id="batch-quality"
                  type="range"
                  min="10"
                  max="100"
                  step="1"
                  value={quality}
                  disabled={busy || !lossy}
                  onChange={(e) => resetResults(() => setQuality(Number(e.target.value)))}
                  className="h-2 w-44 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={convertAll} disabled={busy || pendingCount === 0}>
                {busy ? <Loader2 className="animate-spin" /> : <Images />}
                Convert all{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </Button>
              <Button variant="outline" onClick={downloadAll} disabled={doneCount === 0 || zipping}>
                {zipping ? <Loader2 className="animate-spin" /> : <FileArchive />}
                Download all (.zip)
              </Button>
              <Button variant="ghost" onClick={clearAll} disabled={items.length === 0}>
                <Trash2 /> Clear
              </Button>
              {items.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {items.length} file{items.length === 1 ? '' : 's'}
                  {doneCount > 0 ? ` · ${doneCount} converted` : ''}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* File list */}
        {items.length > 0 && (
          <Card>
            <CardContent>
              <ul className="divide-y">
                {items.map((it) => {
                  const pctSmaller =
                    it.status === 'done' && it.file.size > 0
                      ? Math.round((1 - it.result.bytes / it.file.size) * 100)
                      : 0;
                  return (
                    <li key={it.id} className="flex items-center gap-3 py-2.5">
                      {it.status === 'done' ? (
                        <img
                          src={it.result.url}
                          alt=""
                          className="size-10 shrink-0 rounded-md bg-muted object-cover"
                        />
                      ) : (
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                          {it.status === 'working' ? (
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                          ) : (
                            <ImagePlus className="size-4 text-muted-foreground" aria-hidden="true" />
                          )}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {it.status === 'done' ? it.name : it.file.name}
                        </p>
                        {it.status === 'done' ? (
                          <p className="text-xs text-muted-foreground">
                            {humanBytes(it.file.size)} → {humanBytes(it.result.bytes)}
                            {' · '}
                            {it.result.width} × {it.result.height}px
                            {it.result.downscaled ? ' (downscaled)' : ''}
                          </p>
                        ) : it.status === 'error' ? (
                          <p className="truncate text-xs text-destructive">{it.error}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {humanBytes(it.file.size)}
                            {it.status === 'working' ? ' · converting…' : ' · pending'}
                          </p>
                        )}
                      </div>

                      {it.status === 'done' && pctSmaller > 0 && (
                        <Badge variant="secondary" className="shrink-0">
                          {pctSmaller}% smaller
                        </Badge>
                      )}
                      {it.status === 'done' && pctSmaller < 0 && (
                        <Badge variant="outline" className="shrink-0">
                          {Math.abs(pctSmaller)}% larger
                        </Badge>
                      )}
                      {it.status === 'error' && (
                        <Badge variant="destructive" className="shrink-0">Failed</Badge>
                      )}

                      {it.status === 'done' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Download ${it.name}`}
                          onClick={() => triggerDownload(it.result.url, it.name)}
                        >
                          <Download />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${it.file.name}`}
                        onClick={() => removeItem(it.id)}
                      >
                        <X />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

export default function BatchImageConverter() {
  return (
    <ToolPage
      wide
      icon="🗂️"
      title="Batch Image Converter"
      description="Convert whole folders of images to PNG, JPEG or WebP at once. Converted on-device — works offline."
    >
      <BatchPanel />
    </ToolPage>
  );
}
