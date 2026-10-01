import { Controller, Get, Headers, MessageEvent, Res, Sse, UseGuards } from '@nestjs/common';
import type { StreamEvent } from '@signal/core';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { interval, Observable } from 'rxjs';
import { RulesetService } from '../ruleset/ruleset.service.js';
import { SdkEnvironment, SdkKeyGuard, SdkKeyId } from './sdk-key.guard.js';
import { StreamHub } from './stream-hub.service.js';

const HEARTBEAT_MS = 20_000;

/** Endpoints for SDKs, authenticated by SDK key instead of a user session. */
@Controller('sdk')
@AllowAnonymous()
@UseGuards(SdkKeyGuard)
export class SdkController {
  constructor(
    private readonly rulesets: RulesetService,
    private readonly hub: StreamHub,
  ) {}

  @Get('flags')
  async flags(
    @SdkEnvironment() environmentId: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { body, etag } = await this.rulesets.get(environmentId);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'no-cache');
    if (ifNoneMatch === etag) {
      res.status(304);
      return;
    }
    res.type('application/json');
    return body;
  }

  /**
   * Sends the full ruleset first, then changes as they happen. Changes that
   * arrive while the ruleset loads are held and sent after it; SDKs ignore any
   * whose version they already have.
   */
  @Sse('stream')
  stream(
    @SdkEnvironment() environmentId: string,
    @SdkKeyId() keyId: string,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const send = (event: StreamEvent) => subscriber.next({ type: event.type, data: event.data });
      const pending: StreamEvent[] = [];
      let ready = false;

      const live = this.hub.events(environmentId).subscribe({
        next: (message) => {
          if (message.type === 'close') {
            // The key was revoked or the environment deleted; the SDK's reconnect gets a 401.
            if (!message.keyId || message.keyId === keyId) subscriber.complete();
            return;
          }
          if (ready) send(message);
          else pending.push(message);
        },
        // The hub completes on shutdown.
        complete: () => subscriber.complete(),
      });
      const heartbeat = interval(HEARTBEAT_MS).subscribe(() =>
        subscriber.next({ type: 'ping', data: '' }),
      );

      this.rulesets.get(environmentId).then(
        ({ body }) => {
          subscriber.next({ type: 'put', data: body });
          pending.forEach(send);
          ready = true;
        },
        (error: unknown) => subscriber.error(error),
      );

      return () => {
        live.unsubscribe();
        heartbeat.unsubscribe();
      };
    });
  }
}
