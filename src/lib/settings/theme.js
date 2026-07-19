// The runtime side of the Settings app: turn a settings object into live DOM
// changes (root font-size, font-family, injected colour overrides) and hold the
// maths for auto-generating a dark palette from a light one.

import { parseOklch, formatOklch } from './color';
import {
  TOKEN_IDS, SURFACE_TOKENS, DEFAULT_LIGHT, DEFAULT_DARK, DEFAULT_SETTINGS, fontStack,
} from './tokens';

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

// The effective value of a token = the user's override, else the built-in.
export function resolveColor(settings, mode, token) {
  const base = mode === 'dark' ? DEFAULT_DARK : DEFAULT_LIGHT;
  return settings?.colors?.[mode]?.[token] || base[token];
}

/**
 * Smart perceptual dark theme from a light one: invert lightness around the
 * perceptual midpoint, gently reduce chroma (more so for surfaces), keep hue.
 * `light` is a full map of token → oklch string.
 */
export function generateDarkFromLight(light) {
  const out = {};
  for (const token of Object.keys(light)) {
    const p = parseOklch(light[token]);
    if (!p) { out[token] = light[token]; continue; }
    const newL = clamp(1 - p.l, 0.12, 0.985);
    const damp = SURFACE_TOKENS.has(token) ? 0.9 : 0.95;
    out[token] = formatOklch({ l: newL, c: p.c * damp, h: p.h, alpha: p.alpha });
  }
  return out;
}

// Build a <style> body that overrides only the tokens the user has customised.
export function buildThemeCSS(colors) {
  const block = (obj) => Object.entries(obj || {})
    .filter(([k, v]) => v && TOKEN_IDS.has(k))
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n');
  let css = '';
  const light = block(colors?.light);
  if (light) css += `:root {\n${light}\n}\n`;
  const dark = block(colors?.dark);
  if (dark) css += `.dark {\n${dark}\n}\n`;
  return css;
}

const STYLE_ID = 'deskdazzle-theme';

export function applyThemeCSS(css) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

export function applyScale(scale) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize = `${16 * (scale || 1)}px`;
}

export function applyFont(id) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  const stack = fontStack(id);
  if (stack) {
    el.style.fontFamily = stack;
    el.style.setProperty('--font-sans', stack);
  } else {
    el.style.removeProperty('font-family');
    el.style.removeProperty('--font-sans');
  }
}

// Coerce any stored/imported blob into a well-formed settings object.
export function normalizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    themeFollowSystem: !!s.themeFollowSystem,
    scale: Number(s.scale) > 0 ? Number(s.scale) : DEFAULT_SETTINGS.scale,
    font: typeof s.font === 'string' ? s.font : DEFAULT_SETTINGS.font,
    colors: {
      light: sanitizeColors(s.colors?.light),
      dark: sanitizeColors(s.colors?.dark),
    },
  };
}

function sanitizeColors(obj) {
  const out = {};
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (TOKEN_IDS.has(k) && parseOklch(v)) out[k] = v;
    }
  }
  return out;
}

export const SETTINGS_EXPORT_KIND = 'deskdazzle-theme';

export function exportSettings(settings) {
  return JSON.stringify(
    { kind: SETTINGS_EXPORT_KIND, version: 1, settings: normalizeSettings(settings) },
    null,
    2,
  );
}

export function parseSettingsFile(text) {
  const data = JSON.parse(text);
  // Accept either a wrapped export or a bare settings object.
  const raw = data && data.kind === SETTINGS_EXPORT_KIND ? data.settings : data;
  return normalizeSettings(raw);
}
