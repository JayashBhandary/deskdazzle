import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Globe, AlarmClock, Timer as TimerIcon, Hourglass, Target } from 'lucide-react';
import ToolPage from '../components/ToolPage';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useNow } from '../lib/time/useNow';
import WorldClockTab from '../components/clock/WorldClockTab';
import AlarmsTab from '../components/clock/AlarmsTab';
import StopwatchTab from '../components/clock/StopwatchTab';
import TimersTab from '../components/clock/TimersTab';
import FocusTab from '../components/clock/FocusTab';

const TABS = [
  { value: 'world', label: 'World Clock', icon: Globe, Panel: WorldClockTab },
  { value: 'alarms', label: 'Alarms', icon: AlarmClock, Panel: AlarmsTab },
  { value: 'stopwatch', label: 'Stopwatch', icon: TimerIcon, Panel: StopwatchTab },
  { value: 'timers', label: 'Timers', icon: Hourglass, Panel: TimersTab },
  { value: 'focus', label: 'Focus', icon: Target, Panel: FocusTab },
];
const KEYS = TABS.map((t) => t.value);

function LocalClock() {
  const now = new Date(useNow());
  return (
    <div className="text-right">
      <div className="font-mono text-lg font-semibold tabular-nums">
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="text-xs text-muted-foreground">
        {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
      </div>
    </div>
  );
}

function Clock() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get('tab');
  const tab = KEYS.includes(param) ? param : 'world';

  const onValueChange = (value) => setSearchParams({ tab: value }, { replace: true });

  return (
    <ToolPage
      wide
      icon="⏰"
      title="Clock"
      description="World clock, alarms, stopwatch, timers and focus sessions — one place for time."
      actions={<LocalClock />}
    >
      <Tabs value={tab} onValueChange={onValueChange}>
        <TabsList className="flex w-full flex-wrap">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5">
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(({ value, Panel }) => (
          <TabsContent key={value} value={value} className="mt-6">
            <Panel />
          </TabsContent>
        ))}
      </Tabs>
    </ToolPage>
  );
}

export default Clock;
