import { describe, it, expect } from 'vitest';
import { encryptText, decryptText } from './textCrypto';

describe('textCrypto', () => {
  it('round-trips text with the correct passphrase', async () => {
    const blob = await encryptText('hello 🌍 secret', 'correct horse battery staple');
    expect(blob.startsWith('DDv1:')).toBe(true);
    const out = await decryptText(blob, 'correct horse battery staple');
    expect(out).toBe('hello 🌍 secret');
  });

  it('produces different ciphertext each time (random salt+iv)', async () => {
    const a = await encryptText('same', 'pw');
    const b = await encryptText('same', 'pw');
    expect(a).not.toBe(b);
  });

  it('fails to decrypt with the wrong passphrase', async () => {
    const blob = await encryptText('top secret', 'right-pass');
    await expect(decryptText(blob, 'wrong-pass')).rejects.toThrow();
  });

  it('fails on tampered ciphertext (AES-GCM auth)', async () => {
    const blob = await encryptText('top secret', 'pw');
    // Flip a character in the base64 body.
    const body = blob.slice(5);
    const tampered = 'DDv1:' + (body[0] === 'A' ? 'B' : 'A') + body.slice(1);
    await expect(decryptText(tampered, 'pw')).rejects.toThrow();
  });

  it('rejects non-Desk-Dazzle blobs', async () => {
    await expect(decryptText('not-a-blob', 'pw')).rejects.toThrow(/Desk Dazzle/);
  });

  it('requires a passphrase for both operations', async () => {
    await expect(encryptText('x', '')).rejects.toThrow(/passphrase/);
    await expect(decryptText('DDv1:xxxx', '')).rejects.toThrow(/passphrase/);
  });
});
