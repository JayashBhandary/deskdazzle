import React from 'react'
import { Trash2, Globe } from 'lucide-react'
import { useStore } from '../../../lib/store/WorkspaceProvider'
import { useNow } from '../../../lib/time/useNow'
import { TIMEZONES, zoneInfo, localZone, defaultWorldClocks } from '../../../lib/time/timezones'
import { uid } from '../../../lib/time/format'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// World clock feature — one component for both the full page and the widget;
// container queries shrink typography and hide secondary text when narrow.
function WorldClock() {
  const [clocks, setClocks] = useStore('worldClocks', defaultWorldClocks())
  const nowMs = useNow()
  const reference = localZone()

  const add = (idx) => {
    const tz = TIMEZONES[Number(idx)]
    if (!tz) return
    setClocks((list) => [...list, { id: uid(), city: tz.city, zone: tz.zone }])
  }
  const remove = (id) => setClocks((list) => list.filter((c) => c.id !== id))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="hidden text-sm text-muted-foreground @sm:block">Local zone: {reference}</p>
        <Select value="" onValueChange={add}>
          <SelectTrigger className="w-full @sm:w-[190px]">
            <SelectValue placeholder="＋ Add city" />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((t, i) => (
              <SelectItem key={`${t.zone}-${t.city}`} value={String(i)}>
                {t.city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {clocks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center text-muted-foreground">
          <Globe className="size-8 opacity-50" />
          <p className="text-sm">No cities yet — add one above.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {clocks.map((c) => {
            const info = zoneInfo(c.zone, nowMs, reference)
            return (
              <li key={c.id} className="group flex items-center justify-between gap-3 px-3 py-2.5 @sm:px-4 @sm:py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium @sm:text-base">{c.city}</div>
                  <div className="text-[10px] text-muted-foreground @sm:text-xs">
                    {info.day} · {info.offsetLabel}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-lg font-semibold tabular-nums @sm:text-2xl">{info.time}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 opacity-60 transition-opacity @sm:size-8 @sm:opacity-0 @sm:group-hover:opacity-100"
                    onClick={() => remove(c.id)}
                    aria-label={`Remove ${c.city}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default WorldClock
