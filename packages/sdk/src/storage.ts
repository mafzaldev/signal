import type { Ruleset } from '@feature-flags/core';

/**
 * Where the SDK keeps its last known flags so it can start without the API.
 * `get` returns what `set` last stored, or null.
 */
export interface FlagStorage {
  get(): Promise<string | null> | string | null;
  set(value: string): Promise<void> | void;
}

const FORMAT = 1;
/** Enough of the key to tell keys apart without storing the secret. */
const KEY_PREFIX_LENGTH = 12;

interface CachedFlags {
  format: number;
  keyPrefix: string;
  savedAt: string;
  ruleset: Ruleset;
}

export function serializeCache(sdkKey: string, ruleset: Ruleset): string {
  const cached: CachedFlags = {
    format: FORMAT,
    keyPrefix: sdkKey.slice(0, KEY_PREFIX_LENGTH),
    savedAt: new Date().toISOString(),
    ruleset,
  };
  return JSON.stringify(cached);
}

/** The cached ruleset, or null if it's missing, unreadable or saved for another key. */
export function parseCache(sdkKey: string, raw: string | null): Ruleset | null {
  if (!raw) return null;
  try {
    const cached = JSON.parse(raw) as Partial<CachedFlags>;
    if (cached.format !== FORMAT || cached.keyPrefix !== sdkKey.slice(0, KEY_PREFIX_LENGTH)) {
      return null;
    }
    return cached.ruleset ?? null;
  } catch {
    return null;
  }
}
