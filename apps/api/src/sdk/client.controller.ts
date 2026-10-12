import { Body, Controller, HttpCode, MessageEvent, Post, Sse, UseGuards } from '@nestjs/common';
import type { ClientStreamEvent } from '@signal/core';
import { type ClientEvaluateInput, clientEvaluateSchema } from '@signal/core/schemas';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { interval, Observable } from 'rxjs';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ClientEvaluator } from './client-evaluator.service.js';
import { ClientKeyGuard, SdkEnvironment, SdkKeyId } from './sdk-key.guard.js';
import { StreamHub } from './stream-hub.service.js';

const HEARTBEAT_MS = 20_000;

/**
 * Endpoints for browser SDKs, authenticated by a client key. Browsers send who the user
 * is and get back only that user's values; rules and other users' targeting never leave
 * the server.
 */
@Controller('sdk/client')
@AllowAnonymous()
@UseGuards(ClientKeyGuard)
export class ClientController {
  constructor(
    private readonly evaluator: ClientEvaluator,
    private readonly hub: StreamHub,
  ) {}

  @Post('evaluate')
  @HttpCode(200)
  evaluate(
    @SdkEnvironment() environmentId: string,
    @Body(new ZodValidationPipe(clientEvaluateSchema)) body: ClientEvaluateInput,
  ) {
    return this.evaluator.evaluate(environmentId, body.context);
  }

  /**
   * Says `change` whenever a flag in the environment changes, so the browser evaluates
   * again. Starts with a `ping`, which tells the browser it's connected and should
   * evaluate once to catch anything that changed before then.
   */
  @Sse('stream')
  stream(
    @SdkEnvironment() environmentId: string,
    @SdkKeyId() keyId: string,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const live = this.hub.events(environmentId).subscribe({
        next: (message) => {
          if (message.type !== 'close') {
            subscriber.next({ type: 'change' satisfies ClientStreamEvent['type'], data: '' });
          } else if (!message.keyId || message.keyId === keyId) subscriber.complete();
        },
        complete: () => subscriber.complete(),
      });
      subscriber.next({ type: 'ping', data: '' });
      const heartbeat = interval(HEARTBEAT_MS).subscribe(() =>
        subscriber.next({ type: 'ping', data: '' }),
      );
      return () => {
        live.unsubscribe();
        heartbeat.unsubscribe();
      };
    });
  }
}
