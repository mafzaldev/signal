import { getBucket } from './hash.js';
import { matchesClause, type Segments } from './match.js';
import type {
  Context,
  EvaluationReason,
  EvaluationResult,
  Flag,
  Serve,
  WeightedVariation,
} from './types.js';

function serveVariation(
  flag: Flag,
  index: number | undefined,
  reason: EvaluationReason,
): EvaluationResult {
  const variation = index === undefined ? undefined : flag.variations[index];
  if (index === undefined || variation === undefined) {
    return {
      value: null,
      variationIndex: null,
      reason: { kind: 'ERROR', errorKind: 'MALFORMED_FLAG' },
    };
  }
  return { value: variation.value, variationIndex: index, reason };
}

function pickRolloutVariation(
  flag: Flag,
  rollout: WeightedVariation[],
  contextKey: string,
): number | undefined {
  const bucket = getBucket(flag.key, flag.salt, contextKey);
  let cumulative = 0;
  for (const { variation, weight } of rollout) {
    cumulative += weight;
    if (bucket < cumulative) return variation;
  }
  // Weights summing to less than 100% leave the remaining buckets in the last variation.
  return rollout.at(-1)?.variation;
}

function serve(
  flag: Flag,
  serve: Serve,
  context: Context,
  reason: EvaluationReason,
): EvaluationResult {
  const index =
    'variation' in serve ? serve.variation : pickRolloutVariation(flag, serve.rollout, context.key);
  return serveVariation(flag, index, reason);
}

/**
 * Decides which variation a context gets. Checks run in order and the first
 * one that applies wins: flag off, individual targets, rules, then the
 * fallthrough (default) rule.
 */
export function evaluate(flag: Flag, context: Context, segments: Segments = {}): EvaluationResult {
  if (!flag.enabled) return serveVariation(flag, flag.offVariation, { kind: 'OFF' });

  for (const target of flag.targets) {
    if (target.values.includes(context.key)) {
      return serveVariation(flag, target.variation, { kind: 'TARGET_MATCH' });
    }
  }

  for (const [ruleIndex, rule] of flag.rules.entries()) {
    if (rule.clauses.every((clause) => matchesClause(clause, context, segments))) {
      return serve(flag, rule.serve, context, { kind: 'RULE_MATCH', ruleIndex, ruleId: rule.id });
    }
  }

  return serve(flag, flag.fallthrough, context, { kind: 'FALLTHROUGH' });
}
