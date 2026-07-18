import React from 'react';
import { Play, Pause, Flag, RotateCcw } from 'lucide-react';
import { useStopwatch } from '../../lib/time/TimeProvider';
import { elapsedOf } from '../../lib/time/useStopwatch';
import { useFastNow } from '../../lib/time/useNow';
import { fmtStopwatch } from '../../lib/time/format';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

function StopwatchTab() {
  const { running, startMs, accumMs, laps, hasStarted, start, stop, reset, lap } = useStopwatch();

  // Smooth hundredths while running; frozen value otherwise.
  const now = useFastNow(running);
  const elapsed = elapsedOf({ running, startMs, accumMs }, now);

  // Fastest / slowest lap for subtle highlighting (Apple does this).
  const splits = laps.map((l) => l.split);
  const min = splits.length > 1 ? Math.min(...splits) : null;
  const max = splits.length > 1 ? Math.max(...splits) : null;

  return (
    <div className="flex flex-col items-center gap-6">
      <span className="font-mono text-6xl font-semibold tabular-nums sm:text-7xl" aria-live="off">
        {fmtStopwatch(elapsed)}
      </span>

      <div className="flex items-center gap-3">
        {!running ? (
          <Button size="lg" onClick={start}>
            <Play /> {hasStarted ? 'Resume' : 'Start'}
          </Button>
        ) : (
          <Button size="lg" variant="secondary" onClick={stop}>
            <Pause /> Stop
          </Button>
        )}
        {running ? (
          <Button size="lg" variant="outline" onClick={lap}>
            <Flag /> Lap
          </Button>
        ) : (
          <Button size="lg" variant="outline" onClick={reset} disabled={!hasStarted}>
            <RotateCcw /> Reset
          </Button>
        )}
      </div>

      {laps.length > 0 && (
        <ScrollArea className="h-56 w-full max-w-sm rounded-lg border">
          <ul className="divide-y">
            {laps
              .map((l, i) => ({ ...l, n: i + 1 }))
              .reverse()
              .map((l) => (
                <li key={l.n} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-muted-foreground">Lap {l.n}</span>
                  <span
                    className={
                      l.split === min
                        ? 'font-mono tabular-nums text-green-500'
                        : l.split === max
                          ? 'font-mono tabular-nums text-red-500'
                          : 'font-mono tabular-nums'
                    }
                  >
                    {fmtStopwatch(l.split)}
                  </span>
                </li>
              ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}

export default StopwatchTab;
