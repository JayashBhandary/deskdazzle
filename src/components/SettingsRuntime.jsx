// Applies the user's Settings to the live DOM, app-wide. Mounted once near the
// app root so preferences take effect everywhere, not just inside the Settings
// window. Renders nothing.

import { useContext, useEffect } from 'react';
import { ThemeContext } from '../App';
import { useSettings } from '../lib/settings/useSettings';
import { applyScale, applyFont, buildThemeCSS, applyThemeCSS } from '../lib/settings/theme';
import { setSyncDebounceMs } from '../lib/store/syncConfig';

export default function SettingsRuntime() {
  const { settings } = useSettings();
  const { setTheme } = useContext(ThemeContext);

  useEffect(() => { applyScale(settings.scale); }, [settings.scale]);
  useEffect(() => { applyFont(settings.font); }, [settings.font]);
  useEffect(() => { applyThemeCSS(buildThemeCSS(settings.colors)); }, [settings.colors]);
  // Mirror the sync-latency preference to localStorage so the sync engine (which
  // can't read the settings store) picks it up synchronously on the next write.
  useEffect(() => { setSyncDebounceMs(settings.syncLatency); }, [settings.syncLatency]);

  // When "Follow system" is on, mirror the OS light/dark preference into the
  // existing theme boolean (which toggles the `.dark` class centrally).
  useEffect(() => {
    if (!settings.themeFollowSystem || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setTheme(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.themeFollowSystem, setTheme]);

  return null;
}
