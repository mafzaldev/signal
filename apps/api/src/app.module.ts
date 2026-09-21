import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AuditModule } from './audit/audit.module.js';
import { auth } from './auth/auth.js';
import { DatabaseModule } from './database/database.module.js';
import { FlagsModule } from './flags/flags.module.js';
import { HealthController } from './health/health.controller.js';
import { ProjectsModule } from './projects/projects.module.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    AuthModule.forRoot({ auth }),
    AuditModule,
    ProjectsModule,
    FlagsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
