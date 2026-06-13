import React, { useContext, useState } from 'react'
import { ThemeContext } from '../App';

function URLShortener() {
  const { theme } = useContext(ThemeContext);
  const [url, setUrl] = useState('');
  const [short, setShort] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const isValidUrl = (value) => {
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const shorten = async () => {
    if (!isValidUrl(url)) {
      setStatus('error');
      setError('Enter a valid URL (including http:// or https://).');
      return;
    }
    setStatus('loading');
    setError('');
    setShort('');
    setCopied(false);
    try {
      const res = await fetch(
        `https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`
      ).then((r) => r.json());
      if (res.shorturl) {
        setShort(res.shorturl);
        setStatus('idle');
      } else {
        setStatus('error');
        setError(res.errormessage || 'Could not shorten URL.');
      }
    } catch {
      setStatus('error');
      setError('Request failed. Try again.');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(short);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className='page'>
      <div className='page__content'>
        <label>🔗 URLShortner</label>
        <div className='content'>
          <div className='tool'>
            <div className='tool__panel' style={{ maxWidth: '600px', width: '100%' }}>
              <div className='card'>
                <input
                  className={`${theme ? 'dark' : 'light'}`}
                  value={url}
                  placeholder='https://example.com/very/long/link'
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && shorten()}
                />
                <button className='submit-btn' style={{ color: theme ? 'white' : 'black' }} onClick={shorten}>Shorten</button>
              </div>
              {status === 'loading' && <p>Shortening...</p>}
              {status === 'error' && <p className='tool__error'>{error}</p>}
              {short && (
                <div className={`weather-card ${theme ? 'dark' : 'light'}`} style={{ cursor: 'pointer' }} onClick={copy}>
                  <h2 style={{ wordBreak: 'break-all' }}>{short}</h2>
                  <p>{copied ? '✅ Copied!' : '👆 Click to copy'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default URLShortener
