import React from 'react';
import ToolPage from '../components/ToolPage';
import FlashcardsApp from '../apps/flashcards/FlashcardsApp';

// Thin route host: the Flashcards app itself lives in src/apps/flashcards.
function Flashcards() {
  return (
    <ToolPage
      icon="🧠"
      title="Flashcards"
      description="Spaced-repetition flashcards (SM-2) — study smarter, remember longer."
    >
      <FlashcardsApp />
    </ToolPage>
  );
}

export default Flashcards;
