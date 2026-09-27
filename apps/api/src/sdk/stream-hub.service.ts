import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Observable, Subject } from 'rxjs';
import { REDIS_SUBSCRIBER } from '../redis/redis.module.js';
import type { ChannelMessage } from '../ruleset/ruleset.service.js';

/**
 * Routes flag changes published by any API instance to the SSE connections on
 * this one. One Redis pattern subscription serves every environment.
 */
@Injectable()
export class StreamHub implements OnModuleInit {
  private readonly subjects = new Map<string, Subject<ChannelMessage>>();

  constructor(@Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis) {}

  async onModuleInit() {
    this.subscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
      const environmentId = channel.slice('env:'.length);
      this.subjects.get(environmentId)?.next(JSON.parse(message) as ChannelMessage);
    });
    await this.subscriber.psubscribe('env:*');
  }

  events(environmentId: string): Observable<ChannelMessage> {
    return new Observable((observer) => {
      let subject = this.subjects.get(environmentId);
      if (!subject) {
        subject = new Subject();
        this.subjects.set(environmentId, subject);
      }
      const subscription = subject.subscribe(observer);
      return () => {
        subscription.unsubscribe();
        if (!subject.observed) this.subjects.delete(environmentId);
      };
    });
  }
}
