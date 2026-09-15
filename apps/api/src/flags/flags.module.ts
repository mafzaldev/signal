import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { FlagsController } from './flags.controller.js';
import { FlagsService } from './flags.service.js';

@Module({
  imports: [AuditModule, ProjectsModule],
  controllers: [FlagsController],
  providers: [FlagsService],
})
export class FlagsModule {}
