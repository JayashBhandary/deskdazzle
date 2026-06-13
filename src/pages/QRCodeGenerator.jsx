import React, { useContext, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react';
import { ThemeContext } from '../App';

function QRCodeGenerator() {
  const { theme } = useContext(ThemeContext);
  const [text, setText] = useState('https://deskdazzle.web.app');
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [size, setSize] = useState(256);
  const wrapRef = useRef(null);

  const download = () => {
    const canvas = wrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'deskdazzle-qrcode.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className='page'>
      <div className='page__content'>
        <label>🔗 QRCodeGenerator</label>
        <div className='content'>
          <div className='tool'>
            <div className='tool__panel'>
              <textarea
                className={`tool__input ${theme ? 'dark' : 'light'}`}
                rows={4}
                value={text}
                placeholder='Enter text or URL'
                onChange={(e) => setText(e.target.value)}
              />
              <div className='tool__row'>
                <label className='tool__label'>Size: {size}px</label>
                <input type='range' min='128' max='512' step='32' value={size} onChange={(e) => setSize(Number(e.target.value))} />
              </div>
              <div className='tool__row'>
                <label className='tool__label'>Foreground</label>
                <input type='color' value={fgColor} onChange={(e) => setFgColor(e.target.value)} />
                <label className='tool__label'>Background</label>
                <input type='color' value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
              </div>
              <button className={`header_button ${theme ? 'dark' : 'light'}`} onClick={download} disabled={!text}>⬇️ Download PNG</button>
            </div>
            <div className='tool__preview' ref={wrapRef}>
              {text ? (
                <QRCodeCanvas value={text} size={size} fgColor={fgColor} bgColor={bgColor} level='H' includeMargin />
              ) : (
                <p>Enter text to generate a QR code.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QRCodeGenerator
