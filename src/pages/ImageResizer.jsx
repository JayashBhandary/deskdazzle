import React, { useRef, useState } from 'react';
import { Download, ImagePlus, Loader2, Scaling } from 'lucide-react';
import { toast } from 'sonner';
import ToolPage from '../components/ToolPage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
];

// Resizing runs in the Rust/WASM core inside a Web Worker (with an automatic
// Canvas fallback), so large images never block the UI.
export function ResizePanel() {
  const [file, setFile] = useState(null);
  const [srcUrl, setSrcUrl] = useState(null);
  const [fileName, setFileName] = useState('image');
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [format, setFormat] = useState('png');
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
    clearResult();
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      setNatural({ w: img.width, h: img.height });
      setWidth(img.width);
      setHeight(img.height);
      setFile(f);
      setSrcUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error('Could not read that file as an image');
    };
    img.src = url;
    e.target.value = '';
  };

  // The pipeline always preserves the aspect ratio, so the two inputs stay linked.
  const changeWidth = (w) => {
    setWidth(w);
    if (natural.w) setHeight(Math.max(1, Math.round((w / natural.w) * natural.h)));
    clearResult();
  };
  const changeHeight = (h) => {
    setHeight(h);
    if (natural.h) setWidth(Math.max(1, Math.round((h / natural.h) * natural.w)));
    clearResult();
  };

  const resize = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const out = await convertImage(file, {
        format,
        maxSize: Math.max(Number(width) || 0, Number(height) || 0),
        quality: 0.92,
      });
      clearResult();
      setResult(out);
      toast.success(`Resized to ${out.width} × ${out.height}px (${humanBytes(out.bytes)})`);
    } catch (err) {
      toast.error(`Resize failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `${fileName}-${result.width}x${result.height}.${EXT[format]}`;
    a.click();
  };

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
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="resize-width">Width (px)</Label>
                    <Input
                      id="resize-width"
                      type="number"
                      min="1"
                      value={width}
                      onChange={(e) => changeWidth(Number(e.target.value))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="resize-height">Height (px)</Label>
                    <Input
                      id="resize-height"
                      type="number"
                      min="1"
                      value={height}
                      onChange={(e) => changeHeight(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="resize-format">Format</Label>
                  <Select
                    value={format}
                    onValueChange={(v) => { setFormat(v); clearResult(); }}
                  >
                    <SelectTrigger id="resize-format" className="w-full">
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
                  Original: {natural.w} × {natural.h}px · {humanBytes(file.size)}.
                  Aspect ratio is preserved; images are never enlarged past the original.
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={resize} disabled={busy}>
                    {busy ? <Loader2 className="animate-spin" /> : <Scaling />} Resize
                  </Button>
                  <Button variant="outline" onClick={download} disabled={!result}>
                    <Download /> Download
                  </Button>
                </div>

                {result && (
                  <p className="text-xs text-muted-foreground">
                    Result: {result.width} × {result.height}px · {humanBytes(result.bytes)}
                  </p>
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

export default function ImageResizer() {
  return (
    <ToolPage
      wide
      icon="📐"
      title="Image Resizer"
      description="Resize images on-device — processing runs in a background worker, nothing leaves your machine."
    >
      <ResizePanel />
    </ToolPage>
  );
}
