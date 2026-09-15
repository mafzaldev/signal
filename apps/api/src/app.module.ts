import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth/auth.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [DatabaseModule, AuthModule.forRoot({ auth })],
  controllers: [HealthController],
})
export class AppModule {}
