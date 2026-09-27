import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { RulesetModule } from '../ruleset/ruleset.module.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

@Module({
  imports: [AuditModule, RulesetModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
