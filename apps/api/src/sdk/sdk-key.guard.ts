import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { SdkKeyKind } from '@signal/core/schemas';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { sdkKey } from '../db/schema/index.js';
import { DB } from '../database/database.module.js';
import { hashSdkKey } from '../sdk-keys/sdk-key-crypto.js';

interface SdkRequest {
  headers: Record<string, string | string[] | undefined>;
  sdkEnvironmentId?: string;
  sdkKeyId?: string;
}

/**
 * Accepts `Authorization: <key>` or `Authorization: Bearer <key>`, but only keys of this
 * guard's kind: server keys are secret and read full rulesets, client keys are public and
 * only get evaluated results, so neither may be used on the other's routes.
 */
abstract class KeyGuard implements CanActivate {
  protected abstract readonly kind: SdkKeyKind;

  constructor(@Inject(DB) private readonly db: Database) {}

  async canActivate(ctx: ExecutionContext) {
    const request = ctx.switchToHttp().getRequest<SdkRequest>();
    const header = request.headers.authorization;
    const key = typeof header === 'string' ? header.replace(/^Bearer\s+/i, '').trim() : '';
    if (!key) throw new UnauthorizedException('Missing SDK key');

    const [row] = await this.db
      .select({ id: sdkKey.id, environmentId: sdkKey.environmentId, kind: sdkKey.kind })
      .from(sdkKey)
      .where(eq(sdkKey.keyHash, hashSdkKey(key)));
    if (!row) throw new UnauthorizedException('Invalid SDK key');
    if (row.kind !== this.kind) {
      throw new ForbiddenException(
        this.kind === 'server'
          ? 'Client keys can only be used with browser SDKs'
          : 'Use a client key in browsers; server keys must stay secret',
      );
    }

    request.sdkEnvironmentId = row.environmentId;
    request.sdkKeyId = row.id;
    return true;
  }
}

/** Server SDK routes: full rulesets. */
@Injectable()
export class SdkKeyGuard extends KeyGuard {
  protected readonly kind = 'server';
}

/** Browser SDK routes: evaluated results only. */
@Injectable()
export class ClientKeyGuard extends KeyGuard {
  protected readonly kind = 'client';
}

/** The environment the request's SDK key belongs to. Use behind `SdkKeyGuard`. */
export const SdkEnvironment = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<SdkRequest>().sdkEnvironmentId!,
);

/** The id of the request's SDK key. Use behind `SdkKeyGuard`. */
export const SdkKeyId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<SdkRequest>().sdkKeyId!,
);
