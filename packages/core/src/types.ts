export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type FlagValue = JsonValue;

export type AttributeValue = string | number | boolean;

/** The user (or other entity) a flag is evaluated for. */
export interface Context {
  key: string;
  [attribute: string]: AttributeValue | AttributeValue[] | undefined;
}

export interface Variation {
  value: FlagValue;
  name?: string;
}

/** Weights are in thousandths of a percent: 100_000 = 100%. */
export interface WeightedVariation {
  variation: number;
  weight: number;
}

export type Serve = { variation: number } | { rollout: WeightedVariation[] };

export type AttributeOperator =
  | 'in'
  | 'startsWith'
  | 'endsWith'
  | 'contains'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual';

export interface AttributeClause {
  attribute: string;
  operator: AttributeOperator;
  values: AttributeValue[];
  negate?: boolean;
}

export interface SegmentClause {
  operator: 'segmentMatch';
  /** Segment keys; the clause matches if the context is in any of them. */
  values: string[];
  negate?: boolean;
}

export type Clause = AttributeClause | SegmentClause;

/** Matches when every clause matches. */
export interface Rule {
  id: string;
  clauses: Clause[];
  serve: Serve;
}

export interface Target {
  variation: number;
  /** Context keys that always get this variation. */
  values: string[];
}

/** A flag as configured for one environment: everything needed to evaluate it. */
export interface Flag {
  key: string;
  version: number;
  /** Random per flag; changing it reshuffles rollout buckets. */
  salt: string;
  enabled: boolean;
  variations: Variation[];
  offVariation: number;
  targets: Target[];
  rules: Rule[];
  fallthrough: Serve;
}

/** Segment rules can't reference other segments, so they only hold attribute clauses. */
export interface SegmentRule {
  clauses: AttributeClause[];
}

export interface Segment {
  key: string;
  version: number;
  included: string[];
  excluded: string[];
  rules: SegmentRule[];
}

export type EvaluationReason =
  | { kind: 'OFF' }
  | { kind: 'TARGET_MATCH' }
  | { kind: 'RULE_MATCH'; ruleIndex: number; ruleId: string }
  | { kind: 'FALLTHROUGH' }
  | { kind: 'ERROR'; errorKind: 'MALFORMED_FLAG' };

export interface EvaluationResult {
  value: FlagValue | null;
  variationIndex: number | null;
  reason: EvaluationReason;
}
