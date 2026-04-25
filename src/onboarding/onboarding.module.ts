import { Module } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { UsersModule } from 'src/users/users.module';
import { WhatsappModule } from 'src/whatsapp/whatsapp.module';

@Module({
    imports: [UsersModule, WhatsappModule],
    providers: [OnboardingService],
    exports: [OnboardingService],
})
export class OnboardingModule {}
