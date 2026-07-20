// Shared presentation + navigation helpers for workspace entities, so every
// app renders a cross-app link the same way (icon + label) and opens it in its
// owning app. Kept separate from useWorkspaceEntities (the data layer) so
// plain components can import the glyphs without pulling in the aggregator.

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ENTITY_ROUTES } from './useWorkspaceEntities';

// Small glyph per entity type, shown on chips so a cross-app link is
// recognisable at a glance.
export const ENTITY_ICON = {
  note: '📝',
  task: '✅',
  roadmap: '🗺️',
  milestone: '📍',
  deck: '🃏',
};

export const entityIcon = (type) => ENTITY_ICON[type] || '•';

// A navigate-based opener: any entity jumps to its owning app's route. Apps
// that can open an entity *in place* (e.g. Notes opening a note) should pass
// their own handler instead; this is the generic fallback for viewer apps
// (Calendar, Today) that just want to hand off to the right app.
export function useOpenEntity() {
  const navigate = useNavigate();
  return useCallback(
    (entity) => {
      if (!entity) return;
      navigate(ENTITY_ROUTES[entity.type] || '/');
    },
    [navigate],
  );
}
