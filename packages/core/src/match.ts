import type {
  AttributeClause,
  AttributeOperator,
  AttributeValue,
  Clause,
  Context,
  Segment,
} from './types.js';

export type Segments = Readonly<Record<string, Segment>>;

function compare(operator: AttributeOperator, actual: AttributeValue, expected: AttributeValue) {
  switch (operator) {
    case 'in':
      return actual === expected;
    case 'startsWith':
      return (
        typeof actual === 'string' && typeof expected === 'string' && actual.startsWith(expected)
      );
    case 'endsWith':
      return (
        typeof actual === 'string' && typeof expected === 'string' && actual.endsWith(expected)
      );
    case 'contains':
      return (
        typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected)
      );
    case 'lessThan':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case 'lessThanOrEqual':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    case 'greaterThan':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case 'greaterThanOrEqual':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    default:
      return false;
  }
}

/**
 * Matches if any context value matches any clause value. A missing attribute
 * never matches, even when the clause is negated.
 */
export function matchesAttributeClause(clause: AttributeClause, context: Context): boolean {
  const actual = context[clause.attribute];
  if (actual === undefined) return false;

  const actuals = Array.isArray(actual) ? actual : [actual];
  const matched = actuals.some((a) => clause.values.some((v) => compare(clause.operator, a, v)));
  return clause.negate ? !matched : matched;
}

export function matchesSegment(segment: Segment, context: Context): boolean {
  if (segment.included.includes(context.key)) return true;
  if (segment.excluded.includes(context.key)) return false;
  return segment.rules.some((rule) =>
    rule.clauses.every((clause) => matchesAttributeClause(clause, context)),
  );
}

/** Segments referenced by a clause but missing from `segments` never match. */
export function matchesClause(clause: Clause, context: Context, segments: Segments): boolean {
  if (clause.operator !== 'segmentMatch') return matchesAttributeClause(clause, context);

  const matched = clause.values.some((key) => {
    const segment = segments[key];
    return segment !== undefined && matchesSegment(segment, context);
  });
  return clause.negate ? !matched : matched;
}
