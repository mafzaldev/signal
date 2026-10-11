import type { EvaluationReason, Flag, FlagValue, Segment } from './types.js';

/** Everything an SDK needs to evaluate flags locally for one environment. */
export interface Ruleset {
  flags: Record<string, Flag>;
  segments: Record<string, Segment>;
}

/**
 * Events on `GET /sdk/stream`, sent as SSE `event: <type>` with JSON `data`.
 * `put` replaces the whole ruleset (always first on connect); `patch` and
 * `delete` change one flag and carry its version, so out-of-date events can
 * be ignored.
 */
export type StreamEvent =
  | { type: 'put'; data: Ruleset }
  | { type: 'patch'; data: { flag: Flag } }
  | { type: 'delete'; data: { key: string; version: number } };

/** One flag's result for one context, as `POST /sdk/client/evaluate` returns it. */
export interface ClientFlagResult {
  value: FlagValue;
  variationIndex: number | null;
  reason: EvaluationReason;
}

/**
 * The response to `POST /sdk/client/evaluate`: every client-side flag evaluated for the
 * context in the request body. Only results are sent, never the rules behind them.
 */
export interface ClientEvaluation {
  flags: Record<string, ClientFlagResult>;
}

/**
 * Events on `GET /sdk/client/stream`. `change` carries no flag data: it tells the browser
 * to evaluate again, so rules never reach it.
 */
export type ClientStreamEvent = { type: 'change' };
