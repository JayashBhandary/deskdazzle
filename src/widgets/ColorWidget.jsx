import React, { useState } from 'react'
import { ColorPicker, useColor } from 'react-color-palette';
import 'react-color-palette/css';

function ColorWidget() {
  const [color, setColor] = useColor('#6d28d9');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(color.hex);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div className='widget'>
      <div className='colorw__swatch' style={{ backgroundColor: color.hex }} onClick={copy}>
        {copied ? '✅ Copied' : color.hex.toUpperCase()}
      </div>
      <ColorPicker color={color} onChange={setColor} hideInput={['rgb', 'hsv']} height={120} />
    </div>
  )
}

export default ColorWidget
