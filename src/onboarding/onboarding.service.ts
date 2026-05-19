import { Injectable, Logger } from '@nestjs/common';
import { UsersRepository } from 'src/users/users.repository';
import { OnboardingStep } from './utils/onboarding.constants';
import { WhatsappService } from 'src/whatsapp/whatsapp.service';
import { ACTIVITY_QUESTION, AGE_QUESTION, CONSENT_FAREWELL, CONSENT_INVALID, GENDER_QUESTION, GOAL_IS_GAIN, GOAL_IS_LOSE, GOAL_IS_MAINTAIN, GOAL_QUESTION, HEIGHT_QUESTION, INVALID_OPTION, LGPD_MESSAGE, WEIGHT_QUESTION, welcomeMessage } from './utils/onboarding.messages';
import { calcGoals } from './utils/nutrition.calculator';
import { parseDecimal, parseHeightCm, parseInteger } from './utils/numeric.parser';
import { matchActivity, matchGender, matchGoal } from './utils/profile.match';

@Injectable()
export class OnboardingService {
    private readonly logger = new Logger(OnboardingService.name);
    private readonly handlers: Record<OnboardingStep, (phone: string, text: string, jid: string) => Promise<void>>;

    constructor(private readonly users: UsersRepository, private readonly whatsapp: WhatsappService) {
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

    async routeMessage(phone: string, text: string, jid: string): Promise<'handled' | 'delegate_to_ai'> {
        let user = await this.users.findByPhone(phone)
        if (!user) {
            user = await this.users.create({
                phone,
                onboarding_step: OnboardingStep.WaitingConsent
            });
            await this.whatsapp.sendText(jid, LGPD_MESSAGE);
            return 'handled';
        }

        if (user.onboarding_step === null) return 'delegate_to_ai';

        const step = user.onboarding_step as OnboardingStep;
        const handler = this.handlers[step];
        if (!handler) {
            this.logger.warn(`Unknown step: ${step}`);
            return 'delegate_to_ai';
        }

        await handler(user.phone, text, jid);
        return 'handled';
    }

    private async handleWaitingConsent(phone: string, text: string, jid: string) {
        const normalized = text.trim().toLowerCase();
        const YES = new Set(['sim', 's', 'yes']);
        const NO = new Set(['não', 'nao', 'n', 'no']);

        if (YES.has(normalized)) {
            await this.users.update(phone, {
                consent_given: true,
                consent_date: new Date(),
                onboarding_step: OnboardingStep.WaitingGoal,
            });
            await this.whatsapp.sendText(jid, GOAL_QUESTION);
        } else if (NO.has(normalized)) {
            await this.whatsapp.sendText(jid, CONSENT_FAREWELL);
        } else {
            await this.whatsapp.sendText(jid, CONSENT_INVALID);
        }
    }

    private async handleWaitingGoal(phone: string, text: string, jid: string) {
        const goal = matchGoal(text);
        if (goal === null) {
            await this.whatsapp.sendText(jid, INVALID_OPTION);
            await this.whatsapp.sendText(jid, GOAL_QUESTION);
            return;
        }

        await this.users.update(phone, {
            goal,
            onboarding_step: OnboardingStep.WaitingWeight,
        });

        const confirmations = { LOSE: GOAL_IS_LOSE, MAINTAIN: GOAL_IS_MAINTAIN, GAIN: GOAL_IS_GAIN };
        await this.whatsapp.sendText(jid, confirmations[goal]);
        await this.whatsapp.sendText(jid, WEIGHT_QUESTION);
    }

    private async handleWaitingWeight(phone: string, text: string, jid: string) {
        const weight = parseDecimal(text);

        if (weight === null || weight < 20 || weight > 350) {
            await this.whatsapp.sendText(jid, INVALID_OPTION);
            await this.whatsapp.sendText(jid, WEIGHT_QUESTION);
            return;
        }

        await this.users.update(phone, {
            weight,
            onboarding_step: OnboardingStep.WaitingHeight,
        });
        await this.whatsapp.sendText(jid, HEIGHT_QUESTION);
    }

    private async handleWaitingHeight(phone: string, text: string, jid: string) {
        const height = parseHeightCm(text);

        if (height === null || height < 100 || height > 250) {
            await this.whatsapp.sendText(jid, INVALID_OPTION);
            await this.whatsapp.sendText(jid, HEIGHT_QUESTION);
            return;
        }

        await this.users.update(phone, {
            height,
            onboarding_step: OnboardingStep.WaitingAge,
        });
        await this.whatsapp.sendText(jid, AGE_QUESTION);
    }

    private async handleWaitingAge(phone: string, text: string, jid: string) {
        const age = parseInteger(text);
        if (age === null || age < 13 || age > 90) {
            await this.whatsapp.sendText(jid, INVALID_OPTION);
            await this.whatsapp.sendText(jid, AGE_QUESTION);
            return;
        }

        await this.users.update(phone, {
            age,
            onboarding_step: OnboardingStep.WaitingGender,
        });
        await this.whatsapp.sendText(jid, GENDER_QUESTION);
    }

    private async handleWaitingGender(phone: string, text: string, jid: string) {
        const gender = matchGender(text);
        if (gender === null) {
            await this.whatsapp.sendText(jid, INVALID_OPTION);
            await this.whatsapp.sendText(jid, GENDER_QUESTION);
            return;
        }

        await this.users.update(phone, {
            gender,
            onboarding_step: OnboardingStep.WaitingActivity,
        });
        await this.whatsapp.sendText(jid, ACTIVITY_QUESTION);
    }

    private async handleWaitingActivity(phone: string, text: string, jid: string) {
        const user = await this.users.findByPhone(phone);
        if (!user) return;

        if (!user.gender || !user.weight || !user.height || !user.age || !user.goal) {
            this.logger.error(`Onboarding incompleto pra ${phone}`);
            return;
        }

        const activityLevel = matchActivity(text);
        if (activityLevel === null) {
            await this.whatsapp.sendText(jid, INVALID_OPTION);
            await this.whatsapp.sendText(jid, ACTIVITY_QUESTION);
            return;
        }

        const goals = calcGoals({
            age: user.age,
            gender: user.gender,
            goal: user.goal,
            height: user.height,
            weight: user.weight,
            activityLevel,
        });

        await this.users.update(phone, {
            activity_level: activityLevel,
            ...goals,
            onboarding_step: null,
        });
        await this.whatsapp.sendText(jid, welcomeMessage(goals));
    }
}
