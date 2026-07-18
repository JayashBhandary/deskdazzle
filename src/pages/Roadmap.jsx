import React from 'react';
import ToolPage from '../components/ToolPage';
import RoadmapApp from '../apps/roadmap/RoadmapApp';

// Thin route host: the Roadmap app itself lives in src/apps/roadmap.
function Roadmap() {
  return (
    <ToolPage
      icon="🗺️"
      title="Roadmap"
      description="Plan startups, projects, research or exam prep as milestones with concrete steps."
    >
      <RoadmapApp />
    </ToolPage>
  );
}

export default Roadmap;
