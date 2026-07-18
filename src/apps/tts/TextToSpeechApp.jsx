import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, Volume2 } from 'lucide-react';
import { bus, TAB_ID } from '@/lib/broadcast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function TextToSpeechApp() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [text, setText] = useState('Hello! Welcome to Desk Dazzle.');
  const [voices, setVoices] = useState([]);
  const [voiceName, setVoiceName] = useState('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [speaking, setSpeaking] = useState(false);

  // Cross-tab "now playing": the state currently advertised on the bus (or
  // null), and the pending timer that clears a paused state shortly after
  // speech ends.
  const mediaRef = useRef(null);
  const clearTimerRef = useRef(null);

  const postMedia = (state) => {
    mediaRef.current = state;
    bus.post({ kind: 'media', state, tabId: TAB_ID });
  };

  // Speech finished or was cancelled: advertise "paused" briefly, then clear.
  const endPlayback = () => {
    setSpeaking(false);
    if (!mediaRef.current) return; // already cleared by a manual stop
    postMedia({ ...mediaRef.current, playing: false, updatedMs: Date.now() });
    clearTimerRef.current = setTimeout(() => {
      if (mediaRef.current && !mediaRef.current.playing) postMedia(null);
    }, 3000);
  };

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      setVoices(list);
      if (list.length && !voiceName) setVoiceName(list[0].name);
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  const speak = () => {
    if (!supported || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = voices.find((v) => v.name === voiceName);
    if (voice) utter.voice = voice;
    utter.rate = rate;
    utter.pitch = pitch;
    utter.onstart = () => {
      setSpeaking(true);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      const spoken = text.trim();
      postMedia({
        tabId: TAB_ID,
        title: spoken.length > 40 ? `${spoken.slice(0, 40)}…` : spoken,
        artist: 'Text-to-Speech',
        playing: true,
        updatedMs: Date.now(),
      });
    };
    utter.onend = endPlayback;
    utter.onerror = endPlayback;
    window.speechSynthesis.speak(utter);
  };

  const stop = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    postMedia(null);
  };

  // Keep the latest speak() in a ref so the bus handler never goes stale.
  const speakRef = useRef(speak);
  speakRef.current = speak;

  // Remote play/pause requests from the Media widget in other tabs.
  useEffect(() => {
    if (!supported) return undefined;
    return bus.on((msg) => {
      if (msg.kind !== 'media-control' || msg.targetTabId !== TAB_ID) return;
      if (msg.action === 'pause') {
        // Cancel speech; the utterance's onend advertises the paused state.
        window.speechSynthesis.cancel();
        setSpeaking(false);
      } else {
        speakRef.current();
      }
    });
  }, [supported]);

  // Leaving the page: stop advertising playback to other tabs.
  useEffect(() => () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    if (mediaRef.current) bus.post({ kind: 'media', state: null, tabId: TAB_ID });
  }, []);

  return (
    <div className="@container">
      {!supported ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Your browser does not support speech synthesis.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-5">
            <div className="grid gap-1.5">
              <Label htmlFor="tts-text">Text</Label>
              <Textarea
                id="tts-text"
                rows={6}
                value={text}
                placeholder="Type something to read aloud..."
                onChange={(e) => setText(e.target.value)}
                className="min-h-32 resize-y"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="tts-voice">Voice</Label>
              <Select value={voiceName} onValueChange={setVoiceName}>
                <SelectTrigger id="tts-voice" className="w-full">
                  <SelectValue placeholder="Loading voices…" />
                </SelectTrigger>
                <SelectContent>
                  {voices.map((v) => (
                    <SelectItem key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tts-rate">Rate</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">{rate.toFixed(1)}×</span>
                </div>
                <input
                  id="tts-rate"
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tts-pitch">Pitch</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">{pitch.toFixed(1)}</span>
                </div>
                <input
                  id="tts-pitch"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={pitch}
                  onChange={(e) => setPitch(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={speak} disabled={!text.trim()}>
                {speaking ? <Volume2 className="animate-pulse" /> : <Play />}
                {speaking ? 'Speaking…' : 'Speak'}
              </Button>
              <Button variant="outline" onClick={stop} disabled={!speaking}>
                <Square /> Stop
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default TextToSpeechApp;
