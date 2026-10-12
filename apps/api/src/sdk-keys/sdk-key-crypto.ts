import type { SdkKeyKind } from '@signal/core/schemas';
import { createHash, randomBytes } from 'node:crypto';

const PREFIX_LENGTH = 12;

/** Keys are 32 random bytes, so a plain SHA-256 is enough to store them safely. */
export function hashSdkKey(key: string) {
  return createHash('sha256').update(key).digest('hex');
}

/** Server keys start with `sdk-` and client keys with `client-`, so they're easy to tell apart. */
export function generateSdkKey(kind: SdkKeyKind) {
  const key = `${kind === 'server' ? 'sdk' : 'client'}-${randomBytes(32).toString('base64url')}`;
  return { key, keyHash: hashSdkKey(key), keyPrefix: key.slice(0, PREFIX_LENGTH) };
}
