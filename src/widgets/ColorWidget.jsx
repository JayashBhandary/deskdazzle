import React from 'react'
import { ColorPicker, useColor } from 'react-color-palette';
import 'react-color-palette/css';
import { toast } from 'sonner';

function ColorWidget() {
  const [color, setColor] = useColor('#6d28d9');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(color.hex);
      toast.success(`Copied ${color.hex.toUpperCase()}`);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <button
        type="button"
        onClick={copy}
        className="flex h-14 w-full items-center justify-center rounded-lg border font-mono text-sm font-semibold shadow-inner transition-transform hover:scale-[1.01]"
        style={{ backgroundColor: color.hex, color: color.rgb.r * 0.299 + color.rgb.g * 0.587 + color.rgb.b * 0.114 > 150 ? '#000' : '#fff' }}
        title="Click to copy hex"
      >
        {color.hex.toUpperCase()}
      </button>
      <div className="overflow-hidden rounded-lg">
        <ColorPicker color={color} onChange={setColor} hideInput={['rgb', 'hsv']} height={110} />
      </div>
    </div>
  )
}

export default ColorWidget
