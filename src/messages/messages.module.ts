import { Module } from '@nestjs/common';
import { MessagesHandler } from './messages.handler';
import { OnboardingModule } from 'src/onboarding/onboarding.module';
import { AiModule } from 'src/ai/ai.module';
import { WhatsappModule } from 'src/whatsapp/whatsapp.module';
import { MealsModule } from 'src/meals/meals.module';
import { IntentRouter } from 'src/ai/intent.router';

@Module({
  imports: [OnboardingModule, AiModule, WhatsappModule, MealsModule],
  providers: [MessagesHandler, IntentRouter],
})
export class MessagesModule {}
