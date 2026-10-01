import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  type CreateFlagInput,
  createFlagSchema,
  type UpdateFlagConfigInput,
  updateFlagConfigSchema,
  type UpdateFlagInput,
  updateFlagSchema,
} from '@signal/core/schemas';
import { MemberHasPermission, RequireActiveOrg } from '@thallesp/nestjs-better-auth';
import { type Actor, CurrentActor } from '../common/actor.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { FlagsService } from './flags.service.js';

@Controller('projects/:projectKey/flags')
@RequireActiveOrg()
export class FlagsController {
  constructor(private readonly flags: FlagsService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Param('projectKey') projectKey: string) {
    return this.flags.list(actor.organizationId, projectKey);
  }

  @Post()
  @MemberHasPermission({ permissions: { flag: ['create'] } })
  create(
    @CurrentActor() actor: Actor,
    @Param('projectKey') projectKey: string,
    @Body(new ZodValidationPipe(createFlagSchema)) body: CreateFlagInput,
  ) {
    return this.flags.create(actor, projectKey, body);
  }

  @Get(':flagKey')
  get(
    @CurrentActor() actor: Actor,
    @Param('projectKey') projectKey: string,
    @Param('flagKey') flagKey: string,
  ) {
    return this.flags.get(actor.organizationId, projectKey, flagKey);
  }

  @Patch(':flagKey')
  @MemberHasPermission({ permissions: { flag: ['update'] } })
  update(
    @CurrentActor() actor: Actor,
    @Param('projectKey') projectKey: string,
    @Param('flagKey') flagKey: string,
    @Body(new ZodValidationPipe(updateFlagSchema)) body: UpdateFlagInput,
  ) {
    return this.flags.update(actor, projectKey, flagKey, body);
  }

  @Delete(':flagKey')
  @HttpCode(204)
  @MemberHasPermission({ permissions: { flag: ['delete'] } })
  delete(
    @CurrentActor() actor: Actor,
    @Param('projectKey') projectKey: string,
    @Param('flagKey') flagKey: string,
  ) {
    return this.flags.delete(actor, projectKey, flagKey);
  }

  @Patch(':flagKey/environments/:environmentKey')
  @MemberHasPermission({ permissions: { flag: ['update'] } })
  updateConfig(
    @CurrentActor() actor: Actor,
    @Param('projectKey') projectKey: string,
    @Param('flagKey') flagKey: string,
    @Param('environmentKey') environmentKey: string,
    @Body(new ZodValidationPipe(updateFlagConfigSchema)) body: UpdateFlagConfigInput,
  ) {
    return this.flags.updateConfig(actor, projectKey, flagKey, environmentKey, body);
  }
}
