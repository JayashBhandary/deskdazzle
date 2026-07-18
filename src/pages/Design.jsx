import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ToolPage from '../components/ToolPage';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PickerPanel } from './ColorPicker';
import { GradientPanel } from './GradientGenerator';

function Design() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const tab = requested === 'gradient' ? 'gradient' : 'picker';

  const handleTabChange = (value) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <ToolPage
      wide
      icon="🎨"
      title="Design"
      description="Pick colours and build CSS gradients."
    >
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
    </ToolPage>
  );
}

export default Design;
