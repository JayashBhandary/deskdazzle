import React from 'react';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { entityIcon } from '@/lib/context/entityMeta';

// "Linked from" list — every workspace entity that points at the current one
// via a [[wiki link]], across all apps. Extracted from Notes so any app can
// drop it in: pass the backlink entities (from `wctx.backlinksOf(id)`) and an
// `onOpen(entity)` handler. Renders nothing when there are no backlinks.
function Backlinks({ entities, onOpen, label = 'Linked from', className = '' }) {
  if (!entities || entities.length === 0) return null;
  return (
    <div className={`mt-4 border-t pt-3 ${className}`}>
      <p className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Link2 className="size-3.5" /> {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {entities.map((ent) => (
          <Button
            key={ent.id}
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onOpen?.(ent)}
          >
            <span className="text-xs text-muted-foreground">{entityIcon(ent.type)}</span>
            {ent.title || 'Untitled'}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default Backlinks;
