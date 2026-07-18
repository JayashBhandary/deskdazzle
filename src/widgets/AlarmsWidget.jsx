import React from 'react'
import { Link } from 'react-router-dom'
import { AlarmClock } from 'lucide-react'
import { useAlarms } from '../lib/time/TimeProvider'
import Switch from '../components/clock/Switch'

const to12h = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

// Compact alarms — glance and toggle. Add / edit in the Clock app's Alarms tab.
function AlarmsWidget() {
  const { alarms, toggle } = useAlarms()
  const sorted = [...alarms].sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="flex h-full flex-col gap-1.5">
      {sorted.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center text-muted-foreground">
          <AlarmClock className="size-7 opacity-50" />
          <Link to="/clock?tab=alarms" className="text-xs text-primary hover:underline">
            Add an alarm
          </Link>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y overflow-auto">
          {sorted.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-1.5">
              <div className={a.enabled ? 'min-w-0' : 'min-w-0 opacity-40'}>
                <div className="font-mono text-xl font-semibold tabular-nums">{to12h(a.time)}</div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {a.label ? `${a.label} · ` : ''}
                  {a.repeat ? 'Every day' : 'Once'}
                </div>
              </div>
              <Switch checked={a.enabled} onCheckedChange={() => toggle(a.id)} label={`Toggle ${a.time}`} />
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/clock?tab=alarms"
        className="shrink-0 text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        Manage alarms
      </Link>
    </div>
  )
}

export default AlarmsWidget
