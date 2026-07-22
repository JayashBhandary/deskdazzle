import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, Combine, Download, Eye, FileText, FileUp, Images, Loader2,
  Minus, Plus, RotateCw, Trash2, Wand2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { office, downloadBytes, readFileBytes, MIME } from '@/lib/office';
import { humanDuration } from '@/lib/image-shared';
import { openPdf, renderPageToCanvas, renderPageToBlob } from '@/lib/pdfjs';
import { canConvertToPdf, fileToPdf } from './pdfShared';
import { consumeOpen } from '@/lib/openWith';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// The PDF app. Viewing comes first (real pdf.js rendering — fast, lazy, handles
// 1000+ pages), then Organize (reorder/rotate/delete/extract with true page
// thumbnails), Convert-to-PDF (images/office/text/mixed → PDF, on-device) and
// Pages→Images (render every page to PNG/JPEG/WebP and zip via the Rust core).
function PdfApp() {
  // The one open document, shared by View / Organize / Pages→Images.
  const [bytes, setBytes] = useState(null); // Uint8Array of the source PDF
  const [doc, setDoc] = useState(null); // pdf.js document proxy
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const docRef = useRef(null);

  // Destroy the previous pdf.js doc when it changes / on unmount (frees worker
  // memory — important for big files).
  useEffect(() => {
    docRef.current = doc;
    return () => { if (docRef.current && docRef.current !== doc) docRef.current.destroy?.(); };
  }, [doc]);
  useEffect(() => () => { docRef.current?.destroy?.(); }, []);

  const openBytes = useCallback(async (buf, fname) => {
    setLoading(true);
    try {
      const t0 = performance.now();
      const d = await openPdf(buf);
      const ms = performance.now() - t0;
      docRef.current?.destroy?.();
      setBytes(buf);
      setDoc(d);
      setName((fname || 'document').replace(/\.pdf$/i, ''));
      toast.success(`Opened ${d.numPages} page${d.numPages > 1 ? 's' : ''} · ${humanDuration(ms)}`);
    } catch (err) {
      toast.error(`Couldn't open that PDF: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }, []);
  const openFile = async (file) => { if (file) openBytes(await readFileBytes(file), file.name); };
  const onInput = (e) => { const f = e.target.files?.[0]; e.target.value = ''; openFile(f); };

  // Opened from Drive ("Open in PDF").
  useEffect(() => {
    const pending = consumeOpen('pdf');
    if (pending) openBytes(pending.bytes, pending.name);
  }, [openBytes]);

  const openBar = (
    <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onInput} />
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => inputRef.current?.click()} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />} Open PDF
      </Button>
      {doc && <span className="truncate text-sm text-muted-foreground">{name}.pdf · {doc.numPages} pages</span>}
    </div>
  );

  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <Tabs defaultValue="view" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="shrink-0 flex-wrap">
          <TabsTrigger value="view" className="gap-1.5"><Eye className="size-4" /> View</TabsTrigger>
          <TabsTrigger value="organize" className="gap-1.5"><Wand2 className="size-4" /> Organize</TabsTrigger>
          <TabsTrigger value="topdf" className="gap-1.5"><Combine className="size-4" /> To PDF</TabsTrigger>
          <TabsTrigger value="images" className="gap-1.5"><Images className="size-4" /> Pages → Images</TabsTrigger>
        </TabsList>

        <TabsContent value="view" className="mt-2 flex min-h-0 flex-1 flex-col">
          {openBar}
          <ViewTab doc={doc} />
        </TabsContent>
        <TabsContent value="organize" className="mt-2 flex min-h-0 flex-1 flex-col">
          {openBar}
          <OrganizeTab doc={doc} bytes={bytes} name={name} />
        </TabsContent>
        <TabsContent value="topdf" className="mt-2 min-h-0 flex-1 overflow-y-auto">
          <ToPdfTab />
        </TabsContent>
        <TabsContent value="images" className="mt-2 flex min-h-0 flex-1 flex-col">
          {openBar}
          <ImagesTab doc={doc} name={name} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// A single page canvas that renders only while near the viewport and frees
// itself when scrolled far away — keeps memory bounded on huge documents.
function LazyPage({ doc, n, scale = 1.4, rotate = 0, className, onClick }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [dims, setDims] = useState(null); // {w,h} placeholder aspect
  const [visible, setVisible] = useState(false);
  const renderId = useRef(0);

  // Cheap: page metadata for the placeholder aspect ratio.
  useEffect(() => {
    let alive = true;
    doc.getPage(n).then((p) => {
      if (!alive) return;
      const vp = p.getViewport({ scale: 1, rotation: (p.rotate + rotate) % 360 });
      setDims({ w: vp.width, h: vp.height });
    }).catch(() => {});
    return () => { alive = false; };
  }, [doc, n, rotate]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { root: null, rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) {
      // free the bitmap when off-screen
      const c = canvasRef.current;
      if (c) { c.width = 0; c.height = 0; }
      return;
    }
    const id = ++renderId.current;
    renderPageToCanvas(doc, n, scale, rotate).then((canvas) => {
      if (id !== renderId.current) return;
      const target = canvasRef.current;
      if (!target) return;
      target.width = canvas.width; target.height = canvas.height;
      target.getContext('2d').drawImage(canvas, 0, 0);
    }).catch(() => {});
  }, [visible, doc, n, scale, rotate]);

  const aspect = dims ? dims.w / dims.h : 0.707;
  return (
    <div
      ref={wrapRef}
      className={cn('relative overflow-hidden rounded border bg-white shadow-sm', onClick && 'cursor-zoom-in', className)}
      style={{ aspectRatio: String(aspect) }}
      onClick={onClick}
    >
      <canvas ref={canvasRef} className="h-full w-full object-contain" />
      {!visible && <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><FileText className="size-6 opacity-30" /></div>}
    </div>
  );
}

function ViewTab({ doc }) {
  const [scale, setScale] = useState(1.4);
  const [zoomPage, setZoomPage] = useState(null); // full-screen page number
  if (!doc) {
    return <Card className="flex-1"><CardContent className="flex h-full items-center justify-center py-10 text-center text-sm text-muted-foreground">Open a PDF to view it here.</CardContent></Card>;
  }
  const pages = Array.from({ length: doc.numPages }, (_, i) => i + 1);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex shrink-0 items-center gap-1">
        <Button variant="outline" size="icon" className="size-8" onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(2)))} aria-label="Zoom out"><Minus className="size-4" /></Button>
        <span className="w-14 text-center text-xs tabular-nums text-muted-foreground">{Math.round(scale / 1.4 * 100)}%</span>
        <Button variant="outline" size="icon" className="size-8" onClick={() => setScale((s) => Math.min(4, +(s + 0.2).toFixed(2)))} aria-label="Zoom in"><Plus className="size-4" /></Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted/30 p-3">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3">
          {pages.map((n) => (
            <div key={n} className="w-full" style={{ maxWidth: 640 * (scale / 1.4) }}>
              <LazyPage doc={doc} n={n} scale={scale} onClick={() => setZoomPage(n)} />
              <p className="mt-0.5 text-center text-[11px] text-muted-foreground">{n}</p>
            </div>
          ))}
        </div>
      </div>
      {zoomPage && (
        <div className="fixed inset-0 z-[6000] flex flex-col bg-black/80" onClick={() => setZoomPage(null)}>
          <div className="flex shrink-0 items-center justify-between p-2 text-white">
            <span className="text-sm">Page {zoomPage} / {doc.numPages}</span>
            <Button size="sm" variant="secondary" onClick={() => setZoomPage(null)}><X className="size-4" /></Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto max-w-4xl"><LazyPage doc={doc} n={zoomPage} scale={2.4} /></div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrganizeTab({ doc, bytes, name }) {
  const [pages, setPages] = useState([]); // { src: origIndex(0-based), rotate }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (doc) setPages(Array.from({ length: doc.numPages }, (_, i) => ({ src: i, rotate: 0 })));
    else setPages([]);
  }, [doc]);

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= pages.length) return;
    setPages((prev) => { const next = [...prev]; [next[i], next[j]] = [next[j], next[i]]; return next; });
  };
  const rotate = (i) => setPages((prev) => prev.map((p, idx) => (idx === i ? { ...p, rotate: (p.rotate + 90) % 360 } : p)));
  const removeAt = (i) => setPages((prev) => prev.filter((_, idx) => idx !== i));

  const apply = async () => {
    if (!bytes || pages.length === 0) { toast.error('Nothing to export'); return; }
    setBusy(true);
    try {
      const t0 = performance.now();
      const out = await office.pdfOrganize(bytes, pages.map((p) => ({ page: p.src, rotate: p.rotate })));
      const ms = performance.now() - t0;
      downloadBytes(out, `${name || 'organized'}.pdf`, MIME.pdf);
      toast.success(`Exported ${pages.length} pages · ${humanDuration(ms)}`);
    } catch (err) {
      toast.error(`Export failed: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  if (!doc) {
    return <Card className="flex-1"><CardContent className="flex h-full items-center justify-center py-10 text-center text-sm text-muted-foreground">Open a PDF to reorder, rotate, delete or extract its pages.</CardContent></Card>;
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex shrink-0 items-center gap-2">
        <Button className="gap-1.5" size="sm" onClick={apply} disabled={busy || pages.length === 0}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Export {pages.length} pages
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border p-2">
        <div className="grid grid-cols-2 gap-2 @md:grid-cols-3 @xl:grid-cols-4">
          {pages.map((p, i) => (
            <div key={`${p.src}-${i}`} className="flex flex-col gap-1.5 rounded-md border p-1.5">
              <LazyPage doc={doc} n={p.src + 1} scale={0.5} rotate={p.rotate} />
              <div className="flex items-center justify-between gap-0.5">
                <span className="text-[11px] text-muted-foreground">{i + 1}{p.rotate ? ` · ${p.rotate}°` : ''}</span>
                <div className="flex">
                  <Button variant="ghost" size="icon" className="size-6" onClick={() => move(i, -1)} aria-label="Move earlier"><ArrowUp className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="size-6" onClick={() => move(i, 1)} aria-label="Move later"><ArrowDown className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="size-6" onClick={() => rotate(i)} aria-label="Rotate"><RotateCw className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="size-6 text-destructive hover:text-destructive" onClick={() => removeAt(i)} aria-label="Delete page"><Trash2 className="size-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const IMG_FORMATS = [
  { mime: 'image/png', ext: 'png', label: 'PNG' },
  { mime: 'image/jpeg', ext: 'jpg', label: 'JPEG' },
  { mime: 'image/webp', ext: 'webp', label: 'WebP' },
];

function ImagesTab({ doc, name }) {
  const [fmt, setFmt] = useState('image/png');
  const [scale, setScale] = useState(1.5);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const exportZip = async () => {
    if (!doc) return;
    const meta = IMG_FORMATS.find((f) => f.mime === fmt);
    setBusy(true);
    setProgress(0);
    try {
      const t0 = performance.now();
      const entries = [];
      const pad = String(doc.numPages).length;
      for (let n = 1; n <= doc.numPages; n++) {
        const blob = await renderPageToBlob(doc, n, { scale, mime: fmt, quality: 0.92 });
        entries.push({ name: `${name || 'page'}-${String(n).padStart(pad, '0')}.${meta.ext}`, bytes: new Uint8Array(await blob.arrayBuffer()) });
        setProgress(n);
      }
      // Zip in Rust/wasm.
      const zip = await office.zipFiles(entries);
      const ms = performance.now() - t0;
      downloadBytes(zip, `${name || 'pages'}-${meta.ext}.zip`, 'application/zip');
      toast.success(`Exported ${doc.numPages} ${meta.label} pages · ${humanDuration(ms)}`);
    } catch (err) {
      toast.error(`Export failed: ${err.message || err}`);
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  if (!doc) {
    return <Card className="flex-1"><CardContent className="flex h-full items-center justify-center py-10 text-center text-sm text-muted-foreground">Open a PDF to export its pages as images.</CardContent></Card>;
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
        <label className="flex items-center gap-2 text-sm">
          Format
          <select value={fmt} onChange={(e) => setFmt(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary" disabled={busy}>
            {IMG_FORMATS.map((f) => <option key={f.mime} value={f.mime}>{f.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Quality
          <select value={scale} onChange={(e) => setScale(Number(e.target.value))} className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary" disabled={busy}>
            <option value={1}>Screen (1×)</option>
            <option value={1.5}>High (1.5×)</option>
            <option value={2}>Print (2×)</option>
            <option value={3}>Max (3×)</option>
          </select>
        </label>
        <Button className="gap-1.5" onClick={exportZip} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {busy ? `Rendering ${progress}/${doc.numPages}…` : `Export ${doc.numPages} pages as .zip`}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Each page is rendered to {IMG_FORMATS.find((f) => f.mime === fmt).label}, then bundled into a .zip on-device (zip built in Rust/wasm).</p>
    </div>
  );
}

function ToPdfTab() {
  const [files, setFiles] = useState([]); // { name, file }
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const add = (list) => {
    const picked = Array.from(list || []).filter((f) => canConvertToPdf(f.name));
    const rejected = Array.from(list || []).length - picked.length;
    if (rejected) toast.error(`${rejected} unsupported file${rejected > 1 ? 's' : ''} skipped`);
    setFiles((prev) => [...prev, ...picked.map((f) => ({ name: f.name, file: f }))]);
  };
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= files.length) return;
    setFiles((prev) => { const next = [...prev]; [next[i], next[j]] = [next[j], next[i]]; return next; });
  };
  const removeAt = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const convert = async (mergeAll) => {
    if (!files.length) { toast.error('Add some files first'); return; }
    setBusy(true);
    try {
      const t0 = performance.now();
      const pdfs = [];
      for (const f of files) {
        try { pdfs.push({ name: f.name, bytes: await fileToPdf(f.file) }); }
        catch (err) { toast.error(`${f.name}: ${err.message || err}`); }
      }
      if (!pdfs.length) return;
      if (mergeAll && pdfs.length > 1) {
        const merged = await office.pdfMergeAll(pdfs.map((p) => p.bytes));
        downloadBytes(merged, 'combined.pdf', MIME.pdf);
      } else if (pdfs.length === 1) {
        downloadBytes(pdfs[0].bytes, `${pdfs[0].name.replace(/\.[^.]+$/, '')}.pdf`, MIME.pdf);
      } else {
        // separate PDFs → zip (Rust)
        const zip = await office.zipFiles(pdfs.map((p) => ({ name: `${p.name.replace(/\.[^.]+$/, '')}.pdf`, bytes: p.bytes })));
        downloadBytes(zip, 'converted-pdfs.zip', 'application/zip');
      }
      const ms = performance.now() - t0;
      toast.success(`Converted ${pdfs.length} file${pdfs.length > 1 ? 's' : ''} · ${humanDuration(ms)}`);
    } catch (err) {
      toast.error(`Convert failed: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="space-y-3 p-1"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); add(e.dataTransfer.files); }}
    >
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="gap-1.5" onClick={() => inputRef.current?.click()}><FileUp className="size-4" /> Add files</Button>
        <Button className="gap-1.5" onClick={() => convert(true)} disabled={busy || !files.length}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Combine className="size-4" />} Convert &amp; merge to one PDF
        </Button>
        <Button variant="secondary" className="gap-1.5" onClick={() => convert(false)} disabled={busy || !files.length}>
          <Download className="size-4" /> Convert separately
        </Button>
      </div>
      <div className={cn('rounded-md border p-2', dragOver && 'border-primary ring-2 ring-primary/40')}>
        {files.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Drop images, Word/Excel/PowerPoint, text/markdown or PDFs here — combine any mix into one PDF.
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <span className="w-5 shrink-0 text-center text-muted-foreground">{i + 1}</span>
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="size-4" /></Button>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="size-4" /></Button>
                <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => removeAt(i)} aria-label="Remove"><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Supported: images (PNG/JPEG/WebP/GIF/BMP), Word, Excel, PowerPoint, CSV, text, Markdown, and PDFs.</p>
    </div>
  );
}

export default PdfApp;
