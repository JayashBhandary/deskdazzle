// Authenticated, passphrase-based text encryption for the Vault "Encrypt Text"
// tool. Everything runs on-device via the Web Crypto API (crypto.subtle) — no
// keys are hardcoded and nothing leaves the machine.
//
// Scheme (versioned so the format can evolve):
//   key  = PBKDF2(passphrase, salt, 310k iters, SHA-256) -> AES-GCM 256
//   blob = "DDv1:" + base64( salt[16] | iv[12] | ciphertext+tag )
// AES-GCM is authenticated: a wrong passphrase or any tampering fails the
// decrypt with an exception rather than returning garbage.

const MAGIC = 'DDv1:';
const PBKDF2_ITERS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase, salt, usage) {
  const base = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, usage,
  );
}

// Encrypt `text` with `passphrase`. Returns the versioned base64 blob.
export async function encryptText(text, passphrase) {
  if (!passphrase) throw new Error('A passphrase is required.');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, ['encrypt']);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text)),
  );
  const blob = new Uint8Array(salt.length + iv.length + ct.length);
  blob.set(salt, 0);
  blob.set(iv, salt.length);
  blob.set(ct, salt.length + iv.length);
  return MAGIC + toBase64(blob);
}

// Decrypt a blob produced by encryptText. Throws on wrong passphrase, tampering,
// or malformed input.
export async function decryptText(blob, passphrase) {
  if (!passphrase) throw new Error('A passphrase is required.');
  if (typeof blob !== 'string' || !blob.startsWith(MAGIC)) {
    throw new Error('Not a Desk Dazzle encrypted blob.');
  }
  let raw;
  try {
    raw = fromBase64(blob.slice(MAGIC.length));
  } catch {
    throw new Error('Malformed encrypted data.');
  }
  if (raw.length <= SALT_BYTES + IV_BYTES) throw new Error('Malformed encrypted data.');
  const salt = raw.slice(0, SALT_BYTES);
  const iv = raw.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ct = raw.slice(SALT_BYTES + IV_BYTES);
  const key = await deriveKey(passphrase, salt, ['decrypt']);
  let pt;
  try {
    pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  } catch {
    throw new Error('Wrong passphrase or corrupted data.');
  }
  return dec.decode(pt);
}
