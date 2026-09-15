import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { UserSession } from '@thallesp/nestjs-better-auth';

/** The signed-in user and the organization they're acting in. */
export interface Actor {
  userId: string;
  organizationId: string;
}

/** Use on routes guarded by `@RequireActiveOrg()`. */
export const CurrentActor = createParamDecorator((_: unknown, ctx: ExecutionContext): Actor => {
  const request = ctx.switchToHttp().getRequest<{ session?: UserSession }>();
  const organizationId = request.session?.session.activeOrganizationId;
  if (!request.session || !organizationId) {
    throw new ForbiddenException('An active organization is required');
  }
  return { userId: request.session.user.id, organizationId };
});
