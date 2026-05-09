import { Module } from '@nestjs/common';
import { MessagesHandler } from './messages.handler';
import { OnboardingModule } from 'src/onboarding/onboarding.module';
import { AiModule } from 'src/ai/ai.module';

@Module({
  imports: [OnboardingModule, AiModule],
  providers: [MessagesHandler],
})
export class MessagesModule {}
