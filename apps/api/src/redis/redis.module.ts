import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { env } from '../env.js';

/** General commands (cache, publish). */
export const REDIS = Symbol('REDIS');
/** A connection in subscriber mode can't run other commands, so it gets its own. */
export const REDIS_SUBSCRIBER = Symbol('REDIS_SUBSCRIBER');

@Global()
@Module({
  providers: [
    { provide: REDIS, useFactory: () => new Redis(env.REDIS_URL) },
    { provide: REDIS_SUBSCRIBER, useFactory: () => new Redis(env.REDIS_URL) },
  ],
  exports: [REDIS, REDIS_SUBSCRIBER],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis,
  ) {}

  async onApplicationShutdown() {
    await Promise.all([this.redis.quit(), this.subscriber.quit()]);
  }
}
