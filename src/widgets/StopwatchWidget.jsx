import React from 'react'
import { Link } from 'react-router-dom'
import { Play, Pause, Flag, RotateCcw } from 'lucide-react'
import { useStopwatch } from '../lib/time/TimeProvider'
import { elapsedOf } from '../lib/time/useStopwatch'
import { useFastNow } from '../lib/time/useNow'
import { fmtStopwatch } from '../lib/time/format'
import { Button } from '@/components/ui/button'

// Compact stopwatch — shares state with the Clock app, so it keeps counting
// whether or not this widget (or the app) is open.
function StopwatchWidget() {
  const { running, startMs, accumMs, laps, hasStarted, start, stop, reset, lap } = useStopwatch()
  const now = useFastNow(running)
  const elapsed = elapsedOf({ running, startMs, accumMs }, now)
  const lastLap = laps.length ? laps[laps.length - 1] : null

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <span className="font-mono text-4xl font-semibold tabular-nums">{fmtStopwatch(elapsed)}</span>

      {lastLap && (
        <span className="text-xs text-muted-foreground">
          Lap {laps.length} · <span className="font-mono tabular-nums">{fmtStopwatch(lastLap.split)}</span>
        </span>
      )}

      <div className="flex items-center gap-1.5">
        {!running ? (
          <Button size="sm" onClick={start}>
            <Play /> {hasStarted ? 'Resume' : 'Start'}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={stop}>
            <Pause /> Stop
          </Button>
        )}
        {running ? (
          <Button variant="outline" size="icon" className="size-8" onClick={lap} aria-label="Lap">
            <Flag className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" size="icon" className="size-8" onClick={reset} disabled={!hasStarted} aria-label="Reset">
            <RotateCcw className="size-4" />
          </Button>
        )}
      </div>

      <Link to="/clock?tab=stopwatch" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
        Open Stopwatch
      </Link>
    </div>
  )
}

export default StopwatchWidget
