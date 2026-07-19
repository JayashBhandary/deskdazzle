import React, { useEffect, useState } from 'react';
import { oklchToHex, hexToOklch, parseOklch } from '@/lib/settings/color';

const HEX6 = /^#?[0-9a-fA-F]{6}$/;

// One editable colour token: a hex text field + a native colour swatch. Values
// are stored as oklch, so we convert on the way in/out and preserve any alpha.
export default function ColorRow({ token, value, onChange }) {
  const hex = oklchToHex(value);
  const alpha = parseOklch(value)?.alpha ?? 1;
  const [text, setText] = useState(hex);

  useEffect(() => { setText(hex); }, [hex]);

  const commit = (raw) => {
    const v = raw.startsWith('#') ? raw : `#${raw}`;
    onChange(hexToOklch(v, alpha));
  };

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="min-w-0 flex-1 truncate text-sm">{token.label}</span>
      <input
        type="text"
        value={text}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          if (HEX6.test(e.target.value)) commit(e.target.value);
        }}
        onBlur={() => setText(hex)}
        className="w-[74px] rounded-md border border-input bg-transparent px-2 py-1 font-mono text-xs uppercase outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      <label
        className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border"
        style={{ background: hex }}
        title="Pick colour"
      >
        <input
          type="color"
          value={hex}
          onChange={(e) => commit(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
