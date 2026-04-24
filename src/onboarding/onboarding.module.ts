import { Module } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { UsersModule } from 'src/users/users.module';

@Module({
    imports: [UsersModule],
    providers: [OnboardingService],
    exports: [OnboardingService],
})
export class OnboardingModule {}
