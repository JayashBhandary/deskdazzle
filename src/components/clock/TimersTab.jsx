import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Trash2, Plus, Hourglass } from 'lucide-react';
import { useTimers } from '../../lib/time/TimeProvider';
import { remainingOf } from '../../lib/time/useTimers';
import { useNow } from '../../lib/time/useNow';
import { fmtDuration } from '../../lib/time/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const PRESETS = [
  { label: '1 min', ms: 60_000 },
  { label: '3 min', ms: 3 * 60_000 },
  { label: '5 min', ms: 5 * 60_000 },
  { label: '10 min', ms: 10 * 60_000 },
  { label: '25 min', ms: 25 * 60_000 },
];

const clampNum = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));

function TimersTab() {
  const { timers, add, pause, resume, restart, remove } = useTimers();
  const nowMs = useNow();
  const [hms, setHms] = useState({ h: 0, m: 5, s: 0 });
  const [label, setLabel] = useState('');

  const draftMs = (hms.h * 3600 + hms.m * 60 + hms.s) * 1000;

  const create = () => {
    if (draftMs <= 0) return;
    add(draftMs, label.trim());
    setLabel('');
  };

  return (
    <div className="space-y-6">
      {/* Create */}
      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-end gap-3">
          {[
            { key: 'h', label: 'Hours', max: 23 },
            { key: 'm', label: 'Min', max: 59 },
            { key: 's', label: 'Sec', max: 59 },
          ].map((f) => (
            <div key={f.key} className="grid gap-1.5">
              <Label htmlFor={`timer-${f.key}`} className="text-xs text-muted-foreground">
                {f.label}
              </Label>
              <Input
                id={`timer-${f.key}`}
                type="number"
                min="0"
                max={f.max}
                className="w-20"
                value={hms[f.key]}
                onChange={(e) => setHms((s) => ({ ...s, [f.key]: clampNum(e.target.value, f.max) }))}
              />
            </div>
          ))}
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="timer-label" className="text-xs text-muted-foreground">
              Label (optional)
            </Label>
            <Input
              id="timer-label"
              placeholder="Tea"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
          </div>
          <Button onClick={create} disabled={draftMs <= 0}>
            <Plus /> Start
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button key={p.label} variant="outline" size="sm" onClick={() => add(p.ms, '')}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Active list */}
      {timers.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <Hourglass className="size-8 opacity-50" />
          <p className="text-sm">No timers running — set one above.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {timers.map((t) => {
            const left = remainingOf(t, nowMs);
            const pct = t.totalMs > 0 ? (left / t.totalMs) * 100 : 0;
            return (
              <li key={t.id} className="rounded-lg border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div
                      className={cn(
                        'font-mono text-3xl font-semibold tabular-nums',
                        t.done && 'text-primary',
                      )}
                    >
                      {fmtDuration(left)}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {t.label || 'Timer'} · {fmtDuration(t.totalMs)}
                      {t.done ? ' · done' : t.running ? '' : ' · paused'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {t.done ? (
                      <Button variant="outline" size="icon" className="size-9" onClick={() => restart(t.id)} aria-label="Restart">
                        <RotateCcw className="size-4" />
                      </Button>
                    ) : t.running ? (
                      <Button variant="secondary" size="icon" className="size-9" onClick={() => pause(t.id)} aria-label="Pause">
                        <Pause className="size-4" />
                      </Button>
                    ) : (
                      <Button size="icon" className="size-9" onClick={() => resume(t.id)} aria-label="Resume">
                        <Play className="size-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="size-9" onClick={() => remove(t.id)} aria-label="Delete">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
                    style={{ width: `${t.done ? 100 : Math.max(0, Math.min(100, pct))}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default TimersTab;
