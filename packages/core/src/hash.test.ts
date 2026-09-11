import { describe, expect, it } from 'vitest';
import { BUCKET_SCALE, getBucket, murmur3 } from './hash.js';

describe('murmur3', () => {
  it.each([
    ['', 0, 0],
    ['', 1, 0x514e28b7],
    ['hello', 0, 0x248bfa47],
    ['The quick brown fox jumps over the lazy dog', 0, 0x2e4ff723],
  ])('hashes %j with seed %i to the reference value', (input, seed, expected) => {
    expect(murmur3(input, seed)).toBe(expected);
  });

  it('handles every tail length', () => {
    const hashes = ['a', 'ab', 'abc', 'abcd'].map((s) => murmur3(s));
    expect(new Set(hashes).size).toBe(4);
  });
});

describe('getBucket', () => {
  it('is deterministic', () => {
    expect(getBucket('flag', 'salt', 'user-1')).toBe(getBucket('flag', 'salt', 'user-1'));
  });

  it('stays within range', () => {
    for (let i = 0; i < 1000; i++) {
      const bucket = getBucket('flag', 'salt', `user-${i}`);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(BUCKET_SCALE);
    }
  });

  it('depends on the salt', () => {
    expect(getBucket('flag', 'a', 'user-1')).not.toBe(getBucket('flag', 'b', 'user-1'));
  });
});
