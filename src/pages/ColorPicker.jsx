import React from 'react';
import { ColorPicker, useColor } from "react-color-palette";
import "react-color-palette/css";
import { Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import ToolPage from '../components/ToolPage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function PickerPanel() {
  const [color, setColor] = useColor("#121212");

  const copyToClipboard = (text) => {
    navigator.permissions.query({ name: "clipboard-write" }).then((result) => {
      if (result.state === "granted" || result.state === "prompt") {
        navigator.clipboard.writeText(text).then(() => {
          // Alert the user that the action took place.
          // Nobody likes hidden stuff being done under the hood!
          toast.success('Copied to clipboard');
        });
      }
    });
  }

  const share = async () => {
    try {
      const data = { text: color.hex };
      await navigator.share(data);
    } catch (error) {
      toast.error(String(error));
    }
  };

  return (
    <div className="grid items-start gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => copyToClipboard(color.hex)}
              style={{ backgroundColor: color.hex }}
              className="flex aspect-square w-full items-center justify-center rounded-xl border transition-transform hover:scale-[1.01]"
              aria-label={`Copy ${color.hex} to clipboard`}
            >
              <span className="font-bold text-white mix-blend-difference">COPY HEX</span>
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
                {color.hex}
              </code>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(color.hex)}>
                <Copy /> Copy
              </Button>
              <Button variant="outline" size="sm" onClick={share}>
                <Share2 /> Share
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <ColorPicker
              color={color}
              onChange={setColor}
            />
          </CardContent>
        </Card>
    </div>
  )
}

function ColorPickers() {
  return (
    <ToolPage
      wide
      icon="🎨"
      title="Color Picker"
      description="Pick a color and grab its HEX, RGB or HSV values."
    >
      <PickerPanel />
    </ToolPage>
  )
}

export default ColorPickers
