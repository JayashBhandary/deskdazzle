import React, { useEffect, useRef, useState, useDeferredValue } from 'react';
import { Copy, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ToolPage from '../components/ToolPage';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { convertText } from '@/lib/converter-client';
import { humanBytes } from '@/lib/image-shared';

const TEXT_KINDS = [
  { kind: 'md2html', label: 'Markdown → HTML', ext: 'html' },
  { kind: 'csv2json', label: 'CSV → JSON', ext: 'json' },
  { kind: 'json2yaml', label: 'JSON → YAML', ext: 'yaml' },
  { kind: 'yaml2json', label: 'YAML → JSON', ext: 'json' },
  { kind: 'base64enc', label: 'Text → Base64', ext: 'txt' },
  { kind: 'base64dec', label: 'Base64 → Text', ext: 'txt' },
  { kind: 'urlenc', label: 'Text → URL-encoded', ext: 'txt' },
  { kind: 'urldec', label: 'URL-encoded → Text', ext: 'txt' },
];

// Above this input size, convert on demand instead of on every keystroke.
const LIVE_LIMIT = 100_000;

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// All conversions run in the Rust/WASM core inside a Web Worker — large
// inputs never block the UI, and everything stays on the device.
export function DataPanel() {
  const [kind, setKind] = useState('md2html');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const runId = useRef(0);

  const deferred = useDeferredValue(input);
  const isLarge = input.length > LIVE_LIMIT;
  const meta = TEXT_KINDS.find((k) => k.kind === kind);

  const run = async (text) => {
    const id = ++runId.current;
    if (!text.trim()) {
      setOutput('');
      setError(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const out = await convertText(kind, text);
      if (id === runId.current) {
        setOutput(out);
        setError(null);
      }
    } catch (e) {
      if (id === runId.current) {
        setError(String(e instanceof Error ? e.message : e));
        setOutput('');
      }
    } finally {
      if (id === runId.current) setBusy(false);
    }
  };

  // Live conversion for reasonably-sized inputs (deferred = debounced by React).
  useEffect(() => {
    if (!isLarge) run(deferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferred, kind]);

  const copyOutput = async () => {
    await navigator.clipboard.writeText(output);
    toast.success('Output copied to clipboard');
  };

  const BOX = 'h-[55vh] resize-none overflow-auto [field-sizing:fixed] font-mono text-sm';

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Label htmlFor="conversion">Conversion</Label>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger id="conversion" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEXT_KINDS.map((k) => (
              <SelectItem key={k.kind} value={k.kind}>{k.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isLarge && (
          <Button size="sm" onClick={() => run(input)} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Convert
          </Button>
        )}
        {busy && !isLarge && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid min-h-0 gap-1.5">
          <div className="flex items-center justify-between">
            <Label>Input</Label>
            <span className="text-xs text-muted-foreground">
              {humanBytes(new Blob([input]).size)}
            </span>
          </div>
          <Textarea
            className={BOX}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Paste ${meta.label.split(' → ')[0]} here…`}
            aria-label="Converter input"
          />
        </div>
        <div className="grid min-h-0 gap-1.5">
          <div className="flex items-center justify-between">
            <Label>Output</Label>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={copyOutput} disabled={!output}>
                <Copy /> Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => download(output, `converted.${meta.ext}`, 'text/plain')}
                disabled={!output}
              >
                <Download /> Save
              </Button>
            </div>
          </div>
          {error ? (
            <div className={`${BOX} rounded-md border border-destructive/50 bg-destructive/5 p-3 text-destructive`}>
              {error}
            </div>
          ) : (
            <Textarea className={BOX} value={output} readOnly aria-label="Converter output" />
          )}
        </div>
      </div>
    </>
  );
}

function DataConverter() {
  return (
    <ToolPage
      wide
      icon="🔁"
      title="Data Converter"
      description="Markdown, CSV, JSON, YAML, Base64 and URL encoding — converted on-device by the Rust/WASM core, 100% offline."
    >
      <DataPanel />
    </ToolPage>
  );
}

export default DataConverter;
