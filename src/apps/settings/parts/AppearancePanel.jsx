import React, { useContext } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { ThemeContext } from '../../../App';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FONTS } from '@/lib/settings/tokens';
import ScaleSelector from './ScaleSelector';

const THEME_OPTIONS = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

export default function AppearancePanel({ settings, update }) {
  const { theme, setTheme } = useContext(ThemeContext);
  const current = settings.themeFollowSystem ? 'system' : theme ? 'dark' : 'light';

  const pickTheme = (id) => {
    if (id === 'system') { update({ themeFollowSystem: true }); return; }
    update({ themeFollowSystem: false });
    setTheme(id === 'dark');
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <Label>Theme</Label>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => pickTheme(id)}
              aria-pressed={current === id}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border py-3 text-sm font-medium transition-colors',
                current === id
                  ? 'border-ring bg-accent text-accent-foreground ring-2 ring-ring'
                  : 'border-border hover:bg-accent/50',
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <Label>Display scaling</Label>
        <ScaleSelector value={settings.scale} onChange={(scale) => update({ scale })} />
      </section>

      <section className="flex flex-col gap-2">
        <Label htmlFor="font-select">Font</Label>
        <Select value={settings.font} onValueChange={(font) => update({ font })}>
          <SelectTrigger id="font-select" className="w-full">
            <SelectValue placeholder="Choose a font" />
          </SelectTrigger>
          <SelectContent>
            {FONTS.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                <span style={{ fontFamily: f.stack || undefined }}>{f.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="collapsible-dock">Collapsible dock</Label>
          <span className="text-xs text-muted-foreground">
            Hide the desktop dock and reveal it when the pointer nears the bottom edge.
          </span>
        </div>
        <Switch
          id="collapsible-dock"
          checked={settings.collapsibleDock}
          onCheckedChange={(collapsibleDock) => update({ collapsibleDock })}
        />
      </section>

      <section className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="collapsible-header">Collapsible header</Label>
          <span className="text-xs text-muted-foreground">
            Auto-hide the header on the Workspace; reveal it when the pointer nears the top edge.
          </span>
        </div>
        <Switch
          id="collapsible-header"
          checked={settings.collapsibleHeader}
          onCheckedChange={(collapsibleHeader) => update({ collapsibleHeader })}
        />
      </section>
    </div>
  );
}
