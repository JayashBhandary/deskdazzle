import React from 'react'
import { cn } from '@/lib/utils'

// Small on/off toggle (the project has no shadcn Switch).
//
// Fully theme-driven: the ON track is `bg-primary` and the thumb is
// `bg-primary-foreground` — the token defined to contrast primary — so the
// thumb reads correctly on both the primary (on) and muted (off) track in both
// light and dark themes, without any hardcoded colours.
function Switch({ checked, onCheckedChange, label, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        checked ? 'bg-primary' : 'bg-muted-foreground/35',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block size-5 rounded-full bg-primary-foreground shadow-sm transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

export default Switch
