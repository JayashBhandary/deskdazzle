import React, { useState } from 'react'
import { Clock, Globe, AlarmClock, Timer as TimerIcon, Hourglass, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import ClockFace from './parts/ClockFace'
import WorldClock from './parts/WorldClock'
import Alarms from './parts/Alarms'
import Stopwatch from './parts/Stopwatch'
import Timers from './parts/Timers'
import Focus from './parts/Focus'

export const CLOCK_TABS = [
  { value: 'clock', label: 'Clock', Icon: Clock, Panel: ClockFace },
  { value: 'world', label: 'World Clock', Icon: Globe, Panel: WorldClock },
  { value: 'alarms', label: 'Alarms', Icon: AlarmClock, Panel: Alarms },
  { value: 'stopwatch', label: 'Stopwatch', Icon: TimerIcon, Panel: Stopwatch },
  { value: 'timers', label: 'Timers', Icon: Hourglass, Panel: Timers },
  { value: 'focus', label: 'Focus', Icon: Target, Panel: Focus },
]
export const CLOCK_TAB_KEYS = CLOCK_TABS.map((t) => t.value)

// The Clock app — one component rendered by both the full page and the desktop
// widget. A `@container` root means the layout adapts to whatever width it's
// given: full labels + roomy panels on the page, icon-only tabs + compact
// panels in a small widget, reflowing live as the user resizes the window.
//
// Tabs can be driven externally (the page syncs `tab` to the URL) or managed
// internally (the widget), via the controlled/uncontrolled `tab`/`onTabChange`.
function ClockApp({ tab: tabProp, onTabChange }) {
  const [tabState, setTabState] = useState('clock')
  const tab = tabProp ?? tabState
  const setTab = (v) => {
    if (onTabChange) onTabChange(v)
    else setTabState(v)
  }

  const current = CLOCK_TABS.find((t) => t.value === tab) ?? CLOCK_TABS[0]
  const Panel = current.Panel

  return (
    <div className="@container flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-muted/60 p-1">
        {CLOCK_TABS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-label={label}
            aria-pressed={tab === value}
            title={label}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors',
              tab === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="hidden @md:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Panel onGo={setTab} />
      </div>
    </div>
  )
}

export default ClockApp
