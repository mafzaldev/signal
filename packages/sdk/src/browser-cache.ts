import type { ClientEvaluation } from '@signal/core';

/** Where the browser client keeps its last values: `localStorage` or anything shaped like it. */
export interface ValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const FORMAT = 1;
/** Enough of the client key to keep environments apart. */
const KEY_PREFIX_LENGTH = 12;

interface CachedValues {
  format: number;
  /** Whose values these are. Values are only ever served back to the same context key. */
  contextKey: string;
  savedAt: string;
  flags: ClientEvaluation['flags'];
}

/** One entry per client key, holding the last context's values. */
export const cacheKey = (clientKey: string) => `signal:${clientKey.slice(0, KEY_PREFIX_LENGTH)}`;

/** `localStorage` where the page may use it; reading it throws in some sandboxed frames. */
export function defaultStorage(): ValueStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The saved values for `contextKey`, or null if there are none, they're unreadable or another context's. */
export function readCache(
  storage: ValueStorage,
  clientKey: string,
  contextKey: string,
): ClientEvaluation['flags'] | null {
  try {
    const raw = storage.getItem(cacheKey(clientKey));
    if (!raw) return null;
    const cached = JSON.parse(raw) as Partial<CachedValues>;
    if (cached.format !== FORMAT || cached.contextKey !== contextKey || !cached.flags) return null;
    return cached.flags;
  } catch {
    return null;
  }
}

/** Saves the values; a full or blocked storage is ignored, since the cache is only a fallback. */
export function writeCache(
  storage: ValueStorage,
  clientKey: string,
  contextKey: string,
  flags: ClientEvaluation['flags'],
) {
  const cached: CachedValues = {
    format: FORMAT,
    contextKey,
    savedAt: new Date().toISOString(),
    flags,
  };
  try {
    storage.setItem(cacheKey(clientKey), JSON.stringify(cached));
  } catch {
    // Quota exceeded or storage disabled: carry on without a cache.
  }
}
