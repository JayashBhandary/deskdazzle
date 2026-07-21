import React, { useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, Combine, Download, FileText, FileUp, RotateCw, Trash2, Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { office, downloadBytes, readFileBytes, MIME } from '@/lib/office';
import { useStore } from '@/lib/store/WorkspaceProvider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Turn the light-markup composer text into a Word document model, which the
// office core renders to PDF. Supports #/##/### headings, - / * bullets, and
// plain paragraphs.
function composeToWordDoc(title, text) {
  const blocks = [];
  if (title.trim()) blocks.push({ type: 'heading', level: 1, text: title.trim() });
  let list = null;
  const flushList = () => {
    if (list) {
      blocks.push({ type: 'list', ordered: false, items: list });
      list = null;
    }
  };
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const b = line.match(/^[-*]\s+(.*)$/);
    if (h) {
      flushList();
      blocks.push({ type: 'heading', level: Math.min(3, h[1].length) + 1, text: h[2] });
    } else if (b) {
      (list ||= []).push(b[1]);
    } else if (line.trim()) {
      flushList();
      blocks.push({ type: 'paragraph', runs: [{ text: line }] });
    } else {
      flushList();
    }
  }
  flushList();
  return { blocks };
}

// The PDF app — a utility with three modes rather than a document library:
// Compose a new PDF from text, Merge several PDFs, or Organize the pages of one
// (reorder / delete / rotate / extract). All on-device via the office core.
function PdfApp() {
  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <Tabs defaultValue="compose" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="shrink-0">
          <TabsTrigger value="compose" className="gap-1.5"><FileText className="size-4" /> Compose</TabsTrigger>
          <TabsTrigger value="merge" className="gap-1.5"><Combine className="size-4" /> Merge</TabsTrigger>
          <TabsTrigger value="organize" className="gap-1.5"><Wand2 className="size-4" /> Organize</TabsTrigger>
        </TabsList>
        <TabsContent value="compose" className="min-h-0 flex-1 overflow-y-auto">
          <Compose />
        </TabsContent>
        <TabsContent value="merge" className="min-h-0 flex-1 overflow-y-auto">
          <Merge />
        </TabsContent>
        <TabsContent value="organize" className="min-h-0 flex-1 overflow-y-auto">
          <Organize />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Compose() {
  const [title, setTitle] = useStore('pdfComposeTitle', '');
  const [body, setBody] = useStore('pdfComposeBody', '');
  const [busy, setBusy] = useState(false);

  const makePdf = async () => {
    if (!title.trim() && !body.trim()) {
      toast.error('Nothing to export yet');
      return;
    }
    setBusy(true);
    try {
      const doc = composeToWordDoc(title, body);
      const bytes = await office.wordPdf(doc);
      downloadBytes(bytes, `${title.trim() || 'document'}.pdf`, MIME.pdf);
      toast.success('Exported PDF');
    } catch (err) {
      toast.error(`Export failed: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 p-1">
      <div className="flex items-center gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" className="font-medium" />
        <Button className="shrink-0 gap-1.5" onClick={makePdf} disabled={busy}>
          <Download /> Export PDF
        </Button>
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={'Write your document…\n\n# Heading\n## Subheading\n- a bullet\n- another bullet\n\nPlain paragraphs just work.'}
        className="min-h-[46vh] resize-y font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Markup: <code># / ## / ###</code> headings, <code>- </code> or <code>* </code> bullets, blank line between paragraphs.
      </p>
    </div>
  );
}

function Merge() {
  const [files, setFiles] = useState([]); // { name, bytes }
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const add = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    const loaded = await Promise.all(
      picked.map(async (f) => ({ name: f.name, bytes: await readFileBytes(f) })),
    );
    setFiles((prev) => [...prev, ...loaded]);
  };
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= files.length) return;
    setFiles((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const removeAt = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const merge = async () => {
    if (files.length < 2) {
      toast.error('Add at least two PDFs');
      return;
    }
    setBusy(true);
    try {
      const bytes = await office.pdfMergeAll(files.map((f) => f.bytes));
      downloadBytes(bytes, 'merged.pdf', MIME.pdf);
      toast.success(`Merged ${files.length} files`);
    } catch (err) {
      toast.error(`Merge failed: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 p-1">
      <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={add} />
      <div className="flex gap-2">
        <Button variant="outline" className="gap-1.5" onClick={() => inputRef.current?.click()}>
          <FileUp /> Add PDFs
        </Button>
        <Button className="gap-1.5" onClick={merge} disabled={busy || files.length < 2}>
          <Combine /> Merge & download
        </Button>
      </div>
      {files.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Add two or more PDFs to combine, in order.</CardContent></Card>
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
  );
}

function Organize() {
  const [name, setName] = useState('');
  const [src, setSrc] = useState(null); // Uint8Array of the loaded PDF
  const [pages, setPages] = useState([]); // { src: origIndex, rotate }
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const load = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const bytes = await readFileBytes(file);
      const count = await office.pdfPageCount(bytes);
      setSrc(bytes);
      setName(file.name.replace(/\.pdf$/i, ''));
      setPages(Array.from({ length: count }, (_, i) => ({ src: i, rotate: 0 })));
      toast.success(`Loaded ${count} pages`);
    } catch (err) {
      toast.error(`Couldn't read that PDF: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= pages.length) return;
    setPages((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const rotate = (i) => setPages((prev) => prev.map((p, idx) => (idx === i ? { ...p, rotate: (p.rotate + 90) % 360 } : p)));
  const removeAt = (i) => setPages((prev) => prev.filter((_, idx) => idx !== i));

  const apply = async () => {
    if (!src || pages.length === 0) {
      toast.error('Nothing to export');
      return;
    }
    setBusy(true);
    try {
      const bytes = await office.pdfOrganize(src, pages.map((p) => ({ page: p.src, rotate: p.rotate })));
      downloadBytes(bytes, `${name || 'organized'}.pdf`, MIME.pdf);
      toast.success('Exported PDF');
    } catch (err) {
      toast.error(`Export failed: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 p-1">
      <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={load} />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="gap-1.5" onClick={() => inputRef.current?.click()} disabled={busy}>
          <FileUp /> Open PDF
        </Button>
        {src && (
          <Button className="gap-1.5" onClick={apply} disabled={busy || pages.length === 0}>
            <Download /> Export {pages.length} pages
          </Button>
        )}
      </div>
      {!src ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Open a PDF to reorder, rotate, delete or extract its pages.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 gap-2 @md:grid-cols-3 @xl:grid-cols-4">
          {pages.map((p, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-md border p-2">
              <div className="flex aspect-[3/4] items-center justify-center rounded bg-muted text-muted-foreground">
                <div className={cn('text-center transition-transform', p.rotate === 90 && 'rotate-90', p.rotate === 180 && 'rotate-180', p.rotate === 270 && '-rotate-90')}>
                  <FileText className="mx-auto size-7" />
                  <span className="text-xs">p.{p.src + 1}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-0.5">
                <span className="text-xs text-muted-foreground">{i + 1}{p.rotate ? ` · ${p.rotate}°` : ''}</span>
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
      )}
    </div>
  );
}

export default PdfApp;
