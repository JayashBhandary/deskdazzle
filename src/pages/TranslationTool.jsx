import React from 'react';
import ToolPage from '../components/ToolPage';
import TranslationApp from '../apps/translation/TranslationApp';

// Thin route host: the Translation app itself lives in src/apps/translation.
function TranslationTool() {
  return (
    <ToolPage
      icon="💬"
      title="Translation Tool"
      description="Translate text between languages using the MyMemory API."
    >
      <TranslationApp />
    </ToolPage>
  );
}

export default TranslationTool;
