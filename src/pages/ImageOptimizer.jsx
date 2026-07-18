import React, { useRef, useState } from 'react';
import { Download, ImagePlus, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import ToolPage from '../components/ToolPage';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { convertImage } from '@/lib/converter-client';
import { humanBytes, EXT } from '@/lib/image-shared';

const FORMATS = [
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
];

// Compression runs in the Rust/WASM core inside a Web Worker (with an
// automatic Canvas fallback), so big photos never freeze the page.
export function OptimizePanel() {
  const [file, setFile] = useState(null);
  const [srcUrl, setSrcUrl] = useState(null);
  const [fileName, setFileName] = useState('image');
  const [quality, setQuality] = useState(0.7);
  const [format, setFormat] = useState('jpeg');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const clearResult = () => {
    setResult((r) => {
      if (r?.url) URL.revokeObjectURL(r.url);
      return null;
    });
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name.replace(/\.[^.]+$/, ''));
    setFile(f);
    clearResult();
    setSrcUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    e.target.value = '';
  };

  const optimize = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const out = await convertImage(file, { format, maxSize: 0, quality });
      clearResult();
      setResult(out);
      const pct = Math.max(0, Math.round((1 - out.bytes / file.size) * 100));
      toast.success(`Optimized: ${humanBytes(out.bytes)} (${pct}% smaller)`);
    } catch (err) {
      toast.error(`Optimize failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `${fileName}-optimized.${EXT[format]}`;
    a.click();
  };

  const saved = result && file?.size
    ? Math.max(0, Math.round((1 - result.bytes / file.size) * 100))
    : 0;
  const previewUrl = result?.url || srcUrl;

  return (
    <>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(260px,340px)_1fr]">
        <Card>
          <CardContent className="space-y-5">
            <Button className="w-full" variant={file ? 'secondary' : 'default'} onClick={() => fileRef.current?.click()}>
              <ImagePlus /> {file ? 'Choose another image' : 'Choose image'}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />

            {file && (
              <>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="opt-quality">Quality</Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {Math.round(quality * 100)}%
                    </span>
                  </div>
                  <input
                    id="opt-quality"
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={quality}
                    onChange={(e) => { setQuality(Number(e.target.value)); clearResult(); }}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="opt-format">Format</Label>
                  <Select
                    value={format}
                    onValueChange={(v) => { setFormat(v); clearResult(); }}
                  >
                    <SelectTrigger id="opt-format" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMATS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <p className="text-xs text-muted-foreground">
                  Original size: {humanBytes(file.size)}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={optimize} disabled={busy}>
                    {busy ? <Loader2 className="animate-spin" /> : <Zap />} Optimize
                  </Button>
                  <Button variant="outline" onClick={download} disabled={!result}>
                    <Download /> Download
                  </Button>
                </div>

                {result && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{humanBytes(file.size)} → {humanBytes(result.bytes)}</span>
                    <Badge variant="secondary" className="font-normal">{saved}% smaller</Badge>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-64">
          <CardContent className="flex h-full items-center justify-center">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-[55vh] max-w-full rounded-md object-contain"
              />
            ) : (
              <p className="py-16 text-sm text-muted-foreground">No image selected.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function ImageOptimizer() {
  return (
    <ToolPage
      wide
      icon="📱"
      title="Image Optimizer"
      description="Compress images for the web on-device — pick a quality, compare sizes, download the result."
    >
      <OptimizePanel />
    </ToolPage>
  );
}
