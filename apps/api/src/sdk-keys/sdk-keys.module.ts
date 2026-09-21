import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { SdkKeysController } from './sdk-keys.controller.js';
import { SdkKeysService } from './sdk-keys.service.js';

@Module({
  imports: [AuditModule, ProjectsModule],
  controllers: [SdkKeysController],
  providers: [SdkKeysService],
})
export class SdkKeysModule {}
