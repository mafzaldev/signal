import { describe, expect, it } from 'vitest';
import {
  changedFields,
  describeServe,
  parseClauseValues,
  parseKeyList,
  parseVariations,
  percentToWeight,
  weightToPercent,
} from './targeting';

describe('percent conversion', () => {
  it('round-trips through rollout weights', () => {
    expect(percentToWeight(25)).toBe(25_000);
    expect(percentToWeight(0.001)).toBe(1);
    expect(weightToPercent(12_345)).toBe(12.345);
  });
});

describe('parseClauseValues', () => {
  it('splits and trims strings', () => {
    expect(parseClauseValues(' PK, AE ,,US', 'in')).toEqual({ values: ['PK', 'AE', 'US'] });
  });

  it('parses numbers for numeric operators', () => {
    expect(parseClauseValues('18, 21.5', 'greaterThan')).toEqual({ values: [18, 21.5] });
  });

  it('rejects non-numbers for numeric operators', () => {
    expect(parseClauseValues('18, abc', 'lessThan').error).toBeDefined();
  });
});

describe('parseKeyList', () => {
  it('accepts commas and new lines', () => {
    expect(parseKeyList('user-1\nuser-2, user-3\n')).toEqual(['user-1', 'user-2', 'user-3']);
  });
});

describe('parseVariations', () => {
  it('reads one string per line', () => {
    expect(parseVariations('string', 'blue\n green \n')).toEqual({
      variations: [{ value: 'blue' }, { value: 'green' }],
    });
  });

  it('reads numbers', () => {
    expect(parseVariations('number', '1\n2.5').variations).toEqual([{ value: 1 }, { value: 2.5 }]);
  });

  it('reads one JSON value per line', () => {
    expect(parseVariations('json', '{"a":1}\n[1,2]').variations).toEqual([
      { value: { a: 1 } },
      { value: [1, 2] },
    ]);
  });

  it.each<[Parameters<typeof parseVariations>[0], string]>([
    ['number', '1\nabc'],
    ['json', '{"a":1}\n{bad'],
    ['string', 'only-one'],
  ])('rejects invalid %s variations', (kind, text) => {
    expect(parseVariations(kind, text).error).toBeDefined();
  });
});

describe('describeServe', () => {
  const variations = [{ value: true }, { value: false }];

  it('names a fixed variation', () => {
    expect(describeServe({ variation: 1 }, variations)).toBe('false');
  });

  it('summarizes a rollout, skipping empty buckets', () => {
    expect(
      describeServe(
        {
          rollout: [
            { variation: 0, weight: 20_000 },
            { variation: 1, weight: 80_000 },
          ],
        },
        variations,
      ),
    ).toBe('20% true, 80% false');
  });
});

describe('changedFields', () => {
  it('lists fields that differ, ignoring timestamps and versions', () => {
    expect(
      changedFields(
        { enabled: false, rules: [], version: 1, updatedAt: 'a' },
        { enabled: true, rules: [], version: 2, updatedAt: 'b' },
      ),
    ).toEqual(['enabled']);
  });
});
