import React from 'react';

// Live preview of the palette currently being edited. oklch strings are valid
// CSS colours, so we can feed the token values straight into inline styles —
// this shows the edited theme regardless of which theme the app is displaying.
export default function ThemePreview({ resolve }) {
  const c = resolve;
  return (
    <div
      className="rounded-lg border p-3"
      style={{ background: c('background'), color: c('foreground'), borderColor: c('border') }}
    >
      <div className="mb-2 text-xs font-semibold opacity-70">Preview</div>
      <div
        className="rounded-md p-2.5"
        style={{ background: c('card'), color: c('card-foreground'), border: `1px solid ${c('border')}` }}
      >
        <div className="text-sm font-semibold">Card title</div>
        <div className="text-xs" style={{ color: c('muted-foreground') }}>
          Muted description text
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="rounded px-2 py-1 text-xs font-medium" style={{ background: c('primary'), color: c('primary-foreground') }}>
            Primary
          </span>
          <span className="rounded px-2 py-1 text-xs font-medium" style={{ background: c('secondary'), color: c('secondary-foreground') }}>
            Secondary
          </span>
          <span className="rounded px-2 py-1 text-xs font-medium" style={{ background: c('destructive'), color: c('destructive-foreground') }}>
            Delete
          </span>
        </div>
      </div>
    </div>
  );
}
