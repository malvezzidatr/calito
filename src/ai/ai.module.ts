import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { IntentClassifier } from './intent.classifier';

@Module({
  imports: [],
  providers: [AiService, IntentClassifier],
  exports: [AiService, IntentClassifier],
})
export class AiModule {}
