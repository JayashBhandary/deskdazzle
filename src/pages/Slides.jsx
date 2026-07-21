import React from 'react';
import ToolPage from '../components/ToolPage';
import PptApp from '../apps/ppt/PptApp';

// Thin route host: the PowerPoint app lives in src/apps/ppt and is shared with
// the desktop widget. Decks export to real .pptx (and PDF) via the office core.
function Slides() {
  return (
    <ToolPage
      wide
      icon="📽️"
      title="PowerPoint"
      description="Build slide decks and save them as real .pptx — layouts, bullets, tables, images and notes, all on-device."
    >
      <div className="h-[76vh]">
        <PptApp />
      </div>
    </ToolPage>
  );
}

export default Slides;
