import React, { useState } from 'react'
import { Trash2, Plus, AlarmClock } from 'lucide-react'
import { useAlarms } from '../../../lib/time/TimeProvider'
import { alarmDays } from '../../../lib/time/useAlarms'
import { cn } from '@/lib/utils'
import Switch from './Switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const to12h = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

// Weekday chips in reading order (Mon → Sun); values are JS getDay() indices
// (0 = Sun … 6 = Sat), so a day maps unambiguously despite the repeated T / S.
const DOW = [
  { i: 1, label: 'M' },
  { i: 2, label: 'T' },
  { i: 3, label: 'W' },
  { i: 4, label: 'T' },
  { i: 5, label: 'F' },
  { i: 6, label: 'S' },
  { i: 0, label: 'S' },
]
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Human summary of the selected repeat days.
const summarize = (days) => {
  if (!days.length) return 'Once'
  const set = new Set(days)
  if (set.size === 7) return 'Every day'
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Weekdays'
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends'
  return DOW.filter((d) => set.has(d.i)).map((d) => SHORT[d.i]).join(', ')
}

const EMPTY = { time: '07:00', label: '', days: [] }

// Alarms feature — list + toggles at any size; add/edit via a dialog (works in
// the widget too, since dialogs portal to the body).
function Alarms() {
  const { alarms, add, update, toggle, remove } = useAlarms()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState(EMPTY)

  const openNew = () => {
    setEditing(null)
    setDraft(EMPTY)
    setOpen(true)
  }
  const openEdit = (a) => {
    setEditing(a.id)
    setDraft({ time: a.time, label: a.label, days: alarmDays(a) })
    setOpen(true)
  }
  const toggleDay = (i) =>
    setDraft((d) => ({
      ...d,
      days: d.days.includes(i) ? d.days.filter((x) => x !== i) : [...d.days, i],
    }))
  const save = () => {
    if (!draft.time) return
    if (editing) update(editing, { time: draft.time, label: draft.label, days: draft.days, enabled: true })
    else add(draft.time, draft.label, draft.days)
    setOpen(false)
  }

  const sorted = [...alarms].sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {alarms.length ? `${alarms.filter((a) => a.enabled).length} active` : 'No alarms yet'}
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus /> Add
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center text-muted-foreground">
          <AlarmClock className="size-8 opacity-50" />
          <p className="text-sm">Add an alarm to be reminded at a set time.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {sorted.map((a) => (
            <li key={a.id} className="group flex items-center justify-between gap-3 px-3 py-2.5 @sm:px-4 @sm:py-3">
              <button
                type="button"
                onClick={() => openEdit(a)}
                className={cn('min-w-0 flex-1 text-left', !a.enabled && 'opacity-40')}
              >
                <div className="font-mono text-2xl font-semibold tabular-nums @sm:text-3xl">{to12h(a.time)}</div>
                <div className="truncate text-[10px] text-muted-foreground @sm:text-xs">
                  {a.label ? `${a.label} · ` : ''}
                  {summarize(alarmDays(a))}
                </div>
              </button>
              <div className="flex items-center gap-1.5">
                <Switch checked={a.enabled} onCheckedChange={() => toggle(a.id)} label={`Toggle ${a.time}`} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 opacity-60 transition-opacity @sm:size-8 @sm:opacity-0 @sm:group-hover:opacity-100"
                  onClick={() => remove(a.id)}
                  aria-label="Delete alarm"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit alarm' : 'New alarm'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="alarm-time">Time</Label>
              <Input
                id="alarm-time"
                type="time"
                value={draft.time}
                onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="alarm-label">Label (optional)</Label>
              <Input
                id="alarm-label"
                placeholder="Wake up"
                value={draft.label}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Repeat</Label>
              <div className="flex gap-1">
                {DOW.map(({ i, label }) => {
                  const on = draft.days.includes(i)
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      aria-pressed={on}
                      aria-label={SHORT[i]}
                      className={cn(
                        'flex size-9 items-center justify-center rounded-full text-sm font-medium transition-colors',
                        on
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">{summarize(draft.days)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editing ? 'Save' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Alarms
