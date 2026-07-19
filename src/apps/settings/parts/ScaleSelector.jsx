import React from 'react';
import { cn } from '@/lib/utils';
import { SCALE_STEPS } from '@/lib/settings/tokens';

// macOS-style "Larger Text ←→ More Space" picker. Each step is a mini window
// preview whose sample text scales with the option, so the trade-off is visible.
function Preview({ scale, active }) {
  // Map the scale range onto a readable preview font-size.
  const px = 5 + (scale - 0.85) * 12;
  return (
    <div
      className={cn(
        'flex w-full flex-col overflow-hidden rounded-md border bg-card shadow-sm transition-all',
        active ? 'border-ring ring-2 ring-ring' : 'border-border',
      )}
    >
      <div className="flex items-center gap-1 border-b bg-muted/60 px-1.5 py-1">
        <span className="size-1.5 rounded-full bg-red-500" />
        <span className="size-1.5 rounded-full bg-amber-400" />
        <span className="size-1.5 rounded-full bg-green-500" />
      </div>
      <div className="flex flex-col gap-1 p-1.5" style={{ fontSize: `${px}px`, lineHeight: 1.25 }}>
        <span className="font-semibold text-card-foreground">Aa</span>
        <span className="h-[0.35em] w-full rounded-full bg-muted-foreground/40" />
        <span className="h-[0.35em] w-2/3 rounded-full bg-muted-foreground/40" />
      </div>
    </div>
  );
}

export default function ScaleSelector({ value, onChange }) {
  return (
    <div>
      <div className="flex items-end gap-2">
        {SCALE_STEPS.map((step) => {
          const active = Math.abs(step - value) < 0.001;
          return (
            <button
              key={step}
              type="button"
              onClick={() => onChange(step)}
              aria-pressed={active}
              title={`${Math.round(step * 100)}%`}
              className="flex-1 cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Preview scale={step} active={active} />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>Larger Text</span>
        <span>More Space</span>
      </div>
    </div>
  );
}
