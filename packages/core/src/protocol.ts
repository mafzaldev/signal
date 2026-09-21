import type { Flag, Segment } from './types.js';

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
