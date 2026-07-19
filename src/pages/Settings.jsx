import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ToolPage from '../components/ToolPage';
import SettingsApp, { SETTINGS_TAB_KEYS } from '../apps/settings/SettingsApp';

// Thin route host: the Settings app lives in src/apps/settings and is shared
// with the desktop widget. Here we wrap it in the page shell and keep the
// active tab in the URL (?tab=…).
function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get('tab');
  const tab = SETTINGS_TAB_KEYS.includes(param) ? param : 'appearance';

  return (
    <ToolPage
      icon="⚙️"
      title="Settings"
      description="Theme, display scaling, font and a full colour editor for DeskDazzle."
    >
      <div className="min-h-[70vh]">
        <SettingsApp tab={tab} onTabChange={(value) => setSearchParams({ tab: value }, { replace: true })} />
      </div>
    </ToolPage>
  );
}

export default Settings;
