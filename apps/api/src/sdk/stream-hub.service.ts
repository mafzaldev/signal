import { BeforeApplicationShutdown, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Observable, Subject } from 'rxjs';
import { REDIS_SUBSCRIBER } from '../redis/redis.module.js';
import type { ChannelMessage } from '../ruleset/ruleset.service.js';

/**
 * Routes flag changes published by any API instance to the SSE connections on
 * this one. One Redis pattern subscription serves every environment.
 */
@Injectable()
export class StreamHub implements OnModuleInit, BeforeApplicationShutdown {
  private readonly subjects = new Map<string, Subject<ChannelMessage>>();

  constructor(@Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis) {}

  async onModuleInit() {
    this.subscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
      const environmentId = channel.slice('env:'.length);
      this.subjects.get(environmentId)?.next(JSON.parse(message) as ChannelMessage);
    });
    await this.subscriber.psubscribe('env:*');
  }

  /**
   * Ends every open stream before the HTTP server closes, since SSE connections
   * never end on their own and would hold shutdown open. SDKs reconnect, to
   * another instance in a rolling deploy.
   */
  async beforeApplicationShutdown() {
    for (const subject of this.subjects.values()) subject.complete();
    this.subjects.clear();
    // Let the ended responses flush. The server only drops connections that are
    // idle when it closes; busy ones would hold shutdown for the keep-alive timeout.
    await new Promise((resolve) => setTimeout(resolve, 100));
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
