import React from 'react'
import { Link } from 'react-router-dom'
import { Play, Pause, RotateCcw, Trash2, Hourglass } from 'lucide-react'
import { useTimers } from '../lib/time/TimeProvider'
import { remainingOf } from '../lib/time/useTimers'
import { useNow } from '../lib/time/useNow'
import { fmtDuration } from '../lib/time/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const PRESETS = [
  { label: '1m', ms: 60_000 },
  { label: '5m', ms: 5 * 60_000 },
  { label: '10m', ms: 10 * 60_000 },
]

// Compact countdown timers — quick presets plus the same live list as the
// Clock app's Timers tab.
function TimersWidget() {
  const { timers, add, pause, resume, restart, remove } = useTimers()
  const nowMs = useNow()

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex shrink-0 items-center gap-1.5">
        {PRESETS.map((p) => (
          <Button key={p.label} variant="outline" size="sm" className="flex-1" onClick={() => add(p.ms, '')}>
            {p.label}
          </Button>
        ))}
      </div>

      {timers.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
          <Hourglass className="size-7 opacity-50" />
          <p className="text-xs">Tap a preset to start a timer.</p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-auto">
          {timers.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5">
              <div className="min-w-0">
                <div className={cn('font-mono text-lg font-semibold tabular-nums', t.done && 'text-primary')}>
                  {fmtDuration(remainingOf(t, nowMs))}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {t.label || 'Timer'}
                  {t.done ? ' · done' : t.running ? '' : ' · paused'}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {t.done ? (
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => restart(t.id)} aria-label="Restart">
                    <RotateCcw className="size-3.5" />
                  </Button>
                ) : t.running ? (
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => pause(t.id)} aria-label="Pause">
                    <Pause className="size-3.5" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => resume(t.id)} aria-label="Resume">
                    <Play className="size-3.5" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="size-7" onClick={() => remove(t.id)} aria-label="Delete">
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/clock?tab=timers"
        className="shrink-0 text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        Open Timers
      </Link>
    </div>
  )
}

export default TimersWidget
