import { describe, expect, it } from 'vitest';
import {
  clientEvaluateSchema,
  createFlagSchema,
  createSdkKeySchema,
  keySchema,
  serveSchema,
  updateFlagConfigSchema,
  variationRefsAreValid,
} from './schemas.js';

describe('keySchema', () => {
  it.each(['new-checkout', 'a', 'v2.checkout_flow'])('accepts %j', (key) => {
    expect(keySchema.safeParse(key).success).toBe(true);
  });

  it.each(['', 'New-Checkout', '-leading', 'has space', 'x'.repeat(65)])('rejects %j', (key) => {
    expect(keySchema.safeParse(key).success).toBe(false);
  });
});

describe('createFlagSchema', () => {
  it('defaults to a boolean flag without variations', () => {
    expect(createFlagSchema.parse({ key: 'f', name: 'F' })).toEqual({
      key: 'f',
      name: 'F',
      kind: 'boolean',
    });
  });

  it('requires variations for non-boolean flags', () => {
    expect(createFlagSchema.safeParse({ key: 'f', name: 'F', kind: 'string' }).success).toBe(false);
  });

  it('rejects variations that do not match the kind', () => {
    const result = createFlagSchema.safeParse({
      key: 'f',
      name: 'F',
      kind: 'number',
      variations: [{ value: 1 }, { value: 'two' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts any JSON for json flags', () => {
    const result = createFlagSchema.safeParse({
      key: 'f',
      name: 'F',
      kind: 'json',
      variations: [{ value: { a: 1 } }, { value: [1, 2] }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown fields', () => {
    expect(createFlagSchema.safeParse({ key: 'f', name: 'F', extra: 1 }).success).toBe(false);
  });
});

describe('serveSchema', () => {
  it('requires rollout weights to add up to 100%', () => {
    const rollout = (a: number, b: number) => ({
      rollout: [
        { variation: 0, weight: a },
        { variation: 1, weight: b },
      ],
    });
    expect(serveSchema.safeParse(rollout(25_000, 75_000)).success).toBe(true);
    expect(serveSchema.safeParse(rollout(25_000, 70_000)).success).toBe(false);
  });
});

describe('updateFlagConfigSchema', () => {
  it('accepts a rule with attribute and segment clauses', () => {
    const result = updateFlagConfigSchema.safeParse({
      enabled: true,
      rules: [
        {
          id: 'r1',
          clauses: [
            { attribute: 'country', operator: 'in', values: ['PK'] },
            { operator: 'segmentMatch', values: ['beta'] },
          ],
          serve: { variation: 0 },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects rules without clauses', () => {
    const result = updateFlagConfigSchema.safeParse({
      rules: [{ id: 'r1', clauses: [], serve: { variation: 0 } }],
    });
    expect(result.success).toBe(false);
  });
});

describe('variationRefsAreValid', () => {
  const config = {
    offVariation: 1,
    targets: [{ variation: 0 }],
    rules: [{ serve: { variation: 0 } }],
    fallthrough: {
      rollout: [
        { variation: 0, weight: 50_000 },
        { variation: 2, weight: 50_000 },
      ],
    },
  };

  it('passes when every index exists', () => {
    expect(variationRefsAreValid(config, 3)).toBe(true);
  });

  it('fails when an index is out of range', () => {
    expect(variationRefsAreValid(config, 2)).toBe(false);
  });
});

describe('createSdkKeySchema', () => {
  it('defaults to a server key', () => {
    expect(createSdkKeySchema.parse({ name: 'Backend' }).kind).toBe('server');
  });

  it('accepts client keys and rejects unknown kinds', () => {
    expect(createSdkKeySchema.parse({ name: 'Web', kind: 'client' }).kind).toBe('client');
    expect(createSdkKeySchema.safeParse({ name: 'Web', kind: 'mobile' }).success).toBe(false);
  });
});

describe('clientEvaluateSchema', () => {
  it('accepts a context with attributes', () => {
    const context = { key: 'user-1', country: 'PK', age: 30, beta: true, tags: ['a', 'b'] };
    expect(clientEvaluateSchema.parse({ context }).context).toEqual(context);
  });

  it('requires a key', () => {
    expect(clientEvaluateSchema.safeParse({ context: { country: 'PK' } }).success).toBe(false);
    expect(clientEvaluateSchema.safeParse({ context: { key: '' } }).success).toBe(false);
  });

  it('rejects nested objects and oversized contexts', () => {
    const nested = { key: 'u', address: { city: 'Lahore' } };
    expect(clientEvaluateSchema.safeParse({ context: nested }).success).toBe(false);
    const huge = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`a${i}`, i]));
    expect(clientEvaluateSchema.safeParse({ context: { key: 'u', ...huge } }).success).toBe(false);
  });
});
