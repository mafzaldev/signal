import type { Variation } from '@feature-flags/core';
import type { FlagKind } from '@feature-flags/core/schemas';

export const BOOLEAN_VARIATIONS: Variation[] = [{ value: true }, { value: false }];

/**
 * Starting config for a flag in a new environment: switched off. Boolean flags
 * serve `false` when off and `true` when switched on; other kinds serve the
 * first variation until targeting is set up.
 */
export function defaultFlagConfig(kind: FlagKind) {
  return {
    enabled: false,
    offVariation: kind === 'boolean' ? 1 : 0,
    fallthrough: { variation: 0 },
  };
}
