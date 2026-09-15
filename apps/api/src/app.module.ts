import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AuditModule } from './audit/audit.module.js';
import { auth } from './auth/auth.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [DatabaseModule, AuthModule.forRoot({ auth }), AuditModule],
  controllers: [HealthController],
})
export class AppModule {}
