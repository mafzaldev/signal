import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
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

/** Accepts `Authorization: <key>` or `Authorization: Bearer <key>`. */
@Injectable()
export class SdkKeyGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Database) {}

  async canActivate(ctx: ExecutionContext) {
    const request = ctx.switchToHttp().getRequest<SdkRequest>();
    const header = request.headers.authorization;
    const key = typeof header === 'string' ? header.replace(/^Bearer\s+/i, '').trim() : '';
    if (!key) throw new UnauthorizedException('Missing SDK key');

    const [row] = await this.db
      .select({ id: sdkKey.id, environmentId: sdkKey.environmentId })
      .from(sdkKey)
      .where(eq(sdkKey.keyHash, hashSdkKey(key)));
    if (!row) throw new UnauthorizedException('Invalid SDK key');

    request.sdkEnvironmentId = row.environmentId;
    request.sdkKeyId = row.id;
    return true;
  }
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
