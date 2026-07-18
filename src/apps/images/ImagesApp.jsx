import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ResizePanel } from './parts/ImageResizer';
import { OptimizePanel } from './parts/ImageOptimizer';
import { BatchPanel } from './parts/BatchImageConverter';

export const IMAGES_TABS = ['resize', 'optimize', 'batch'];

// The Images app — one tabbed home for the three on-device image tools
// (Resize, Optimize, Batch). Every conversion runs in the Rust/WASM core
// inside a Web Worker, so nothing leaves the device.
//
// Tabs can be driven externally (the page syncs `tab` to the URL) or managed
// internally, via the controlled/uncontrolled `tab`/`onTabChange` pair.
function ImagesApp({ tab: tabProp, onTabChange }) {
  const [tabState, setTabState] = useState('resize');
  const tab = tabProp ?? tabState;
  const setTab = (v) => {
    if (onTabChange) onTabChange(v);
    else setTabState(v);
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="resize">Resize</TabsTrigger>
        <TabsTrigger value="optimize">Optimize</TabsTrigger>
        <TabsTrigger value="batch">Batch</TabsTrigger>
      </TabsList>
      <TabsContent value="resize" className="mt-4">
        <ResizePanel />
      </TabsContent>
      <TabsContent value="optimize" className="mt-4">
        <OptimizePanel />
      </TabsContent>
      <TabsContent value="batch" className="mt-4">
        <BatchPanel />
      </TabsContent>
    </Tabs>
  );
}

export default ImagesApp;
