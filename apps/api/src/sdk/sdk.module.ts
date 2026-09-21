import { Module } from '@nestjs/common';
import { RulesetModule } from '../ruleset/ruleset.module.js';
import { SdkController } from './sdk.controller.js';
import { SdkKeyGuard } from './sdk-key.guard.js';
import { StreamHub } from './stream-hub.service.js';

@Module({
  imports: [RulesetModule],
  controllers: [SdkController],
  providers: [StreamHub, SdkKeyGuard],
})
export class SdkModule {}
