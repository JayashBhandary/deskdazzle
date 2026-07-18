import React from 'react';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { useTimer, PHASES, dayKey, fmt } from '../../lib/time/TimeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// Last 7 days (oldest → today) with completed-focus counts from history.
const weekDays = (history) =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      key: dayKey(d),
      label: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
      count: history?.[dayKey(d)] ?? 0,
    };
  });

const SETTINGS = [
  { field: 'work', label: 'Focus (min)', affected: 'work' },
  { field: 'shortBreak', label: 'Short break (min)', affected: 'short' },
  { field: 'longBreak', label: 'Long break (min)', affected: 'long' },
  { field: 'longEvery', label: 'Long break every', affected: null },
];

function FocusTab() {
  const {
    phase,
    running,
    remaining,
    cycleCount,
    longEvery,
    settings,
    history,
    todayCount,
    start,
    pause,
    reset,
    skip,
    setSetting,
  } = useTimer();

  const week = weekDays(history);
  const weekMax = Math.max(1, ...week.map((d) => d.count));

  return (
    <div>
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            {PHASES[phase].emoji} {PHASES[phase].label}
          </span>
          <span className="font-mono text-7xl font-semibold tabular-nums sm:text-8xl" aria-live="polite">
            {fmt(remaining)}
          </span>

          <div className="flex items-center gap-2" aria-label="Sessions until long break">
            {Array.from({ length: longEvery }, (_, i) => (
              <span
                key={i}
                className={`size-2.5 rounded-full transition-colors ${
                  i < cycleCount ? 'bg-primary' : 'bg-muted-foreground/25'
                }`}
              />
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {!running ? (
              <Button size="lg" onClick={start}>
                <Play /> Start
              </Button>
            ) : (
              <Button size="lg" variant="secondary" onClick={pause}>
                <Pause /> Pause
              </Button>
            )}
            <Button variant="outline" size="lg" onClick={reset}>
              <RotateCcw /> Reset
            </Button>
            <Button variant="ghost" size="lg" onClick={skip}>
              <SkipForward /> Skip
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {todayCount} focus session{todayCount === 1 ? '' : 's'} completed today
          </p>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-medium">Settings</h2>
          <div className="grid grid-cols-2 gap-3">
            {SETTINGS.map((s) => (
              <div key={s.field} className="grid gap-1.5">
                <Label htmlFor={`pomo-${s.field}`} className="text-xs text-muted-foreground">
                  {s.label}
                </Label>
                <Input
                  id={`pomo-${s.field}`}
                  type="number"
                  min="1"
                  max="999"
                  value={settings[s.field]}
                  onChange={(e) => setSetting(s.field, e.target.value, s.affected)}
                />
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium">This week</h2>
          <div className="flex h-28 items-end gap-2">
            {week.map((d) => (
              <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs tabular-nums text-muted-foreground">{d.count || ''}</span>
                <div
                  className={`w-full rounded-sm ${d.count > 0 ? 'bg-primary' : 'bg-muted-foreground/15'}`}
                  style={{ height: d.count > 0 ? `${Math.max(8, (d.count / weekMax) * 100)}%` : '4px' }}
                  title={`${d.key}: ${d.count} session${d.count === 1 ? '' : 's'}`}
                />
                <span className="text-xs text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Separator className="my-6" />
      <p className="text-xs text-muted-foreground">
        Every {longEvery}th completed focus session earns a long break. Sessions are saved on this
        device only.
      </p>
    </div>
  );
}

export default FocusTab;
