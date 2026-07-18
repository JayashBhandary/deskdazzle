import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PickerPanel from './parts/ColorPicker';
import GradientPanel from './parts/GradientGenerator';

export const DESIGN_TAB_KEYS = ['picker', 'gradient'];

// The Design app: a tabbed container merging the colour picker + gradient
// generator. The active tab is kept in the URL (?tab=picker|gradient) so deep
// links work. Rendered by the thin page host (wrapped in <ToolPage>).
function DesignApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const tab = requested === 'gradient' ? 'gradient' : 'picker';

  const handleTabChange = (value) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <Tabs value={tab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="picker">Colour Picker</TabsTrigger>
        <TabsTrigger value="gradient">Gradient</TabsTrigger>
      </TabsList>
      <TabsContent value="picker" className="mt-4">
        <PickerPanel />
      </TabsContent>
      <TabsContent value="gradient" className="mt-4">
        <GradientPanel />
      </TabsContent>
    </Tabs>
  );
}

export default DesignApp;
