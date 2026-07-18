import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Globe, AlarmClock, Timer as TimerIcon, Hourglass, Target } from 'lucide-react'
import { useNow } from '../lib/time/useNow'
import { useTimer, useTimers, useStopwatch } from '../lib/time/TimeProvider'
import { elapsedOf } from '../lib/time/useStopwatch'
import { remainingOf } from '../lib/time/useTimers'
import { fmt, fmtDuration, fmtStopwatch } from '../lib/time/format'
import { cn } from '@/lib/utils'
import WorldClockWidget from './WorldClockWidget'
import AlarmsWidget from './AlarmsWidget'
import StopwatchWidget from './StopwatchWidget'
import TimersWidget from './TimersWidget'
import FocusWidget from './FocusWidget'

// Local clock + a one-line glance at whatever's running, linking into the app.
function ClockFace() {
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
    active = { to: '/clock?tab=focus', Icon: Target, text: `${focus.label} · ${fmt(focus.remaining)}` }
  } else if (nearest) {
    active = { to: '/clock?tab=timers', Icon: Hourglass, text: `${nearest.label || 'Timer'} · ${fmtDuration(remainingOf(nearest, nowMs))}` }
  } else if (stopwatch.running) {
    active = { to: '/clock?tab=stopwatch', Icon: TimerIcon, text: fmtStopwatch(elapsedOf(stopwatch, nowMs)) }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
      <Link to="/clock" className="font-mono text-4xl font-extrabold tabular-nums hover:opacity-80">
        {time}
      </Link>
      <div className="text-sm text-muted-foreground">{date}</div>

      {active ? (
        <Link
          to={active.to}
          className="mt-1 flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary hover:bg-primary/15"
        >
          <active.Icon className="size-3.5" />
          <span className="font-mono tabular-nums">{active.text}</span>
        </Link>
      ) : (
        <Link to="/clock" className="mt-1 text-xs text-muted-foreground hover:text-foreground hover:underline">
          Open Clock app
        </Link>
      )}
    </div>
  )
}

const TABS = [
  { value: 'clock', label: 'Clock', Icon: Clock, Panel: ClockFace },
  { value: 'world', label: 'World Clock', Icon: Globe, Panel: WorldClockWidget },
  { value: 'alarms', label: 'Alarms', Icon: AlarmClock, Panel: AlarmsWidget },
  { value: 'stopwatch', label: 'Stopwatch', Icon: TimerIcon, Panel: StopwatchWidget },
  { value: 'timers', label: 'Timers', Icon: Hourglass, Panel: TimersWidget },
  { value: 'focus', label: 'Focus', Icon: Target, Panel: FocusWidget },
]

// One tabbed widget holding every clock feature — all reading the same central
// engines, so a stopwatch (or timer, or focus session) started here is the same
// one in the full Clock app.
function ClockWidget() {
  const [tab, setTab] = useState('clock')
  const Panel = (TABS.find((t) => t.value === tab) ?? TABS[0]).Panel

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-0.5 rounded-lg bg-muted/60 p-1">
        {TABS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-label={label}
            aria-pressed={tab === value}
            title={label}
            className={cn(
              'flex flex-1 items-center justify-center rounded-md py-1.5 transition-colors',
              tab === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Panel />
      </div>
    </div>
  )
}

export default ClockWidget
