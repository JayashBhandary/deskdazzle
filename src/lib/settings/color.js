// Color conversion between the app's `oklch(...)` theme tokens and the `#rrggbb`
// hex that native <input type="color"> understands. Based on Björn Ottosson's
// OKLab reference matrices. We edit colours as hex in the UI but keep them
// stored as oklch strings so they stay byte-compatible with index.css.

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linearToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

const r3 = (n) => Math.round(n * 1000) / 1000;
const r2 = (n) => Math.round(n * 100) / 100;

// Parse a component that may be a plain number or a percentage (e.g. "50%").
function parseComp(part, scale = 1) {
  if (part == null) return 0;
  const s = String(part).trim();
  if (s.endsWith('%')) return (parseFloat(s) / 100) * scale;
  return parseFloat(s) || 0;
}

/** Parse an `oklch(L C H [/ A])` string → { l, c, h, alpha } (l 0..1, h deg, alpha 0..1). */
export function parseOklch(str) {
  if (typeof str !== 'string') return null;
  const m = str.trim().match(/^oklch\(\s*([^)]+)\)$/i);
  if (!m) return null;
  let body = m[1];
  let alpha = 1;
  const slash = body.split('/');
  if (slash.length === 2) {
    alpha = parseComp(slash[1], 1);
    body = slash[0];
  }
  const parts = body.trim().split(/[\s,]+/).filter(Boolean);
  return {
    l: parseComp(parts[0], 1),
    c: parseComp(parts[1], 1),
    h: parts[2] != null ? parseFloat(parts[2]) || 0 : 0,
    alpha,
  };
}

/** Format { l, c, h, alpha } → an `oklch(...)` string in the same style as index.css. */
export function formatOklch({ l, c, h, alpha = 1 }) {
  const base = `${r3(clamp01(l))} ${r3(Math.max(0, c))} ${r2(((h % 360) + 360) % 360)}`;
  return alpha >= 1 ? `oklch(${base})` : `oklch(${base} / ${r2(alpha * 100)}%)`;
}

function oklchToRgb({ l, c, h }) {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;
  const R = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const G = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const B = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;
  return [clamp01(linearToSrgb(R)), clamp01(linearToSrgb(G)), clamp01(linearToSrgb(B))];
}

function rgbToOklch(r, g, b) {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B;
  const m = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B;
  const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: Math.hypot(a, bb), h };
}

function hexToRgb(hex) {
  let s = String(hex).trim().replace('#', '');
  if (s.length === 3) s = s.split('').map((ch) => ch + ch).join('');
  if (s.length !== 6) return [0, 0, 0];
  const n = parseInt(s, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rgbToHex(r, g, b) {
  const to = (x) => Math.round(clamp01(x) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** oklch string → "#rrggbb" for the colour input. */
export function oklchToHex(str) {
  const p = parseOklch(str);
  if (!p) return '#000000';
  const [r, g, b] = oklchToRgb(p);
  return rgbToHex(r, g, b);
}

/** "#rrggbb" → oklch string, preserving a given alpha. */
export function hexToOklch(hex, alpha = 1) {
  const [r, g, b] = hexToRgb(hex);
  return formatOklch({ ...rgbToOklch(r, g, b), alpha });
}
