// Cryptographically secure password generation. Uses the CSPRNG
// (crypto.getRandomValues), never Math.random — these are secrets.

export const CHAR_CLASSES = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: "~*$%@#^&!?*'-=/,.{}()[]<>",
};

export const MAX_LENGTH = 80;

// Secure integer in [0, maxExclusive) via rejection sampling — no modulo bias.
export function secureInt(maxExclusive) {
  if (maxExclusive <= 1) return 0;
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  let x;
  do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
  return x % maxExclusive;
}

// Returns { password } on success, or { error } describing why not.
export function generatePassword({ length, lowercase, uppercase, numbers, symbols }) {
  const pools = [];
  if (lowercase) pools.push(CHAR_CLASSES.lowercase);
  if (uppercase) pools.push(CHAR_CLASSES.uppercase);
  if (numbers) pools.push(CHAR_CLASSES.numbers);
  if (symbols) pools.push(CHAR_CLASSES.symbols);

  const len = Number(length);
  if (pools.length === 0) return { error: 'At least one character type must be selected' };
  if (!Number.isFinite(len) || len <= 0) return { error: 'Invalid password length' };
  if (len > MAX_LENGTH) return { error: `Password length cannot exceed ${MAX_LENGTH} characters` };
  if (len < pools.length) return { error: `Length must be at least ${pools.length} for the selected types` };

  const all = pools.join('');
  const chars = [];
  // Guarantee at least one character from every selected class...
  for (const pool of pools) chars.push(pool[secureInt(pool.length)]);
  // ...then fill the remainder from the combined alphabet.
  for (let i = chars.length; i < len; i++) chars.push(all[secureInt(all.length)]);
  // Secure Fisher–Yates shuffle so the guaranteed chars aren't front-loaded.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureInt(i + 1);
    const tmp = chars[i]; chars[i] = chars[j]; chars[j] = tmp;
  }
  return { password: chars.join('') };
}
