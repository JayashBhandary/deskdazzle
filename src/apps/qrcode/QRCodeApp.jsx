import React, { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

function QRCodeApp() {
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
    <div className="@container grid gap-6 md:grid-cols-2">
      <Card>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="qr-text">Text or URL</Label>
            <Textarea
              id="qr-text"
              rows={4}
              value={text}
              placeholder="Enter text or URL"
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qr-size">
              Size: <span className="tabular-nums">{size}px</span>
            </Label>
            <input
              id="qr-size"
              className="w-full accent-primary"
              type="range"
              min="128"
              max="512"
              step="32"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="qr-fg">Foreground</Label>
              <input
                id="qr-fg"
                type="color"
                className="h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1"
                value={fgColor}
                onChange={(e) => setFgColor(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="qr-bg">Background</Label>
              <input
                id="qr-bg"
                type="color"
                className="h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={download} disabled={!text}>
            <Download /> Download PNG
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent
          ref={wrapRef}
          className="flex min-h-72 items-center justify-center"
        >
          {text ? (
            <QRCodeCanvas
              value={text}
              size={size}
              fgColor={fgColor}
              bgColor={bgColor}
              level="H"
              includeMargin
              className="max-w-full rounded-md border"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Enter text to generate a QR code.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default QRCodeApp;
