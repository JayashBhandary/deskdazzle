import React from 'react';
import ToolPage from '../components/ToolPage';
import NotesApp from '../apps/notes/NotesApp';

// Thin route host: the Notes app itself lives in src/apps/notes and is shared
// with the desktop widget. Here we just wrap it in the page shell.
function NoteTaking() {
  return (
    <ToolPage
      wide
      icon="💡"
      title="Notes"
      description="Markdown notes with [[wiki links]] — stored on this device, searchable from the command palette."
    >
      <div className="h-[70vh]">
        <NotesApp />
      </div>
    </ToolPage>
  );
}

export default NoteTaking;
