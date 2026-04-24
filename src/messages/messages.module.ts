import { Module } from '@nestjs/common';
import { MessagesHandler } from './messages.handler';
import { OnboardingModule } from 'src/onboarding/onboarding.module';

@Module({
  imports: [OnboardingModule],
  providers: [MessagesHandler],
})
export class MessagesModule {}
