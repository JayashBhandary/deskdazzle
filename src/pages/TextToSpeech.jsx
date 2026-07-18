import React from 'react';
import ToolPage from '../components/ToolPage';
import TextToSpeechApp from '../apps/tts/TextToSpeechApp';

// Thin route host: the Text to Speech app itself lives in src/apps/tts.
function TextToSpeech() {
  return (
    <ToolPage
      icon="🗣️"
      title="Text to Speech"
      description="Read any text aloud with your browser's built-in voices — pick a voice, tune rate and pitch."
    >
      <TextToSpeechApp />
    </ToolPage>
  );
}

export default TextToSpeech;
