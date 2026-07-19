// One hook for the whole Settings feature. Wraps the synced `settings` store,
// always hands back a normalized object, and offers small helpers so panels
// don't each re-implement the merge/immutability dance.

import { useStore } from '../store/WorkspaceProvider';
import { DEFAULT_SETTINGS } from './tokens';
import { normalizeSettings } from './theme';

export function useSettings() {
  const [raw, setRaw] = useStore('settings', DEFAULT_SETTINGS);
  const settings = normalizeSettings(raw);

  // Shallow-merge a patch onto the normalized settings.
  const update = (patch) => setRaw((prev) => ({ ...normalizeSettings(prev), ...patch }));

  // Set a single colour token for one mode (light/dark).
  const setColor = (mode, token, value) =>
    setRaw((prev) => {
      const s = normalizeSettings(prev);
      return { ...s, colors: { ...s.colors, [mode]: { ...s.colors[mode], [token]: value } } };
    });

  // Replace an entire palette for one mode.
  const setPalette = (mode, palette) =>
    setRaw((prev) => {
      const s = normalizeSettings(prev);
      return { ...s, colors: { ...s.colors, [mode]: { ...palette } } };
    });

  const replaceAll = (next) => setRaw(normalizeSettings(next));

  return { settings, update, setColor, setPalette, replaceAll };
}
