import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  type CreateEnvironmentInput,
  createEnvironmentSchema,
  type CreateProjectInput,
  createProjectSchema,
  type UpdateProjectInput,
  updateProjectSchema,
} from '@signal/core/schemas';
import { MemberHasPermission, RequireActiveOrg } from '@thallesp/nestjs-better-auth';
import { type Actor, CurrentActor } from '../common/actor.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ProjectsService } from './projects.service.js';

@Controller('projects')
@RequireActiveOrg()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentActor() actor: Actor) {
    return this.projects.list(actor.organizationId);
  }

  @Post()
  @MemberHasPermission({ permissions: { project: ['create'] } })
  create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
  ) {
    return this.projects.create(actor, body);
  }

  @Get(':projectKey')
  get(@CurrentActor() actor: Actor, @Param('projectKey') projectKey: string) {
    return this.projects.get(actor.organizationId, projectKey);
  }

  @Patch(':projectKey')
  @MemberHasPermission({ permissions: { project: ['update'] } })
  update(
    @CurrentActor() actor: Actor,
    @Param('projectKey') projectKey: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectInput,
  ) {
    return this.projects.update(actor, projectKey, body);
  }

  @Delete(':projectKey')
  @HttpCode(204)
  @MemberHasPermission({ permissions: { project: ['delete'] } })
  delete(@CurrentActor() actor: Actor, @Param('projectKey') projectKey: string) {
    return this.projects.delete(actor, projectKey);
  }

  @Post(':projectKey/environments')
  @MemberHasPermission({ permissions: { project: ['update'] } })
  createEnvironment(
    @CurrentActor() actor: Actor,
    @Param('projectKey') projectKey: string,
    @Body(new ZodValidationPipe(createEnvironmentSchema)) body: CreateEnvironmentInput,
  ) {
    return this.projects.createEnvironment(actor, projectKey, body);
  }

  @Delete(':projectKey/environments/:environmentKey')
  @HttpCode(204)
  @MemberHasPermission({ permissions: { project: ['update'] } })
  deleteEnvironment(
    @CurrentActor() actor: Actor,
    @Param('projectKey') projectKey: string,
    @Param('environmentKey') environmentKey: string,
  ) {
    return this.projects.deleteEnvironment(actor, projectKey, environmentKey);
  }
}
