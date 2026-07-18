import React from 'react'
import { Link } from 'react-router-dom'
import { Hourglass, Target, Timer as TimerIcon } from 'lucide-react'
import { useNow } from '../../../lib/time/useNow'
import { useTimer, useTimers, useStopwatch } from '../../../lib/time/TimeProvider'
import { elapsedOf } from '../../../lib/time/useStopwatch'
import { remainingOf } from '../../../lib/time/useTimers'
import { fmt, fmtDuration, fmtStopwatch } from '../../../lib/time/format'

// The local clock face + a one-line glance at whatever's running. Scales from a
// small widget up to the full page via container queries.
function ClockFace({ onGo }) {
  const nowMs = useNow()
  const now = new Date(nowMs)
  const focus = useTimer()
  const { timers } = useTimers()
  const stopwatch = useStopwatch()

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  const runningTimers = timers.filter((t) => t.running)
  const nearest = runningTimers.length
    ? runningTimers.reduce((a, b) => (remainingOf(a, nowMs) <= remainingOf(b, nowMs) ? a : b))
    : null

  let active = null
  if (focus.running) {
    active = { tab: 'focus', Icon: Target, text: `${focus.label} · ${fmt(focus.remaining)}` }
  } else if (nearest) {
    active = { tab: 'timers', Icon: Hourglass, text: `${nearest.label || 'Timer'} · ${fmtDuration(remainingOf(nearest, nowMs))}` }
  } else if (stopwatch.running) {
    active = { tab: 'stopwatch', Icon: TimerIcon, text: fmtStopwatch(elapsedOf(stopwatch, nowMs)) }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-4 text-center">
      <div className="font-mono text-5xl font-extrabold tabular-nums @sm:text-6xl @lg:text-8xl">{time}</div>
      <div className="text-sm text-muted-foreground @lg:text-lg">{date}</div>

      {active && (
        <button
          type="button"
          onClick={() => onGo?.(active.tab)}
          className="mt-1 flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
        >
          <active.Icon className="size-3.5" />
          <span className="font-mono tabular-nums">{active.text}</span>
        </button>
      )}
    </div>
  )
}

export default ClockFace
