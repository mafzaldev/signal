import { describe, expect, it } from 'vitest';
import { matchesAttributeClause, matchesClause, matchesSegment } from './match.js';
import type {
  AttributeClause,
  AttributeOperator,
  AttributeValue,
  Context,
  Segment,
} from './types.js';

const context: Context = {
  key: 'user-1',
  email: 'ali@acme.com',
  country: 'PK',
  age: 30,
  beta: true,
  groups: ['admins', 'staff'],
};

function clause(
  attribute: string,
  operator: AttributeOperator,
  values: AttributeValue[],
  negate = false,
): AttributeClause {
  return { attribute, operator, values, negate };
}

describe('matchesAttributeClause', () => {
  it.each<[string, AttributeClause, boolean]>([
    ['in: matching value', clause('country', 'in', ['AE', 'PK']), true],
    ['in: no matching value', clause('country', 'in', ['AE', 'US']), false],
    ['in: is type-strict', clause('age', 'in', ['30']), false],
    ['in: boolean', clause('beta', 'in', [true]), true],
    ['startsWith', clause('email', 'startsWith', ['ali@']), true],
    ['endsWith', clause('email', 'endsWith', ['@acme.com']), true],
    ['endsWith: no match', clause('email', 'endsWith', ['@other.com']), false],
    ['contains', clause('email', 'contains', ['acme']), true],
    ['string operator on a number', clause('age', 'startsWith', ['3']), false],
    ['lessThan', clause('age', 'lessThan', [31]), true],
    ['lessThan: equal value', clause('age', 'lessThan', [30]), false],
    ['lessThanOrEqual', clause('age', 'lessThanOrEqual', [30]), true],
    ['greaterThan', clause('age', 'greaterThan', [29]), true],
    ['greaterThanOrEqual', clause('age', 'greaterThanOrEqual', [30]), true],
    ['number operator on a string', clause('country', 'greaterThan', [0]), false],
    ['array attribute: any element matches', clause('groups', 'in', ['staff']), true],
    ['array attribute: no element matches', clause('groups', 'in', ['guests']), false],
    ['negate inverts a match', clause('country', 'in', ['PK'], true), false],
    ['negate inverts a non-match', clause('country', 'in', ['US'], true), true],
    ['missing attribute', clause('plan', 'in', ['pro']), false],
    ['missing attribute stays false when negated', clause('plan', 'in', ['pro'], true), false],
  ])('%s', (_, c, expected) => {
    expect(matchesAttributeClause(c, context)).toBe(expected);
  });
});

describe('matchesSegment', () => {
  const segment: Segment = {
    key: 'beta-testers',
    version: 1,
    included: ['user-2'],
    excluded: ['user-1'],
    rules: [{ clauses: [clause('country', 'in', ['PK']), clause('age', 'greaterThan', [18])] }],
  };

  it('includes listed keys', () => {
    expect(matchesSegment(segment, { key: 'user-2' })).toBe(true);
  });

  it('excludes listed keys even when a rule matches', () => {
    expect(matchesSegment(segment, context)).toBe(false);
  });

  it('matches when every clause of a rule matches', () => {
    expect(matchesSegment(segment, { key: 'user-3', country: 'PK', age: 20 })).toBe(true);
  });

  it('does not match when only some clauses match', () => {
    expect(matchesSegment(segment, { key: 'user-3', country: 'PK', age: 10 })).toBe(false);
  });
});

describe('matchesClause with segmentMatch', () => {
  const segments = {
    staff: { key: 'staff', version: 1, included: ['user-1'], excluded: [], rules: [] },
  };

  it('matches a context in any listed segment', () => {
    expect(
      matchesClause({ operator: 'segmentMatch', values: ['other', 'staff'] }, context, segments),
    ).toBe(true);
  });

  it('can be negated', () => {
    expect(
      matchesClause(
        { operator: 'segmentMatch', values: ['staff'], negate: true },
        context,
        segments,
      ),
    ).toBe(false);
  });

  it('treats an unknown segment as no match', () => {
    expect(
      matchesClause({ operator: 'segmentMatch', values: ['missing'] }, context, segments),
    ).toBe(false);
  });
});
