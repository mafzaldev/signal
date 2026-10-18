import { Injectable } from '@nestjs/common';
import {
  type ClientEvaluation,
  type Context,
  evaluate,
  type FlagValue,
  type Ruleset,
} from '@signal/core';
import { RulesetService } from '../ruleset/ruleset.service.js';

/** Evaluates an environment's client-side flags for one context, for browser SDKs. */
@Injectable()
export class ClientEvaluator {
  /** The last parsed ruleset per environment, reused while its ETag is unchanged. */
  private readonly parsed = new Map<string, { etag: string; ruleset: Ruleset }>();

  constructor(private readonly rulesets: RulesetService) {}

  async evaluate(environmentId: string, context: Context): Promise<ClientEvaluation> {
    const ruleset = await this.ruleset(environmentId);
    const flags: ClientEvaluation['flags'] = {};
    for (const flag of Object.values(ruleset.flags)) {
      if (!flag.clientSide) continue;
      const result = evaluate(flag, context, ruleset.segments);
      // A malformed flag is left out, so the browser serves its default value. A `null`
      // value is not malformed: it's a valid JSON variation, such as "no banner".
      if (result.reason.kind === 'ERROR') continue;
      flags[flag.key] = {
        value: result.value as FlagValue,
        variationIndex: result.variationIndex,
        reason: result.reason,
      };
    }
    return { flags };
  }

  private async ruleset(environmentId: string) {
    const { body, etag } = await this.rulesets.get(environmentId);
    const cached = this.parsed.get(environmentId);
    if (cached?.etag === etag) return cached.ruleset;
    const ruleset = JSON.parse(body) as Ruleset;
    this.parsed.set(environmentId, { etag, ruleset });
    return ruleset;
  }
}
