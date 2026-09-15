import { Controller, Get, Query } from '@nestjs/common';
import { RequireActiveOrg } from '@thallesp/nestjs-better-auth';
import { z } from 'zod';
import { type Actor, CurrentActor } from '../common/actor.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuditService } from './audit.service.js';

const auditQuerySchema = z.strictObject({
  projectKey: z.string().optional(),
  entityType: z.enum(['project', 'environment', 'flag', 'flag_config']).optional(),
  entityId: z.string().optional(),
  actorId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

@Controller('audit-logs')
@RequireActiveOrg()
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @CurrentActor() actor: Actor,
    @Query(new ZodValidationPipe(auditQuerySchema)) query: z.output<typeof auditQuerySchema>,
  ) {
    return this.audit.list(actor.organizationId, query);
  }
}
