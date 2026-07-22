import React from 'react';
import { cn } from '@/lib/utils';

// Animated collapsible sidebar shell shared by Word / Excel / Notes / PPT.
//
// Wide layout: the aside stays mounted and animates its track width + opacity on
// collapse/expand. An inner wrapper holds a FIXED content width, so the sidebar
// content is revealed/clipped rather than reflowing (text doesn't squish) during
// the ~200ms transition. The flex sibling (the detail pane) expands to fill as
// the track shrinks, so both sides move together.
//
// Narrow layout: a plain full-width panel (the parent swaps sidebar/detail), no
// width animation.
//
// Props: narrow, open, width (px, wide only), pad (right-padding class for the
// gap to the detail pane), noTransition (skip the transition — used while the
// Notes separator is being dragged so resizing stays 1:1).
export function SidebarShell({ narrow, open, width = 256, pad = 'pr-3', noTransition, className, children }) {
  const collapsed = !narrow && !open;
  return (
    <aside
      aria-hidden={collapsed || undefined}
      inert={collapsed ? true : undefined}
      className={cn(
        'shrink-0 overflow-hidden',
        narrow
          ? 'w-full'
          : cn(
            'transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none',
            collapsed && 'pointer-events-none opacity-0',
            noTransition && 'transition-none',
          ),
      )}
      style={narrow ? undefined : { width: open ? width : 0 }}
    >
      <div
        className={cn('flex h-full min-h-0 flex-col gap-3', !narrow && pad, className)}
        style={narrow ? undefined : { width }}
      >
        {children}
      </div>
    </aside>
  );
}

export default SidebarShell;
