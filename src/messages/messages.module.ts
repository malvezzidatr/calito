import { Module } from '@nestjs/common';
import { MessagesHandler } from './messages.handler';
import { OnboardingModule } from 'src/onboarding/onboarding.module';
import { AiModule } from 'src/ai/ai.module';
import { WhatsappModule } from 'src/whatsapp/whatsapp.module';
import { MealsModule } from 'src/meals/meals.module';
import { UsersModule } from 'src/users/users.module';
import { SubscriptionModule } from 'src/subscription/subscription.module';
import { IntentRouter } from './intent.router';
import { UserMessageLock } from './user-message.lock';

@Module({
  imports: [OnboardingModule, AiModule, WhatsappModule, MealsModule, UsersModule, SubscriptionModule],
  providers: [MessagesHandler, IntentRouter, UserMessageLock],
})
export class MessagesModule {}
