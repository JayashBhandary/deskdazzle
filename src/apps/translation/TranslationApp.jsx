import React, { useEffect, useState } from 'react'
import { ArrowLeftRight, Copy, Languages, Loader2, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LANGS = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'ru', name: 'Russian' },
];

function OfflineCard() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-4 text-center text-muted-foreground">
        <WifiOff className="size-8" aria-hidden="true" />
        <p className="font-medium">You&apos;re offline</p>
        <p className="text-sm">Translation needs an internet connection. This tool will work again once you&apos;re back online.</p>
      </CardContent>
    </Card>
  );
}

function TranslationApp() {
  const [text, setText] = useState('');
  const [from, setFrom] = useState('en');
  const [to, setTo] = useState('es');
  const [result, setResult] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | error | offline
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up = () => {
      setOnline(true);
      setStatus((s) => (s === 'offline' ? 'idle' : s));
    };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const translate = async () => {
    if (!text.trim()) return;
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    setStatus('loading');
    setResult('');
    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`
      ).then((r) => r.json());
      if (res.responseData?.translatedText) {
        setResult(res.responseData.translatedText);
        setStatus('idle');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('offline');
    }
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
    setText(result || text);
    setResult('');
  };

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(result);
      toast.success('Translation copied to clipboard');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const showOffline = !online || status === 'offline';

  return (
    <div className="@container mx-auto w-full max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={from} onValueChange={setFrom}>
          <SelectTrigger className="w-40" aria-label="Translate from">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGS.map((l) => (
              <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={swap} aria-label="Swap languages">
          <ArrowLeftRight />
        </Button>
        <Select value={to} onValueChange={setTo}>
          <SelectTrigger className="w-40" aria-label="Translate to">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGS.map((l) => (
              <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Textarea
        rows={4}
        value={text}
        placeholder="Enter text to translate"
        onChange={(e) => setText(e.target.value)}
        aria-label="Text to translate"
      />

      <Button onClick={translate} disabled={showOffline || status === 'loading'}>
        {status === 'loading' ? <Loader2 className="animate-spin" /> : <Languages />}
        Translate
      </Button>

      {showOffline ? (
        <OfflineCard />
      ) : (
        <>
          {status === 'loading' && (
            <p className="text-sm text-muted-foreground">Translating…</p>
          )}
          {status === 'error' && (
            <p className="text-sm text-destructive">Translation failed. Try again.</p>
          )}
          {result && (
            <Card>
              <CardContent className="flex items-start justify-between gap-3">
                <p className="min-w-0 whitespace-pre-wrap break-words">{result}</p>
                <Button variant="ghost" size="sm" className="shrink-0" onClick={copyResult}>
                  <Copy /> Copy
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default TranslationApp;
