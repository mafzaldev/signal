import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Flag, Ruleset, StreamEvent } from '@feature-flags/core';
import { and, eq } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { createHash } from 'node:crypto';
import type { Database } from '../db/client.js';
import { flag, flagConfig } from '../db/schema/index.js';
import { DB } from '../database/database.module.js';
import { REDIS } from '../redis/redis.module.js';

const CACHE_TTL_SECONDS = 60 * 60;

export const streamChannel = (environmentId: string) => `env:${environmentId}`;
// Each change bumps the generation, so a ruleset built from data read before the
// change can only ever be cached under the old (no longer read) generation.
const generationKey = (environmentId: string) => `ruleset-gen:${environmentId}`;
const cacheKey = (environmentId: string, generation: string) =>
  `ruleset:${environmentId}:${generation}`;

export interface CachedRuleset {
  /** The ruleset as JSON, ready to send. */
  body: string;
  etag: string;
}

@Injectable()
export class RulesetService {
  private readonly logger = new Logger(RulesetService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private async loadFlags(where: { environmentId?: string; flagId?: string }) {
    const rows = await this.db
      .select({
        environmentId: flagConfig.environmentId,
        key: flag.key,
        salt: flag.salt,
        variations: flag.variations,
        version: flagConfig.version,
        enabled: flagConfig.enabled,
        offVariation: flagConfig.offVariation,
        targets: flagConfig.targets,
        rules: flagConfig.rules,
        fallthrough: flagConfig.fallthrough,
      })
      .from(flagConfig)
      .innerJoin(flag, eq(flag.id, flagConfig.flagId))
      .where(
        and(
          where.environmentId ? eq(flagConfig.environmentId, where.environmentId) : undefined,
          where.flagId ? eq(flagConfig.flagId, where.flagId) : undefined,
        ),
      );
    return rows.map(({ environmentId, ...flag }) => ({ environmentId, flag: flag as Flag }));
  }

  async build(environmentId: string): Promise<Ruleset> {
    const rows = await this.loadFlags({ environmentId });
    return {
      flags: Object.fromEntries(rows.map(({ flag }) => [flag.key, flag])),
      segments: {},
    };
  }

  async get(environmentId: string): Promise<CachedRuleset> {
    const generation = (await this.redis.get(generationKey(environmentId))) ?? '0';
    const key = cacheKey(environmentId, generation);
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as CachedRuleset;

    const body = JSON.stringify(await this.build(environmentId));
    const entry = { body, etag: `"${createHash('sha1').update(body).digest('base64url')}"` };
    await this.redis.set(key, JSON.stringify(entry), 'EX', CACHE_TTL_SECONDS);
    return entry;
  }

  /**
   * Call after the change has committed. Pushes the flag's current state to
   * SDKs in the given environments (default: every environment).
   */
  async flagChanged(flagId: string, environmentIds?: string[]) {
    await this.notify(async () => {
      const rows = await this.loadFlags({ flagId });
      for (const { environmentId, flag } of rows) {
        if (environmentIds && !environmentIds.includes(environmentId)) continue;
        await this.invalidate(environmentId);
        await this.publish(environmentId, { type: 'patch', data: { flag } });
      }
    });
  }

  /** Call after the delete has committed, with each environment's last version. */
  async flagDeleted(key: string, configs: { environmentId: string; version: number }[]) {
    await this.notify(async () => {
      for (const { environmentId, version } of configs) {
        await this.invalidate(environmentId);
        await this.publish(environmentId, { type: 'delete', data: { key, version: version + 1 } });
      }
    });
  }

  private invalidate(environmentId: string) {
    return this.redis.incr(generationKey(environmentId));
  }

  private publish(environmentId: string, event: StreamEvent) {
    return this.redis.publish(streamChannel(environmentId), JSON.stringify(event));
  }

  /**
   * The database change has already committed, so a Redis failure must not fail
   * the request. SDKs catch up on their next full fetch.
   */
  private async notify(run: () => Promise<void>) {
    try {
      await run();
    } catch (error) {
      this.logger.error('Failed to publish a flag change', error);
    }
  }
}
