import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ToolPage from '../components/ToolPage';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataPanel } from './DataConverter';
import { UnitsPanel } from './UnitConverter';
import { CurrencyPanel } from './CurrencyConverter';

const TABS = ['data', 'units', 'currency'];

function Converters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get('tab');
  const tab = TABS.includes(param) ? param : 'data';

  const onValueChange = (value) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <ToolPage
      wide
      icon="🔁"
      title="Converters"
      description="Convert data formats, units and currencies — data & units run on-device."
    >
      <Tabs value={tab} onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
          <TabsTrigger value="currency">Currency</TabsTrigger>
        </TabsList>
        <TabsContent value="data" className="mt-4">
          <DataPanel />
        </TabsContent>
        <TabsContent value="units" className="mt-4">
          <UnitsPanel />
        </TabsContent>
        <TabsContent value="currency" className="mt-4">
          <CurrencyPanel />
        </TabsContent>
      </Tabs>
    </ToolPage>
  );
}

export default Converters;
