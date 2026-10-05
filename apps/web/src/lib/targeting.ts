import {
  BUCKET_SCALE,
  type AttributeOperator,
  type AttributeValue,
  type Rule,
  type Serve,
  type Target,
  type Variation,
} from '@signal/core';
import type { FlagKind } from '@signal/core/schemas';

const PERCENT_SCALE = BUCKET_SCALE / 100;

export const percentToWeight = (percent: number) => Math.round(percent * PERCENT_SCALE);
export const weightToPercent = (weight: number) => weight / PERCENT_SCALE;

export const NUMERIC_OPERATORS: AttributeOperator[] = [
  'lessThan',
  'lessThanOrEqual',
  'greaterThan',
  'greaterThanOrEqual',
];

export const OPERATOR_LABELS: Record<AttributeOperator, string> = {
  in: 'is one of',
  startsWith: 'starts with',
  endsWith: 'ends with',
  contains: 'contains',
  lessThan: '<',
  lessThanOrEqual: '≤',
  greaterThan: '>',
  greaterThanOrEqual: '≥',
};

function splitList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Comma-separated clause values; numeric operators need numbers. */
export function parseClauseValues(
  text: string,
  operator: AttributeOperator,
): { values: AttributeValue[]; error?: string } {
  const parts = splitList(text);
  if (!NUMERIC_OPERATORS.includes(operator)) return { values: parts };
  const numbers = parts.map(Number);
  return numbers.some(Number.isNaN)
    ? { values: [], error: 'Numeric comparisons need numbers' }
    : { values: numbers };
}

/** Context keys separated by commas or new lines. */
export const parseKeyList = splitList;

export function variationLabel(variations: Variation[], index: number): string {
  const variation = variations[index];
  if (!variation) return `#${index} (missing)`;
  return variation.name ?? JSON.stringify(variation.value);
}

export function describeServe(serve: Serve, variations: Variation[]): string {
  if ('variation' in serve) return variationLabel(variations, serve.variation);
  return serve.rollout
    .filter((w) => w.weight > 0)
    .map((w) => `${weightToPercent(w.weight)}% ${variationLabel(variations, w.variation)}`)
    .join(', ');
}

/** One line on what a flag does in an environment, e.g. "2 rules, then 20% true, 80% false". */
export function summarizeConfig(
  config: {
    enabled: boolean;
    offVariation: number;
    targets: Target[];
    rules: Rule[];
    fallthrough: Serve;
  },
  variations: Variation[],
): string {
  if (!config.enabled) return `Serving ${variationLabel(variations, config.offVariation)}`;
  const parts: string[] = [];
  const targeted = config.targets.reduce((sum, t) => sum + t.values.length, 0);
  if (targeted > 0) parts.push(`${targeted} targeted`);
  if (config.rules.length > 0) {
    parts.push(`${config.rules.length} ${config.rules.length === 1 ? 'rule' : 'rules'}`);
  }
  const fallthrough = describeServe(config.fallthrough, variations);
  return parts.length > 0 ? `${parts.join(', ')}, then ${fallthrough}` : `Serving ${fallthrough}`;
}

/** One variation per line. JSON flags take one JSON value per line. */
export function parseVariations(
  kind: FlagKind,
  text: string,
): { variations: Variation[]; error?: string } {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  try {
    const values = lines.map((line) => {
      if (kind === 'string') return line;
      if (kind === 'number') {
        const n = Number(line);
        if (Number.isNaN(n)) throw new Error(`"${line}" is not a number`);
        return n;
      }
      if (kind === 'boolean') {
        if (line !== 'true' && line !== 'false') throw new Error(`"${line}" is not true or false`);
        return line === 'true';
      }
      return JSON.parse(line) as Variation['value'];
    });
    if (values.length < 2) return { variations: [], error: 'Add at least two variations' };
    return { variations: values.map((value) => ({ value })) };
  } catch (error) {
    return { variations: [], error: error instanceof Error ? error.message : 'Invalid JSON' };
  }
}

export function formatVariations(variations: Variation[]): string {
  return variations
    .map((v) => (typeof v.value === 'string' ? v.value : JSON.stringify(v.value)))
    .join('\n');
}

/** Top-level fields whose JSON differs between two audit snapshots. */
export function changedFields(before: unknown, after: unknown): string[] {
  const asRecord = (v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const b = asRecord(before);
  const a = asRecord(after);
  const ignored = new Set([
    'updatedAt',
    'createdAt',
    'version',
    'flagId',
    'environmentId',
    'flagKey',
    'environmentKey',
  ]);
  return [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(
    (key) => !ignored.has(key) && JSON.stringify(b[key]) !== JSON.stringify(a[key]),
  );
}
