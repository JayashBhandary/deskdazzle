import React, { useContext, useState } from 'react'
import { ThemeContext } from '../App';

const LANGS = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'ru', name: 'Russian' },
];

function TranslationTool() {
  const { theme } = useContext(ThemeContext);
  const [text, setText] = useState('');
  const [from, setFrom] = useState('en');
  const [to, setTo] = useState('es');
  const [result, setResult] = useState('');
  const [status, setStatus] = useState('idle');

  const translate = async () => {
    if (!text.trim()) return;
    setStatus('loading');
    setResult('');
    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`
      ).then((r) => r.json());
      if (res.responseData?.translatedText) {
        setResult(res.responseData.translatedText);
        setStatus('idle');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
    setText(result || text);
    setResult('');
  };

  return (
    <div className='page'>
      <div className='page__content'>
        <label>💬 TranslationTool</label>
        <div className='content'>
          <div className='tool'>
            <div className='tool__panel' style={{ maxWidth: '700px', width: '100%' }}>
              <div className='tool__row'>
                <select className={`tool__num ${theme ? 'dark' : 'light'}`} value={from} onChange={(e) => setFrom(e.target.value)}>
                  {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
                <button className={`header_button ${theme ? 'dark' : 'light'}`} onClick={swap}>⇄</button>
                <select className={`tool__num ${theme ? 'dark' : 'light'}`} value={to} onChange={(e) => setTo(e.target.value)}>
                  {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
              </div>
              <textarea
                className={`tool__input tool__editor ${theme ? 'dark' : 'light'}`}
                rows={4}
                value={text}
                placeholder='Enter text to translate'
                onChange={(e) => setText(e.target.value)}
              />
              <button className={`header_button ${theme ? 'dark' : 'light'}`} onClick={translate}>🌐 Translate</button>
              {status === 'loading' && <p>Translating...</p>}
              {status === 'error' && <p className='tool__error'>Translation failed. Try again.</p>}
              {result && (
                <div className={`tool__markdown ${theme ? 'dark' : 'light'}`} style={{ minHeight: 'auto' }}>
                  <p>{result}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TranslationTool
