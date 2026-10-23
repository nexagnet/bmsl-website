import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './secret-box';

describe('secret-box', () => {
  const plain = ['synthetic', 'box', 'value'].join('-');

  it('round-trips and never stores the plain text; each encryption differs', () => {
    const a = encryptSecret(plain, 'key-material-1');
    expect(a).toMatch(/^v1\./);
    expect(a).not.toContain(plain);
    expect(a).not.toBe(encryptSecret(plain, 'key-material-1'));
    expect(decryptSecret(a, 'key-material-1')).toBe(plain);
  });

  it('rejects another key, a tampered value, malformed text and a missing key', () => {
    const a = encryptSecret(plain, 'key-material-1');
    expect(() => decryptSecret(a, 'key-material-2')).toThrow();
    expect(() => decryptSecret(`${a.slice(0, -2)}AA`, 'key-material-1')).toThrow();
    expect(() => decryptSecret('not-encrypted', 'key-material-1')).toThrow('secret_box_malformed');
    expect(() => encryptSecret(plain, '')).toThrow('secret_box_key_missing');
  });
});
