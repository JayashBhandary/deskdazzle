import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataPanel } from './parts/DataConverter';
import { UnitsPanel } from './parts/UnitConverter';
import { CurrencyPanel } from './parts/CurrencyConverter';

export const CONVERTER_TAB_KEYS = ['data', 'units', 'currency'];

// The Converters app — a tabbed shell over the Data, Units and Currency
// panels. Tabs can be driven externally (the page syncs `tab` to the URL) or
// managed internally, via the controlled/uncontrolled `tab`/`onTabChange`.
function ConvertersApp({ tab: tabProp, onTabChange }) {
  const [tabState, setTabState] = useState('data');
  const tab = tabProp ?? tabState;
  const setTab = (v) => {
    if (onTabChange) onTabChange(v);
    else setTabState(v);
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
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
  );
}

export default ConvertersApp;
