import { describe, expect, it } from 'vitest';
import { evaluate } from './evaluate.js';
import type { Flag, Segment, Serve } from './types.js';

const ON = 0;
const OFF = 1;

function boolFlag(overrides: Partial<Flag> = {}): Flag {
  return {
    key: 'new-checkout',
    version: 1,
    salt: 'salt',
    enabled: true,
    variations: [{ value: true }, { value: false }],
    offVariation: OFF,
    targets: [],
    rules: [],
    fallthrough: { variation: OFF },
    ...overrides,
  };
}

/** Serves `true` to `percent`% of contexts. */
function percentOn(percent: number): Serve {
  const weight = percent * 1000;
  return {
    rollout: [
      { variation: ON, weight },
      { variation: OFF, weight: 100_000 - weight },
    ],
  };
}

function users(count: number) {
  return Array.from({ length: count }, (_, i) => ({ key: `user-${i}` }));
}

describe('evaluate', () => {
  describe('order of checks', () => {
    it('serves the off variation when the flag is off, ignoring targets', () => {
      const flag = boolFlag({ enabled: false, targets: [{ variation: ON, values: ['user-1'] }] });
      expect(evaluate(flag, { key: 'user-1' })).toEqual({
        value: false,
        variationIndex: OFF,
        reason: { kind: 'OFF' },
      });
    });

    it('serves individual targets before rules', () => {
      const flag = boolFlag({
        targets: [{ variation: ON, values: ['user-1'] }],
        rules: [{ id: 'r1', clauses: [], serve: { variation: OFF } }],
      });
      expect(evaluate(flag, { key: 'user-1' })).toEqual({
        value: true,
        variationIndex: ON,
        reason: { kind: 'TARGET_MATCH' },
      });
    });

    it('uses the first matching rule', () => {
      const flag = boolFlag({
        rules: [
          {
            id: 'enterprise',
            clauses: [{ attribute: 'plan', operator: 'in', values: ['enterprise'] }],
            serve: { variation: OFF },
          },
          {
            id: 'pakistan',
            clauses: [{ attribute: 'country', operator: 'in', values: ['PK'] }],
            serve: { variation: ON },
          },
        ],
        fallthrough: { variation: ON },
      });

      expect(evaluate(flag, { key: 'u', plan: 'enterprise', country: 'PK' })).toEqual({
        value: false,
        variationIndex: OFF,
        reason: { kind: 'RULE_MATCH', ruleIndex: 0, ruleId: 'enterprise' },
      });
      expect(evaluate(flag, { key: 'u', plan: 'free', country: 'PK' }).reason).toEqual({
        kind: 'RULE_MATCH',
        ruleIndex: 1,
        ruleId: 'pakistan',
      });
    });

    it('requires every clause of a rule to match', () => {
      const flag = boolFlag({
        rules: [
          {
            id: 'r1',
            clauses: [
              { attribute: 'country', operator: 'in', values: ['PK'] },
              { attribute: 'plan', operator: 'in', values: ['pro'] },
            ],
            serve: { variation: ON },
          },
        ],
      });
      expect(evaluate(flag, { key: 'u', country: 'PK', plan: 'free' }).reason.kind).toBe(
        'FALLTHROUGH',
      );
    });

    it('falls through when nothing matches', () => {
      expect(evaluate(boolFlag(), { key: 'u' })).toEqual({
        value: false,
        variationIndex: OFF,
        reason: { kind: 'FALLTHROUGH' },
      });
    });
  });

  it('matches rules against segments', () => {
    const segments: Record<string, Segment> = {
      beta: { key: 'beta', version: 1, included: ['user-7'], excluded: [], rules: [] },
    };
    const flag = boolFlag({
      rules: [
        {
          id: 'r1',
          clauses: [{ operator: 'segmentMatch', values: ['beta'] }],
          serve: { variation: ON },
        },
      ],
    });
    expect(evaluate(flag, { key: 'user-7' }, segments).value).toBe(true);
    expect(evaluate(flag, { key: 'user-8' }, segments).value).toBe(false);
  });

  it('serves non-boolean variations', () => {
    const flag = boolFlag({
      variations: [{ value: 'blue' }, { value: 'green' }, { value: { theme: 'dark' } }],
      fallthrough: { variation: 2 },
    });
    expect(evaluate(flag, { key: 'u' }).value).toEqual({ theme: 'dark' });
  });

  describe('malformed flags', () => {
    it.each<[string, Partial<Flag>]>([
      ['off variation out of range', { enabled: false, offVariation: 5 }],
      ['fallthrough variation out of range', { fallthrough: { variation: -1 } }],
      ['empty rollout', { fallthrough: { rollout: [] } }],
    ])('returns an error result for %s', (_, overrides) => {
      expect(evaluate(boolFlag(overrides), { key: 'u' })).toEqual({
        value: null,
        variationIndex: null,
        reason: { kind: 'ERROR', errorKind: 'MALFORMED_FLAG' },
      });
    });
  });

  describe('percentage rollout', () => {
    function shareOn(flag: Flag, contexts = users(10_000)) {
      const on = contexts.filter((c) => evaluate(flag, c).value === true).length;
      return on / contexts.length;
    }

    it('gives the same answer for the same context every time', () => {
      const flag = boolFlag({ fallthrough: percentOn(50) });
      const first = users(100).map((c) => evaluate(flag, c).value);
      const second = users(100).map((c) => evaluate(flag, c).value);
      expect(second).toEqual(first);
    });

    it.each([0, 10, 25, 50, 100])('serves roughly %i% of contexts', (percent) => {
      const share = shareOn(boolFlag({ fallthrough: percentOn(percent) }));
      expect(share).toBeGreaterThanOrEqual(percent / 100 - 0.01);
      expect(share).toBeLessThanOrEqual(percent / 100 + 0.01);
    });

    it('keeps contexts in the rollout as the percentage grows', () => {
      const at20 = boolFlag({ fallthrough: percentOn(20) });
      const at30 = boolFlag({ fallthrough: percentOn(30) });
      const lostAccess = users(10_000).filter(
        (c) => evaluate(at20, c).value === true && evaluate(at30, c).value !== true,
      );
      expect(lostAccess).toHaveLength(0);
    });

    it('buckets contexts independently per flag', () => {
      const a = boolFlag({ key: 'flag-a', fallthrough: percentOn(50) });
      const b = boolFlag({ key: 'flag-b', fallthrough: percentOn(50) });
      const inBoth = users(10_000).filter(
        (c) => evaluate(a, c).value === true && evaluate(b, c).value === true,
      ).length;
      // Independent 50% rollouts overlap on about 25% of contexts.
      expect(inBoth / 10_000).toBeGreaterThan(0.23);
      expect(inBoth / 10_000).toBeLessThan(0.27);
    });

    it('puts leftover buckets in the last variation when weights sum below 100%', () => {
      const flag = boolFlag({
        fallthrough: {
          rollout: [
            { variation: OFF, weight: 0 },
            { variation: ON, weight: 0 },
          ],
        },
      });
      expect(shareOn(flag, users(100))).toBe(1);
    });

    it('applies rollouts inside rules', () => {
      const flag = boolFlag({
        rules: [
          {
            id: 'pk',
            clauses: [{ attribute: 'country', operator: 'in', values: ['PK'] }],
            serve: percentOn(25),
          },
        ],
      });
      const pkUsers = users(10_000).map((c) => ({ ...c, country: 'PK' }));
      const share = shareOn(flag, pkUsers);
      expect(share).toBeGreaterThanOrEqual(0.24);
      expect(share).toBeLessThanOrEqual(0.26);
    });
  });
});
