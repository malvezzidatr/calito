import { Module } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { UsersModule } from 'src/users/users.module';
import { WhatsappModule } from 'src/whatsapp/whatsapp.module';
import { AiModule } from 'src/ai/ai.module';
import { SubscriptionModule } from 'src/subscription/subscription.module';

@Module({
    imports: [UsersModule, WhatsappModule, AiModule, SubscriptionModule],
    providers: [OnboardingService],
    exports: [OnboardingService],
})
export class OnboardingModule {}
