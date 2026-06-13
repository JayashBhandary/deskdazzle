import React, { useContext, useEffect, useState } from 'react'
import { ThemeContext } from '../App';

function TextToSpeech() {
  const { theme } = useContext(ThemeContext);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [text, setText] = useState('Hello! Welcome to Desk Dazzle.');
  const [voices, setVoices] = useState([]);
  const [voiceName, setVoiceName] = useState('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      setVoices(list);
      if (list.length && !voiceName) setVoiceName(list[0].name);
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  const speak = () => {
    if (!supported || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = voices.find((v) => v.name === voiceName);
    if (voice) utter.voice = voice;
    utter.rate = rate;
    utter.pitch = pitch;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  const stop = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  return (
    <div className='page'>
      <div className='page__content'>
        <label>🗣️ TextToSpeech</label>
        <div className='content'>
          <div className='tool'>
            {!supported ? (
              <p>Your browser does not support speech synthesis.</p>
            ) : (
              <div className='tool__panel' style={{ width: '100%', maxWidth: '700px' }}>
                <textarea
                  className={`tool__input tool__editor ${theme ? 'dark' : 'light'}`}
                  rows={6}
                  value={text}
                  placeholder='Type something to read aloud...'
                  onChange={(e) => setText(e.target.value)}
                />
                <div className='tool__row'>
                  <label className='tool__label'>Voice</label>
                  <select className={`tool__num ${theme ? 'dark' : 'light'}`} value={voiceName} onChange={(e) => setVoiceName(e.target.value)}>
                    {voices.map((v) => (
                      <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                    ))}
                  </select>
                </div>
                <div className='tool__row'>
                  <label className='tool__label'>Rate: {rate.toFixed(1)}</label>
                  <input type='range' min='0.5' max='2' step='0.1' value={rate} onChange={(e) => setRate(Number(e.target.value))} />
                </div>
                <div className='tool__row'>
                  <label className='tool__label'>Pitch: {pitch.toFixed(1)}</label>
                  <input type='range' min='0' max='2' step='0.1' value={pitch} onChange={(e) => setPitch(Number(e.target.value))} />
                </div>
                <div className='tool__row'>
                  <button className={`header_button ${theme ? 'dark' : 'light'}`} onClick={speak}>{speaking ? '🔊 Speaking...' : '▶️ Speak'}</button>
                  <button className={`header_button ${theme ? 'dark' : 'light'}`} onClick={stop}>⏹️ Stop</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TextToSpeech
