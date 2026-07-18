import React from 'react'
import { Play, Pause, Flag, RotateCcw } from 'lucide-react'
import { useStopwatch } from '../../../lib/time/TimeProvider'
import { elapsedOf } from '../../../lib/time/useStopwatch'
import { useFastNow } from '../../../lib/time/useNow'
import { fmtStopwatch } from '../../../lib/time/format'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

// Stopwatch feature — smooth hundredths while running (rAF), laps with
// fastest/slowest highlighting. Fluid across widget → page sizes.
function Stopwatch() {
  const { running, startMs, accumMs, laps, hasStarted, start, stop, reset, lap } = useStopwatch()
  const now = useFastNow(running)
  const elapsed = elapsedOf({ running, startMs, accumMs }, now)

  const splits = laps.map((l) => l.split)
  const min = splits.length > 1 ? Math.min(...splits) : null
  const max = splits.length > 1 ? Math.max(...splits) : null

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      <span className="font-mono text-4xl font-semibold tabular-nums @sm:text-6xl @lg:text-7xl" aria-live="off">
        {fmtStopwatch(elapsed)}
      </span>

      <div className="flex items-center gap-2 @sm:gap-3">
        {!running ? (
          <Button onClick={start}>
            <Play /> {hasStarted ? 'Resume' : 'Start'}
          </Button>
        ) : (
          <Button variant="secondary" onClick={stop}>
            <Pause /> Stop
          </Button>
        )}
        {running ? (
          <Button variant="outline" onClick={lap}>
            <Flag /> Lap
          </Button>
        ) : (
          <Button variant="outline" onClick={reset} disabled={!hasStarted}>
            <RotateCcw /> Reset
          </Button>
        )}
      </div>

      {laps.length > 0 && (
        <ScrollArea className="h-40 w-full max-w-sm rounded-lg border @sm:h-56">
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
  )
}

export default Stopwatch
