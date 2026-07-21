import React from 'react';
import ToolPage from '../components/ToolPage';
import WordApp from '../apps/word/WordApp';

// Thin route host: the Word app lives in src/apps/word and is shared with the
// desktop widget. Documents export to real .docx via the office WASM core.
function WordProcessor() {
  return (
    <ToolPage
      wide
      icon="📄"
      title="Word"
      description="Write documents and save them as real .docx — headings, lists, tables and formatting, all on-device."
    >
      <div className="h-[74vh]">
        <WordApp />
      </div>
    </ToolPage>
  );
}

export default WordProcessor;
