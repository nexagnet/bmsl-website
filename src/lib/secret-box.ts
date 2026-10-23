import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

// Field-level encryption for the one secret an ADMIN may type into the CMS (the SMTP password). AES-256-GCM with a key
// derived from server-side key material (LEAD_SMTP_ENCRYPTION_KEY, else PAYLOAD_SECRET). The stored text is
// `v1.<iv>.<tag>.<ciphertext>` (base64url); it is never returned over the API, the admin UI or a log.

const VERSION = 'v1';
const SALT = 'bmsl-lead-smtp-secret-v1';
const keys = new Map<string, Buffer>();

const keyFor = (material: string): Buffer => {
  if (!material) throw new Error('secret_box_key_missing');
  let key = keys.get(material);
  if (!key) {
    key = scryptSync(material, SALT, 32);
    keys.set(material, key);
  }
  return key;
};

export function encryptSecret(plain: string, material: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(material), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

/** Throws (message carries no value) when the text is malformed or the key differs from the one that encrypted it. */
export function decryptSecret(stored: string, material: string): string {
  const [version, iv, tag, body] = stored.split('.');
  if (version !== VERSION || !iv || !tag || !body) throw new Error('secret_box_malformed');
  const decipher = createDecipheriv('aes-256-gcm', keyFor(material), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
}
