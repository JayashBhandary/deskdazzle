import React, { useContext, useRef, useState } from 'react'
import { ThemeContext } from '../App';

const fmtBytes = (b) => {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
};

function ImageOptimizer() {
  const { theme } = useContext(ThemeContext);
  const [src, setSrc] = useState(null);
  const [fileName, setFileName] = useState('image');
  const [originalSize, setOriginalSize] = useState(0);
  const [quality, setQuality] = useState(0.7);
  const [format, setFormat] = useState('image/jpeg');
  const [output, setOutput] = useState(null); // { url, size }
  const fileRef = useRef(null);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name.replace(/\.[^.]+$/, ''));
    setOriginalSize(file.size);
    setOutput(null);
    const reader = new FileReader();
    reader.onload = () => setSrc(reader.result);
    reader.readAsDataURL(file);
  };

  const optimize = () => {
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          if (output?.url) URL.revokeObjectURL(output.url);
          setOutput({ url: URL.createObjectURL(blob), size: blob.size });
        },
        format,
        quality
      );
    };
    img.src = src;
  };

  const ext = format === 'image/webp' ? 'webp' : 'jpg';
  const saved = output && originalSize ? Math.max(0, Math.round((1 - output.size / originalSize) * 100)) : 0;

  return (
    <div className='page'>
      <div className='page__content'>
        <label>📱 ImageOptimizer</label>
        <div className='content'>
          <div className='tool tool--split'>
            <div className='tool__panel'>
              <button className={`header_button ${theme ? 'dark' : 'light'}`} onClick={() => fileRef.current?.click()}>📁 Choose Image</button>
              <input ref={fileRef} type='file' accept='image/*' hidden onChange={onFile} />
              {src && (
                <>
                  <div className='tool__row'>
                    <label className='tool__label'>Quality: {Math.round(quality * 100)}%</label>
                    <input type='range' min='0.1' max='1' step='0.05' value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
                  </div>
                  <div className='tool__row'>
                    <label className='tool__label'>Format</label>
                    <select className={`tool__num ${theme ? 'dark' : 'light'}`} value={format} onChange={(e) => setFormat(e.target.value)}>
                      <option value='image/jpeg'>JPEG</option>
                      <option value='image/webp'>WebP</option>
                    </select>
                  </div>
                  <p className='tool__label'>Original size: {fmtBytes(originalSize)}</p>
                  <button className={`header_button ${theme ? 'dark' : 'light'}`} onClick={optimize}>⚡ Optimize</button>
                  {output && (
                    <>
                      <p className='tool__label'>Optimized: {fmtBytes(output.size)} ({saved}% smaller)</p>
                      <a className={`header_button ${theme ? 'dark' : 'light'}`} href={output.url} download={`${fileName}-optimized.${ext}`}>⬇️ Download</a>
                    </>
                  )}
                </>
              )}
            </div>
            <div className='tool__preview'>
              {(output?.url || src) ? <img src={output?.url || src} alt='preview' style={{ maxWidth: '100%', maxHeight: '50vh', borderRadius: '12px' }} /> : <p>No image selected.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImageOptimizer
