import React, { useContext, useRef, useState } from 'react'
import { ThemeContext } from '../App';

function ImageResizer() {
  const { theme } = useContext(ThemeContext);
  const [src, setSrc] = useState(null);
  const [fileName, setFileName] = useState('image');
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [lockRatio, setLockRatio] = useState(true);
  const fileRef = useRef(null);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name.replace(/\.[^.]+$/, ''));
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setNatural({ w: img.width, h: img.height });
        setWidth(img.width);
        setHeight(img.height);
        setSrc(reader.result);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const changeWidth = (w) => {
    setWidth(w);
    if (lockRatio && natural.w) setHeight(Math.round((w / natural.w) * natural.h));
  };
  const changeHeight = (h) => {
    setHeight(h);
    if (lockRatio && natural.h) setWidth(Math.round((h / natural.h) * natural.w));
  };

  const download = () => {
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const link = document.createElement('a');
      link.download = `${fileName}-${width}x${height}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = src;
  };

  return (
    <div className='page'>
      <div className='page__content'>
        <label>📐 ImageResizer</label>
        <div className='content'>
          <div className='tool tool--split'>
            <div className='tool__panel'>
              <button className={`header_button ${theme ? 'dark' : 'light'}`} onClick={() => fileRef.current?.click()}>📁 Choose Image</button>
              <input ref={fileRef} type='file' accept='image/*' hidden onChange={onFile} />
              {src && (
                <>
                  <div className='tool__row'>
                    <label className='tool__label'>Width</label>
                    <input className={`tool__num ${theme ? 'dark' : 'light'}`} type='number' min='1' value={width} onChange={(e) => changeWidth(Number(e.target.value))} />
                    <label className='tool__label'>Height</label>
                    <input className={`tool__num ${theme ? 'dark' : 'light'}`} type='number' min='1' value={height} onChange={(e) => changeHeight(Number(e.target.value))} />
                  </div>
                  <label className='tool__label'>
                    <input type='checkbox' checked={lockRatio} onChange={(e) => setLockRatio(e.target.checked)} /> Lock aspect ratio
                  </label>
                  <p className='tool__label'>Original: {natural.w} × {natural.h}px</p>
                  <button className={`header_button ${theme ? 'dark' : 'light'}`} onClick={download}>⬇️ Download</button>
                </>
              )}
            </div>
            <div className='tool__preview'>
              {src ? <img src={src} alt='preview' style={{ maxWidth: '100%', maxHeight: '50vh', borderRadius: '12px' }} /> : <p>No image selected.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImageResizer
