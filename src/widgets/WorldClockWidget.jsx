import React from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store/WorkspaceProvider'
import { useNow } from '../lib/time/useNow'
import { zoneInfo, localZone, defaultWorldClocks } from '../lib/time/timezones'

// Compact world clock — reads the same saved cities as the Clock app's World
// Clock tab; manage the list there.
function WorldClockWidget() {
  const [clocks] = useStore('worldClocks', defaultWorldClocks())
  const nowMs = useNow()
  const reference = localZone()

  return (
    <div className="flex h-full flex-col gap-1.5">
      {clocks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center text-muted-foreground">
          <p className="text-xs">No cities yet.</p>
          <Link to="/clock?tab=world" className="text-xs text-primary hover:underline">
            Add cities
          </Link>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y overflow-auto">
          {clocks.map((c) => {
            const info = zoneInfo(c.zone, nowMs, reference)
            return (
              <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{c.city}</div>
                  <div className="text-[10px] text-muted-foreground">{info.day} · {info.offsetLabel}</div>
                </div>
                <span className="font-mono text-lg font-semibold tabular-nums">{info.time}</span>
              </li>
            )
          })}
        </ul>
      )}

      <Link
        to="/clock?tab=world"
        className="shrink-0 text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        Manage cities
      </Link>
    </div>
  )
}

export default WorldClockWidget
