import React from 'react';
import { WorkspaceGraphContext, useComputeWorkspaceGraph } from './useWorkspaceEntities';

// Computes the normalized workspace graph ONCE and shares it with every
// consumer (WEBOS Phase 5 perf pass). Without this, each mounted app that calls
// useWorkspaceEntities() rebuilt the whole read-model + indexes independently —
// wasteful when several widgets (Notes, Calendar, Today) are open at once.
export function WorkspaceGraphProvider({ children }) {
  const graph = useComputeWorkspaceGraph();
  return (
    <WorkspaceGraphContext.Provider value={graph}>
      {children}
    </WorkspaceGraphContext.Provider>
  );
}

export default WorkspaceGraphProvider;
