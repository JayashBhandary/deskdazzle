import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import ToolPage from '../components/ToolPage';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function GradientPanel() {
  const [startColor, setStartColor] = useState('#ff0000');
  const [endColor, setEndColor] = useState('#0033ff');
  const [horizontal, setHorizontal] = useState("right");
  const [vertical, setVertical] = useState("top");
  const gradientRef = useRef(null);

  const cssValue = `linear-gradient(to ${horizontal} ${vertical}, ${startColor}, ${endColor})`;

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

  const handleStartColorChange = (event) => {
    setStartColor(event.target.value);
  };

  const handleEndColorChange = (event) => {
    setEndColor(event.target.value);
  };

  const saveImage = () => {
    html2canvas(gradientRef.current).then(function (canvas) {
      const link = document.createElement('a');
      link.download = `DeskDazzle ${startColor} ${endColor}.png`;
      link.href = canvas.toDataURL();
      link.click();
    });
  };

  const share = async () => {
    try {
      const data = { text: cssValue };
      await navigator.share(data);
    } catch (error) {
      toast.error(String(error));
    }
  };

  const gradientStyle = {
    backgroundImage: cssValue,
  };

  return (
    <div className="space-y-6">
        <div>
          <div
            style={gradientStyle}
            ref={gradientRef}
            onClick={saveImage}
            className="relative h-64 w-full cursor-pointer overflow-hidden rounded-xl border"
            title="Click to download the image"
          >
            <div className="absolute left-3 top-3 space-y-0.5 font-bold text-white/50">
              <p>Desk Dazzle</p>
              <p>{startColor}</p>
              <p>{endColor}</p>
              <p className="text-sm">{cssValue}</p>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Click on the gradient to download the image.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <div className="space-y-2">
                <Label htmlFor="start-color">Start Color</Label>
                <input
                  type="color"
                  id="start-color"
                  className="block h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1"
                  value={startColor}
                  onChange={handleStartColorChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-color">End Color</Label>
                <input
                  type="color"
                  id="end-color"
                  className="block h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1"
                  value={endColor}
                  onChange={handleEndColorChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vertical">Vertical</Label>
                <Select value={vertical} onValueChange={setVertical}>
                  <SelectTrigger id="vertical" className="w-32">
                    <SelectValue placeholder="Vertical" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="bottom">Bottom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="horizontal">Horizontal</Label>
                <Select value={horizontal} onValueChange={setHorizontal}>
                  <SelectTrigger id="horizontal" className="w-32">
                    <SelectValue placeholder="Horizontal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm">
                {cssValue}
              </code>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(cssValue)}>
                <Copy /> Copy CSS
              </Button>
              <Button variant="outline" size="sm" onClick={share}>
                <Share2 /> Share
              </Button>
            </div>
          </CardContent>
        </Card>
    </div>
  )
}

function GradientGenerator() {
  return (
    <ToolPage
      wide
      icon="🌈"
      title="Gradient Generator"
      description="Compose a two-color CSS gradient, copy the CSS or download it as an image."
    >
      <GradientPanel />
    </ToolPage>
  )
}

export default GradientGenerator
