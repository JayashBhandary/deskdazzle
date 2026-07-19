// Applies the user's Settings to the live DOM, app-wide. Mounted once near the
// app root so preferences take effect everywhere, not just inside the Settings
// window. Renders nothing.

import { useContext, useEffect } from 'react';
import { ThemeContext } from '../App';
import { useSettings } from '../lib/settings/useSettings';
import { applyScale, applyFont, buildThemeCSS, applyThemeCSS } from '../lib/settings/theme';

export default function SettingsRuntime() {
  const { settings } = useSettings();
  const { setTheme } = useContext(ThemeContext);

  useEffect(() => { applyScale(settings.scale); }, [settings.scale]);
  useEffect(() => { applyFont(settings.font); }, [settings.font]);
  useEffect(() => { applyThemeCSS(buildThemeCSS(settings.colors)); }, [settings.colors]);

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
