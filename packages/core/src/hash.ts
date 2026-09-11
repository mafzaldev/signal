// Available in Node and browsers; declared here so core needs neither the DOM nor Node types.
declare const TextEncoder: new () => { encode(input: string): Uint8Array };

const encoder = new TextEncoder();

const C1 = 0xcc9e2d51;
const C2 = 0x1b873593;

/** Number of rollout buckets; rollout weights use the same scale (100_000 = 100%). */
export const BUCKET_SCALE = 100_000;

function scrambleBlock(k: number): number {
  k = Math.imul(k, C1);
  k = (k << 15) | (k >>> 17);
  return Math.imul(k, C2);
}

/**
 * MurmurHash3 (x86, 32-bit) over the UTF-8 bytes of `input`.
 * Every user's rollout bucket depends on this output, so it must never change.
 */
export function murmur3(input: string, seed = 0): number {
  const bytes = encoder.encode(input);
  const tailStart = bytes.length - (bytes.length % 4);
  let h = seed >>> 0;

  for (let i = 0; i < tailStart; i += 4) {
    const k = bytes[i]! | (bytes[i + 1]! << 8) | (bytes[i + 2]! << 16) | (bytes[i + 3]! << 24);
    h ^= scrambleBlock(k);
    h = (h << 13) | (h >>> 19);
    h = (Math.imul(h, 5) + 0xe6546b64) | 0;
  }

  let tail = 0;
  switch (bytes.length % 4) {
    case 3:
      tail ^= bytes[tailStart + 2]! << 16;
    // falls through
    case 2:
      tail ^= bytes[tailStart + 1]! << 8;
    // falls through
    case 1:
      tail ^= bytes[tailStart]!;
      h ^= scrambleBlock(tail);
  }

  h ^= bytes.length;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Deterministic bucket in [0, BUCKET_SCALE) for a context within one flag. */
export function getBucket(flagKey: string, salt: string, contextKey: string): number {
  return murmur3(`${flagKey}.${salt}.${contextKey}`) % BUCKET_SCALE;
}
