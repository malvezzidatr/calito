import { Injectable, Logger } from '@nestjs/common';
import { UsersRepository } from 'src/users/users.repository';
import { OnboardingStep } from './onboarding.constants';

@Injectable()
export class OnboardingService {
    private readonly logger = new Logger(OnboardingService.name);
    private readonly handlers: Record<OnboardingStep, (phone: string, text: string) => Promise<void>>;

    constructor(private readonly users: UsersRepository) {
        this.handlers = {
            [OnboardingStep.WaitingConsent]:  this.handleWaitingConsent.bind(this),
            [OnboardingStep.WaitingGoal]:     this.handleWaitingGoal.bind(this),
            [OnboardingStep.WaitingWeight]:   this.handleWaitingWeight.bind(this),
            [OnboardingStep.WaitingHeight]:   this.handleWaitingHeight.bind(this),
            [OnboardingStep.WaitingAge]:      this.handleWaitingAge.bind(this),
            [OnboardingStep.WaitingGender]:   this.handleWaitingGender.bind(this),
            [OnboardingStep.WaitingActivity]: this.handleWaitingActivity.bind(this),
        };
    }

    async routeMessage(phone: string, text: string): Promise<'handled' | 'delegate_to_ai'> {
        let user = await this.users.findByPhone(phone)
        if (!user) {
            user = await this.users.create({
                phone,
                onboarding_step: OnboardingStep.WaitingConsent
            });
        }

        if (user.onboarding_step === null) return 'delegate_to_ai';

        const step = user.onboarding_step as OnboardingStep;
        const handler = this.handlers[step];
        if (!handler) {
            this.logger.warn(`Unknown step: ${step}`);
            return 'delegate_to_ai';
        }

        await handler(phone, text);
        return 'handled';
    }

    private async handleWaitingConsent(phone: string, text: string) {
        this.logger.log(`TODO waiting_consent — phone=${phone}, text=${text}`);
    }

    private async handleWaitingGoal(phone: string, text: string) {
        this.logger.log(`TODO waiting_goal — phone=${phone}, text=${text}`);
    }

    private async handleWaitingWeight(phone: string, text: string) {
        this.logger.log(`TODO waiting_weight — phone=${phone}, text=${text}`);
    }

    private async handleWaitingHeight(phone: string, text: string) {
        this.logger.log(`TODO waiting_height — phone=${phone}, text=${text}`);
    }

    private async handleWaitingAge(phone: string, text: string) {
        this.logger.log(`TODO waiting_age — phone=${phone}, text=${text}`);
    }

    private async handleWaitingGender(phone: string, text: string) {
        this.logger.log(`TODO waiting_gender — phone=${phone}, text=${text}`);
    }

    private async handleWaitingActivity(phone: string, text: string) {
        this.logger.log(`TODO waiting_activity — phone=${phone}, text=${text}`);
    }
}
