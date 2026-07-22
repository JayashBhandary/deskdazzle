import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// A self-contained tooltip that shows a control's keyboard shortcut on hover.
// Wraps a single focusable child (asChild), e.g. a Button.
export function ShortcutTip({ label, side = 'bottom', children }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ShortcutTip;
