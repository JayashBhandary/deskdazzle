import React from 'react';
import { ColorPicker, useColor } from 'react-color-palette';
import 'react-color-palette/css';
import { Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// Unified colour picker. One `@container` component that serves BOTH the Design
// "picker" tab (full: two cards side-by-side, big swatch, copy + share) AND the
// desktop colour widget (compact: a single hex-swatch button + picker). The
// layout adapts purely via container-query variants (@sm / @md), so the same
// component is compact in a ~300px widget and roomy on the page. Exported as the
// default so it can be dropped straight into the desktop widget registry.
export function PickerPanel() {
  const [color, setColor] = useColor('#6d28d9');

  // Contrast-aware text colour so the hex reads on any swatch (from ColorWidget).
  const textColor =
    color.rgb.r * 0.299 + color.rgb.g * 0.587 + color.rgb.b * 0.114 > 150 ? '#000' : '#fff';

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${text.toUpperCase()}`);
    } catch {
      // clipboard unavailable
    }
  };

  const share = async () => {
    try {
      await navigator.share({ text: color.hex });
    } catch (error) {
      toast.error(String(error));
    }
  };

  return (
    <div className="@container">
      <div className="grid items-start gap-4 @md:grid-cols-2 @md:gap-6">
        <Card>
          <CardContent className="space-y-3 @md:space-y-4">
            <button
              type="button"
              onClick={() => copyToClipboard(color.hex)}
              style={{ backgroundColor: color.hex, color: textColor }}
              className="flex h-14 w-full items-center justify-center rounded-xl border font-mono text-sm font-semibold shadow-inner transition-transform hover:scale-[1.01] @sm:aspect-square @sm:h-auto @sm:text-base"
              aria-label={`Copy ${color.hex} to clipboard`}
              title="Click to copy hex"
            >
              {color.hex.toUpperCase()}
            </button>
            <div className="hidden flex-wrap items-center gap-2 @sm:flex">
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
            <ColorPicker color={color} onChange={setColor} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PickerPanel;
