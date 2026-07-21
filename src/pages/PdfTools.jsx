import React from 'react';
import ToolPage from '../components/ToolPage';
import PdfApp from '../apps/pdf/PdfApp';

// Thin route host: the PDF app lives in src/apps/pdf and is shared with the
// desktop widget. Compose new PDFs, merge several, or organize one's pages —
// all on-device via the office core.
function PdfTools() {
  return (
    <ToolPage
      wide
      icon="📕"
      title="PDF"
      description="Create PDFs from text, merge files, and reorder / rotate / delete / extract pages — all on-device."
    >
      <div className="h-[76vh]">
        <PdfApp />
      </div>
    </ToolPage>
  );
}

export default PdfTools;
