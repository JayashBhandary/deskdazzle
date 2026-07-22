import React from 'react';
import ToolPage from '../components/ToolPage';
import DriveApp from '../apps/drive/DriveApp';

// Thin route host: the Drive app lives in src/apps/drive and is shared with the
// desktop widget. Files are stored on-device (IndexedDB) and isolated per
// workspace, like every other app's data.
function Drive() {
  return (
    <ToolPage
      wide
      icon="🗂️"
      title="Drive"
      description="Keep your files on-device — upload, organize in folders, download. Isolated per workspace."
    >
      <div className="h-[74vh]">
        <DriveApp />
      </div>
    </ToolPage>
  );
}

export default Drive;
