import React from 'react'
import { Link } from 'react-router-dom'
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { useTimer } from '../lib/time/TimeProvider'
import { fmt } from '../lib/time/format'
import { Button } from '@/components/ui/button'

// Compact face on the central focus (pomodoro) engine — same session as the
// Clock app's Focus tab.
function FocusWidget() {
  const { emoji, label, running, remaining, cycleCount, longEvery, todayCount, start, pause, reset, skip } =
    useTimer()

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {emoji} {label}
      </span>
      <span className="font-mono text-5xl font-semibold tabular-nums" aria-live="polite">
        {fmt(remaining)}
      </span>

      <div className="flex items-center gap-1.5" aria-label="Sessions until long break">
        {Array.from({ length: longEvery }, (_, i) => (
          <span
            key={i}
            className={`size-2 rounded-full transition-colors ${
              i < cycleCount ? 'bg-primary' : 'bg-muted-foreground/25'
            }`}
          />
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        {!running ? (
          <Button size="sm" onClick={start}>
            <Play /> Start
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={pause}>
            <Pause /> Pause
          </Button>
        )}
        <Button variant="outline" size="icon" className="size-8" onClick={reset} aria-label="Reset">
          <RotateCcw className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={skip} aria-label="Skip">
          <SkipForward className="size-4" />
        </Button>
      </div>

      <Link to="/clock?tab=focus" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
        {todayCount} done today · open Focus
      </Link>
    </div>
  )
}

export default FocusWidget
