import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useSettings } from '@/lib/settings/useSettings';
import AppearancePanel from './parts/AppearancePanel';
import ColorsPanel from './parts/ColorsPanel';

export const SETTINGS_TAB_KEYS = ['appearance', 'colors'];

// DeskDazzle settings. Powers both the desktop widget and the /settings page;
// the active tab can be controlled by the host (URL-driven on the full page).
export default function SettingsApp({ tab, onTabChange }) {
  const { settings, update, setColor, setPalette, replaceAll } = useSettings();
  const [internalTab, setInternalTab] = useState('appearance');
  const active = tab ?? internalTab;
  const setActive = onTabChange ?? setInternalTab;

  return (
    <Tabs value={active} onValueChange={setActive} className="@container flex h-full min-h-0 flex-col gap-3">
      <TabsList className="w-full">
        <TabsTrigger value="appearance" className="flex-1">Appearance</TabsTrigger>
        <TabsTrigger value="colors" className="flex-1">Colours</TabsTrigger>
      </TabsList>

      <div className="min-h-0 flex-1 overflow-auto pr-1">
        <TabsContent value="appearance" className="mt-0">
          <AppearancePanel settings={settings} update={update} />
        </TabsContent>
        <TabsContent value="colors" className="mt-0">
          <ColorsPanel
            settings={settings}
            setColor={setColor}
            setPalette={setPalette}
            update={update}
            replaceAll={replaceAll}
          />
        </TabsContent>
      </div>
    </Tabs>
  );
}
