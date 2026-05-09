import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { IntentClassifier } from './intent.classifier';
import { IntentRouter } from './intent.router';
import { WhatsappModule } from 'src/whatsapp/whatsapp.module';

@Module({
  imports: [WhatsappModule],
  providers: [AiService, IntentClassifier, IntentRouter],
  exports: [AiService, IntentClassifier, IntentRouter],
})
export class AiModule {}
