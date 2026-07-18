import React, { useState } from 'react';
import { Trash2, Plus, AlarmClock } from 'lucide-react';
import { useAlarms } from '../../lib/time/TimeProvider';
import { cn } from '@/lib/utils';
import Switch from './Switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const to12h = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

const EMPTY = { time: '07:00', label: '', repeat: false };

function AlarmsTab() {
  const { alarms, add, update, toggle, remove } = useAlarms();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // id or null (new)
  const [draft, setDraft] = useState(EMPTY);

  const openNew = () => {
    setEditing(null);
    setDraft(EMPTY);
    setOpen(true);
  };
  const openEdit = (a) => {
    setEditing(a.id);
    setDraft({ time: a.time, label: a.label, repeat: a.repeat });
    setOpen(true);
  };
  const save = () => {
    if (!draft.time) return;
    if (editing) update(editing, { time: draft.time, label: draft.label, repeat: draft.repeat, enabled: true });
    else add(draft.time, draft.label, draft.repeat);
    setOpen(false);
  };

  const sorted = [...alarms].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {alarms.length ? `${alarms.filter((a) => a.enabled).length} active` : 'No alarms yet'}
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus /> Add alarm
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <AlarmClock className="size-8 opacity-50" />
          <p className="text-sm">Add an alarm to be reminded at a set time.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {sorted.map((a) => (
            <li key={a.id} className="group flex items-center justify-between gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => openEdit(a)}
                className={cn('min-w-0 flex-1 text-left', !a.enabled && 'opacity-40')}
              >
                <div className="font-mono text-3xl font-semibold tabular-nums">{to12h(a.time)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {a.label ? `${a.label} · ` : ''}
                  {a.repeat ? 'Every day' : 'Once'}
                </div>
              </button>
              <div className="flex items-center gap-2">
                <Switch checked={a.enabled} onCheckedChange={() => toggle(a.id)} label={`Toggle ${a.time}`} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 opacity-0 transition-opacity group-hover:opacity-100"
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
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={draft.repeat}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, repeat: !!v }))}
              />
              Repeat every day
            </label>
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
  );
}

export default AlarmsTab;
