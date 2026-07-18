import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ToolPage from '../components/ToolPage';
import ClockApp, { CLOCK_TAB_KEYS } from '../apps/clock/ClockApp';

// Thin route host: the Clock app itself lives in src/apps/clock and is shared
// with the desktop widget. Here we just wrap it in the page shell and keep the
// active tab in the URL (?tab=…), so deep links like /clock?tab=focus work.
function Clock() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get('tab');
  const tab = CLOCK_TAB_KEYS.includes(param) ? param : 'clock';

  return (
    <ToolPage
      wide
      icon="⏰"
      title="Clock"
      description="World clock, alarms, stopwatch, timers and focus sessions — one place for time."
    >
      <div className="h-[70vh]">
        <ClockApp tab={tab} onTabChange={(value) => setSearchParams({ tab: value }, { replace: true })} />
      </div>
    </ToolPage>
  );
}

export default Clock;
