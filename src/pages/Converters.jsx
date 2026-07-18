import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ToolPage from '../components/ToolPage';
import ConvertersApp, { CONVERTER_TAB_KEYS } from '../apps/converters/ConvertersApp';

// Thin route host: the Converters app itself lives in src/apps/converters.
// Here we just wrap it in the page shell and keep the active tab in the URL
// (?tab=…), so deep links like /converters?tab=currency work.
function Converters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get('tab');
  const tab = CONVERTER_TAB_KEYS.includes(param) ? param : 'data';

  return (
    <ToolPage
      wide
      icon="🔁"
      title="Converters"
      description="Convert data formats, units and currencies — data & units run on-device."
    >
      <ConvertersApp
        tab={tab}
        onTabChange={(value) => setSearchParams({ tab: value }, { replace: true })}
      />
    </ToolPage>
  );
}

export default Converters;
