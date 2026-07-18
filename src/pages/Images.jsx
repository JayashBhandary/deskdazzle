import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ToolPage from '../components/ToolPage';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ResizePanel } from './ImageResizer';
import { OptimizePanel } from './ImageOptimizer';
import { BatchPanel } from './BatchImageConverter';

const TABS = ['resize', 'optimize', 'batch'];

// One tabbed home for the three on-device image tools. The active tab is
// URL-driven so it can be linked and survives reloads.
function Images() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get('tab');
  const tab = TABS.includes(param) ? param : 'resize';

  return (
    <ToolPage
      wide
      icon="🖼️"
      title="Images"
      description="Resize, optimize and batch-convert images — all on-device."
    >
      <Tabs
        value={tab}
        onValueChange={(t) => setSearchParams({ tab: t }, { replace: true })}
      >
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
    </ToolPage>
  );
}

export default Images;
