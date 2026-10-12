import { Module } from '@nestjs/common';
import { RulesetModule } from '../ruleset/ruleset.module.js';
import { ClientController } from './client.controller.js';
import { ClientEvaluator } from './client-evaluator.service.js';
import { SdkController } from './sdk.controller.js';
import { ClientKeyGuard, SdkKeyGuard } from './sdk-key.guard.js';
import { StreamHub } from './stream-hub.service.js';

@Module({
  imports: [RulesetModule],
  controllers: [SdkController, ClientController],
  providers: [StreamHub, SdkKeyGuard, ClientKeyGuard, ClientEvaluator],
})
export class SdkModule {}
