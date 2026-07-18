import React, { useState } from 'react';
import { ArrowLeft, Check, Plus, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import ToolPage from '../components/ToolPage';
import { useStore } from '../lib/store/WorkspaceProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;

// Blank + three starter templates. Milestone due dates are always left null —
// the user sets them from the roadmap view.
const TEMPLATES = [
  {
    key: 'blank',
    emoji: '🎯',
    title: 'Blank roadmap',
    hint: 'Start from scratch and add your own milestones.',
    milestones: [],
  },
  {
    key: 'startup',
    emoji: '🚀',
    title: 'Startup launch',
    hint: 'Idea validation → MVP → First users → Launch',
    milestones: [
      {
        title: 'Idea validation',
        steps: ['Interview 10 potential customers', 'Map the top 3 competitors', 'Write a one-page problem statement'],
      },
      {
        title: 'MVP',
        steps: ['Cut scope to one core workflow', 'Build the first working version', 'Dogfood it for a week'],
      },
      {
        title: 'First users',
        steps: ['Onboard 5 friendly early users', 'Collect and triage feedback'],
      },
      {
        title: 'Launch',
        steps: ['Prepare landing page and demo', 'Announce on socials / communities', 'Track signups for the first week'],
      },
    ],
  },
  {
    key: 'research',
    emoji: '📄',
    title: 'Research paper',
    hint: 'Literature review → Methodology → Experiments → Write & submit',
    milestones: [
      {
        title: 'Literature review',
        steps: ['Collect and skim 20 key papers', 'Summarize gaps and open questions'],
      },
      {
        title: 'Methodology',
        steps: ['Define hypotheses and metrics', 'Design the experimental setup', 'Get feedback from advisor/peers'],
      },
      {
        title: 'Experiments',
        steps: ['Run baseline experiments', 'Run main experiments and ablations', 'Analyze and chart the results'],
      },
      {
        title: 'Write & submit',
        steps: ['Draft the full paper', 'Internal review and revisions', 'Format and submit to the venue'],
      },
    ],
  },
  {
    key: 'exam',
    emoji: '🩺',
    title: 'Exam prep',
    hint: 'Syllabus map → First pass → Practice questions → Revision',
    milestones: [
      {
        title: 'Syllabus map',
        steps: ['List every topic in the syllabus', 'Rank topics by weight and weakness'],
      },
      {
        title: 'First pass',
        steps: ['Study all high-weight topics', 'Make short notes per topic'],
      },
      {
        title: 'Practice questions',
        steps: ['Solve past papers', 'Review every wrong answer', 'Time yourself on full mocks'],
      },
      {
        title: 'Revision',
        steps: ['Re-read short notes', 'Final pass over weak topics'],
      },
    ],
  },
];

// Progress across a roadmap: done steps / total steps over all milestones.
// A milestone with no steps counts as a single unit so empty-milestone
// roadmaps still show meaningful progress. Steps inside a milestone marked
// done count as done.
function progressOf(roadmap) {
  let done = 0;
  let total = 0;
  for (const m of roadmap.milestones) {
    if (m.steps.length === 0) {
      total += 1;
      if (m.done) done += 1;
    } else {
      total += m.steps.length;
      done += m.steps.filter((s) => s.done || m.done).length;
    }
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// Earliest not-done milestone that has a due date.
function nextMilestone(roadmap) {
  return roadmap.milestones
    .filter((m) => !m.done && m.due != null)
    .sort((a, b) => a.due - b.due)[0] ?? null;
}

const fmtDate = (ms) =>
  new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// epoch ms <-> native <input type="date"> value (local time).
const msToInput = (ms) => {
  if (ms == null) return '';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const inputToMs = (value) => (value ? new Date(`${value}T00:00:00`).getTime() : null);

function MilestoneItem({ milestone, onChange, onDelete }) {
  const [stepText, setStepText] = useState('');

  const overdue = !milestone.done && milestone.due != null && milestone.due < startOfToday();
  const doneSteps = milestone.steps.filter((s) => s.done || milestone.done).length;

  const patchStep = (id, patch) =>
    onChange({
      ...milestone,
      steps: milestone.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });

  const addStep = () => {
    const text = stepText.trim();
    if (!text) return;
    onChange({ ...milestone, steps: [...milestone.steps, { id: uid(), text, done: false }] });
    setStepText('');
  };

  const dotTone = milestone.done
    ? 'border-primary bg-primary'
    : overdue
      ? 'border-destructive bg-destructive'
      : 'border-muted-foreground/50 bg-background';

  return (
    <li className="relative pb-8 pl-8 last:pb-2">
      {/* Timeline dot */}
      <span
        aria-hidden="true"
        className={`absolute -left-[7px] top-1.5 size-3.5 rounded-full border-2 ${dotTone}`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <h3 className={`min-w-0 flex-1 truncate font-semibold tracking-tight ${milestone.done ? 'text-muted-foreground line-through' : ''}`}>
          {milestone.title}
        </h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {milestone.steps.length > 0 && `${doneSteps}/${milestone.steps.length}`}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...milestone, done: !milestone.done })}
          aria-pressed={milestone.done}
        >
          {milestone.done ? <Undo2 /> : <Check />} {milestone.done ? 'Reopen' : 'Done'}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="opacity-60 hover:opacity-100"
          onClick={onDelete}
          aria-label={`Delete milestone “${milestone.title}”`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <label className="flex items-center gap-2">
          Due
          <Input
            type="date"
            className="h-8 w-40"
            value={msToInput(milestone.due)}
            onChange={(e) => onChange({ ...milestone, due: inputToMs(e.target.value) })}
            aria-label={`Due date for “${milestone.title}”`}
          />
        </label>
        {overdue && <span className="font-medium text-destructive">Overdue — {fmtDate(milestone.due)}</span>}
      </div>

      <ul className="mt-2 space-y-1.5">
        {milestone.steps.map((s) => (
          <li key={s.id} className="group flex items-center gap-2">
            <Checkbox
              checked={s.done || milestone.done}
              onCheckedChange={(v) => patchStep(s.id, { done: v === true })}
              aria-label={s.text}
            />
            <span className={`min-w-0 flex-1 truncate text-sm ${s.done || milestone.done ? 'text-muted-foreground line-through' : ''}`}>
              {s.text}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 opacity-0 transition-opacity group-hover:opacity-60 hover:opacity-100 focus-visible:opacity-100"
              onClick={() => onChange({ ...milestone, steps: milestone.steps.filter((x) => x.id !== s.id) })}
              aria-label={`Remove step “${s.text}”`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex gap-2">
        <Input
          className="h-8"
          value={stepText}
          placeholder="Add a step…"
          onChange={(e) => setStepText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addStep()}
          aria-label={`New step for “${milestone.title}”`}
        />
        <Button variant="outline" size="sm" onClick={addStep}>
          <Plus /> Step
        </Button>
      </div>
    </li>
  );
}

function RoadmapDetail({ roadmap, onChange, onBack }) {
  const [milestoneText, setMilestoneText] = useState('');
  const { done, total, pct } = progressOf(roadmap);

  const patchMilestone = (id, next) =>
    onChange({
      ...roadmap,
      milestones: roadmap.milestones.map((m) => (m.id === id ? next : m)),
    });

  const deleteMilestone = (id) => {
    const target = roadmap.milestones.find((m) => m.id === id);
    onChange({ ...roadmap, milestones: roadmap.milestones.filter((m) => m.id !== id) });
    toast.success(`Milestone "${target?.title ?? ''}" deleted`);
  };

  const addMilestone = () => {
    const title = milestoneText.trim();
    if (!title) return;
    onChange({
      ...roadmap,
      milestones: [...roadmap.milestones, { id: uid(), title, due: null, done: false, steps: [] }],
    });
    setMilestoneText('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to all roadmaps">
          <ArrowLeft />
        </Button>
        <span className="text-2xl" aria-hidden="true">{roadmap.emoji}</span>
        <Input
          className="text-lg font-semibold"
          value={roadmap.title}
          onChange={(e) => onChange({ ...roadmap, title: e.target.value })}
          aria-label="Roadmap title"
        />
      </div>

      <Card className="py-4">
        <CardContent className="space-y-2 px-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium tabular-nums">{done}/{total} steps · {pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="presentation">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </CardContent>
      </Card>

      {roadmap.milestones.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No milestones yet — add the first one below. 🧭
          </CardContent>
        </Card>
      ) : (
        <ol className="ml-3 border-l-2 border-border pt-1">
          {roadmap.milestones.map((m) => (
            <MilestoneItem
              key={m.id}
              milestone={m}
              onChange={(next) => patchMilestone(m.id, next)}
              onDelete={() => deleteMilestone(m.id)}
            />
          ))}
        </ol>
      )}

      <div className="flex gap-2">
        <Input
          value={milestoneText}
          placeholder="New milestone…"
          onChange={(e) => setMilestoneText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addMilestone()}
          aria-label="New milestone title"
        />
        <Button onClick={addMilestone}>
          <Plus /> Milestone
        </Button>
      </div>
    </div>
  );
}

function Roadmap() {
  const [roadmaps, setRoadmaps] = useStore('roadmaps', []);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);

  const current = roadmaps.find((r) => r.id === openId) ?? null;

  const createFrom = (tpl) => {
    const roadmap = {
      id: uid(),
      title: tpl.key === 'blank' ? 'New roadmap' : tpl.title,
      emoji: tpl.emoji,
      createdMs: Date.now(),
      milestones: tpl.milestones.map((m) => ({
        id: uid(),
        title: m.title,
        due: null,
        done: false,
        steps: m.steps.map((text) => ({ id: uid(), text, done: false })),
      })),
    };
    setRoadmaps([roadmap, ...roadmaps]);
    setCreating(false);
    setOpenId(roadmap.id);
    toast.success(`Roadmap "${roadmap.title}" created`);
  };

  const deleteRoadmap = (id) => {
    const target = roadmaps.find((r) => r.id === id);
    setRoadmaps(roadmaps.filter((r) => r.id !== id));
    if (openId === id) setOpenId(null);
    toast.success(`Roadmap "${target?.title ?? ''}" deleted`);
  };

  return (
    <ToolPage
      icon="🗺️"
      title="Roadmap"
      description="Plan startups, projects, research or exam prep as milestones with concrete steps."
      actions={
        !current && (
          <Button onClick={() => setCreating(true)}>
            <Plus /> New roadmap
          </Button>
        )
      }
    >
      {current ? (
        <RoadmapDetail
          roadmap={current}
          onChange={(next) => setRoadmaps(roadmaps.map((r) => (r.id === next.id ? next : r)))}
          onBack={() => setOpenId(null)}
        />
      ) : roadmaps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="text-4xl" aria-hidden="true">🗺️</span>
            <p className="max-w-md text-sm text-muted-foreground">
              No roadmaps yet. Start from a blank plan or pick a template for a
              startup launch, research paper or exam prep.
            </p>
            <Button onClick={() => setCreating(true)}>
              <Plus /> New roadmap
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {roadmaps.map((r) => {
            const { done, total, pct } = progressOf(r);
            const next = nextMilestone(r);
            return (
              <Card
                key={r.id}
                className="group cursor-pointer py-4 transition-colors hover:border-primary/50"
                onClick={() => setOpenId(r.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpenId(r.id)}
                aria-label={`Open roadmap “${r.title}”`}
              >
                <CardContent className="space-y-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" aria-hidden="true">{r.emoji}</span>
                    <h3 className="min-w-0 flex-1 truncate font-semibold tracking-tight">{r.title}</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 transition-opacity group-hover:opacity-60 hover:opacity-100 focus-visible:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRoadmap(r.id);
                      }}
                      aria-label={`Delete roadmap “${r.title}”`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{done}/{total} steps</span>
                      <span className="tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="presentation">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {next ? (
                      <>
                        Next: <span className="font-medium text-foreground">{next.title}</span>
                        {' · '}
                        <span className={!next.done && next.due < startOfToday() ? 'text-destructive' : ''}>
                          {fmtDate(next.due)}
                        </span>
                      </>
                    ) : (
                      'No upcoming milestone with a date'
                    )}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New roadmap</DialogTitle>
            <DialogDescription>
              Start blank or pick a template — every milestone and step stays editable.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                className="flex items-start gap-3 rounded-md border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent"
                onClick={() => createFrom(t)}
              >
                <span className="text-2xl" aria-hidden="true">{t.emoji}</span>
                <span className="min-w-0">
                  <span className="block font-medium">{t.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </ToolPage>
  );
}

export default Roadmap;
