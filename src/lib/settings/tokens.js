// Static metadata for the Settings app: which theme tokens are editable, how
// they're grouped in the UI, the built-in defaults (mirrored from index.css),
// the curated font list, and the UI-scale steps.

// Editable tokens grouped into sections. Each token id maps to a `--<id>` CSS
// custom property. Order here is the order shown in the Colors panel.
export const TOKEN_GROUPS = [
  {
    id: 'base',
    label: 'Base',
    tokens: [
      { id: 'background', label: 'Background' },
      { id: 'foreground', label: 'Text' },
      { id: 'card', label: 'Card' },
      { id: 'card-foreground', label: 'Card text' },
      { id: 'popover', label: 'Popover' },
      { id: 'popover-foreground', label: 'Popover text' },
      { id: 'border', label: 'Border' },
      { id: 'input', label: 'Input' },
      { id: 'ring', label: 'Focus ring' },
    ],
  },
  {
    id: 'primary',
    label: 'Primary',
    tokens: [
      { id: 'primary', label: 'Primary' },
      { id: 'primary-foreground', label: 'On primary' },
    ],
  },
  {
    id: 'accents',
    label: 'Secondary & accents',
    tokens: [
      { id: 'secondary', label: 'Secondary' },
      { id: 'secondary-foreground', label: 'On secondary' },
      { id: 'muted', label: 'Muted' },
      { id: 'muted-foreground', label: 'Muted text' },
      { id: 'accent', label: 'Accent' },
      { id: 'accent-foreground', label: 'On accent' },
    ],
  },
  {
    id: 'state',
    label: 'State',
    tokens: [
      { id: 'destructive', label: 'Destructive' },
      { id: 'destructive-foreground', label: 'On destructive' },
    ],
  },
  {
    id: 'charts',
    label: 'Charts',
    tokens: [
      { id: 'chart-1', label: 'Chart 1' },
      { id: 'chart-2', label: 'Chart 2' },
      { id: 'chart-3', label: 'Chart 3' },
      { id: 'chart-4', label: 'Chart 4' },
      { id: 'chart-5', label: 'Chart 5' },
    ],
  },
];

// Flat set of every valid token id — used to sanitise imported/injected values.
export const TOKEN_IDS = new Set(TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.id)));

// "Surface" tokens get slightly more desaturation when auto-generating a dark
// theme, so backgrounds stay calm and accents keep their punch.
export const SURFACE_TOKENS = new Set([
  'background', 'card', 'popover', 'muted', 'secondary', 'accent', 'border', 'input',
]);

// Built-in palettes — kept identical to index.css so "reset" restores the
// stock theme exactly and dark auto-generation starts from the real light base.
export const DEFAULT_LIGHT = {
  background: 'oklch(1 0 0)',
  foreground: 'oklch(0.145 0 0)',
  card: 'oklch(1 0 0)',
  'card-foreground': 'oklch(0.145 0 0)',
  popover: 'oklch(1 0 0)',
  'popover-foreground': 'oklch(0.145 0 0)',
  primary: 'oklch(0.205 0 0)',
  'primary-foreground': 'oklch(0.985 0 0)',
  secondary: 'oklch(0.97 0 0)',
  'secondary-foreground': 'oklch(0.205 0 0)',
  muted: 'oklch(0.97 0 0)',
  'muted-foreground': 'oklch(0.556 0 0)',
  accent: 'oklch(0.97 0 0)',
  'accent-foreground': 'oklch(0.205 0 0)',
  destructive: 'oklch(0.577 0.245 27.325)',
  'destructive-foreground': 'oklch(0.985 0 0)',
  border: 'oklch(0.922 0 0)',
  input: 'oklch(0.922 0 0)',
  ring: 'oklch(0.708 0 0)',
  'chart-1': 'oklch(0.646 0.222 41.116)',
  'chart-2': 'oklch(0.6 0.118 184.704)',
  'chart-3': 'oklch(0.398 0.07 227.392)',
  'chart-4': 'oklch(0.828 0.189 84.429)',
  'chart-5': 'oklch(0.769 0.188 70.08)',
};

export const DEFAULT_DARK = {
  background: 'oklch(0.145 0 0)',
  foreground: 'oklch(0.985 0 0)',
  card: 'oklch(0.205 0 0)',
  'card-foreground': 'oklch(0.985 0 0)',
  popover: 'oklch(0.205 0 0)',
  'popover-foreground': 'oklch(0.985 0 0)',
  primary: 'oklch(0.922 0 0)',
  'primary-foreground': 'oklch(0.205 0 0)',
  secondary: 'oklch(0.269 0 0)',
  'secondary-foreground': 'oklch(0.985 0 0)',
  muted: 'oklch(0.269 0 0)',
  'muted-foreground': 'oklch(0.708 0 0)',
  accent: 'oklch(0.269 0 0)',
  'accent-foreground': 'oklch(0.985 0 0)',
  destructive: 'oklch(0.704 0.191 22.216)',
  'destructive-foreground': 'oklch(0.985 0 0)',
  border: 'oklch(1 0 0 / 10%)',
  input: 'oklch(1 0 0 / 15%)',
  ring: 'oklch(0.556 0 0)',
  'chart-1': 'oklch(0.488 0.243 264.376)',
  'chart-2': 'oklch(0.696 0.17 162.48)',
  'chart-3': 'oklch(0.769 0.188 70.08)',
  'chart-4': 'oklch(0.627 0.265 303.9)',
  'chart-5': 'oklch(0.645 0.246 16.439)',
};

// Curated, offline font stacks. Each references commonly-installed faces and
// falls back to a generic family, so nothing is fetched over the network.
export const FONTS = [
  { id: 'system', label: 'System default', stack: '' },
  { id: 'inter', label: 'Inter', stack: '"Inter", ui-sans-serif, system-ui, sans-serif' },
  { id: 'humanist', label: 'Humanist', stack: '"Segoe UI", Tahoma, Verdana, sans-serif' },
  { id: 'grotesque', label: 'Grotesque', stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { id: 'rounded', label: 'Rounded', stack: 'ui-rounded, "SF Pro Rounded", "Varela Round", system-ui, sans-serif' },
  { id: 'serif', label: 'Serif', stack: 'Georgia, "Times New Roman", Times, serif' },
  { id: 'slab', label: 'Slab serif', stack: '"Rockwell", "Roboto Slab", Georgia, serif' },
  { id: 'mono', label: 'Monospace', stack: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
];

export function fontStack(id) {
  return (FONTS.find((f) => f.id === id) || FONTS[0]).stack;
}

// macOS-style "Larger Text ←→ More Space" scale steps (left = larger UI).
export const SCALE_STEPS = [1.15, 1.075, 1, 0.925, 0.85];
export const DEFAULT_SCALE = 1;

export const DEFAULT_SETTINGS = {
  themeFollowSystem: false,
  scale: DEFAULT_SCALE,
  font: 'system',
  // When true, the desktop dock hides itself and slides up only when the pointer
  // reaches the bottom edge — giving widgets the full canvas height.
  collapsibleDock: false,
  // When true, the header auto-hides on the Workspace and slides down only when
  // the pointer reaches the top edge — reclaiming its height for the canvas.
  collapsibleHeader: false,
  colors: { light: {}, dark: {} },
};
