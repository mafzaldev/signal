import { Module } from '@nestjs/common';
import { RulesetService } from './ruleset.service.js';

@Module({
  providers: [RulesetService],
  exports: [RulesetService],
})
export class RulesetModule {}
