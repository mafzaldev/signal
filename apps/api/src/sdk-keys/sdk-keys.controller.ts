import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { type CreateSdkKeyInput, createSdkKeySchema } from '@signal/core/schemas';
import { MemberHasPermission, RequireActiveOrg } from '@thallesp/nestjs-better-auth';
import { type Actor, CurrentActor } from '../common/actor.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { SdkKeysService } from './sdk-keys.service.js';

@Controller('projects/:projectKey/environments/:environmentKey/sdk-keys')
@RequireActiveOrg()
export class SdkKeysController {
  constructor(private readonly sdkKeys: SdkKeysService) {}

  @Get()
  list(
    @CurrentActor() actor: Actor,
    @Param('projectKey') projectKey: string,
    @Param('environmentKey') environmentKey: string,
  ) {
    return this.sdkKeys.list(actor.organizationId, projectKey, environmentKey);
  }

  @Post()
  @MemberHasPermission({ permissions: { project: ['update'] } })
  create(
    @CurrentActor() actor: Actor,
    @Param('projectKey') projectKey: string,
    @Param('environmentKey') environmentKey: string,
    @Body(new ZodValidationPipe(createSdkKeySchema)) body: CreateSdkKeyInput,
  ) {
    return this.sdkKeys.create(actor, projectKey, environmentKey, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @MemberHasPermission({ permissions: { project: ['update'] } })
  revoke(
    @CurrentActor() actor: Actor,
    @Param('projectKey') projectKey: string,
    @Param('environmentKey') environmentKey: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sdkKeys.revoke(actor, projectKey, environmentKey, id);
  }
}
