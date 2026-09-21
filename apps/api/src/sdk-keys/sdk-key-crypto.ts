import { createHash, randomBytes } from 'node:crypto';

const PREFIX_LENGTH = 12;

/** Keys are 32 random bytes, so a plain SHA-256 is enough to store them safely. */
export function hashSdkKey(key: string) {
  return createHash('sha256').update(key).digest('hex');
}

export function generateSdkKey() {
  const key = `sdk-${randomBytes(32).toString('base64url')}`;
  return { key, keyHash: hashSdkKey(key), keyPrefix: key.slice(0, PREFIX_LENGTH) };
}
