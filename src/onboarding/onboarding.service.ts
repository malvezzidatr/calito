import { Injectable, Logger } from '@nestjs/common';
import { UsersRepository } from 'src/users/users.repository';
import { OnboardingStep } from './onboarding.constants';
import { WhatsappService } from 'src/whatsapp/whatsapp.service';
import { ACTIVITY_QUESTION, AGE_QUESTION, CONSENT_FAREWELL, CONSENT_INVALID, GENDER_QUESTION, GOAL_IS_GAIN, GOAL_IS_LOSE, GOAL_IS_MAINTAIN, GOAL_QUESTION, HEIGHT_QUESTION, INVALID_OPTION, LGPD_MESSAGE, WEIGHT_QUESTION, welcomeMessage } from './onboarding.messages';
import { ActivityLevel, Gender } from '@prisma/client';
import { calcGoals } from './nutrition.calculator';

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
        const normalized = text.trim();
        switch (normalized) {
            case "1":
                await this.users.update(phone, {
                    goal: 'LOSE',
                    onboarding_step: OnboardingStep.WaitingWeight
                });
                await this.whatsapp.sendText(jid, GOAL_IS_LOSE);
                break;
            case "2":
                await this.users.update(phone, {
                    goal: 'MAINTAIN',
                    onboarding_step: OnboardingStep.WaitingWeight
                });
                await this.whatsapp.sendText(jid, GOAL_IS_MAINTAIN);
                break;

            case "3":
                await this.users.update(phone, {
                    goal: 'GAIN',
                    onboarding_step: OnboardingStep.WaitingWeight
                });
                await this.whatsapp.sendText(jid, GOAL_IS_GAIN);
                break;

            default:
                await this.whatsapp.sendText(jid, INVALID_OPTION);
                await this.whatsapp.sendText(jid, GOAL_QUESTION);
                return;

        }
        await this.whatsapp.sendText(jid, WEIGHT_QUESTION);

    }

    private async handleWaitingWeight(phone: string, text: string, jid: string) {
        this.logger.log(`TODO waiting_weight — phone=${phone}, text=${text}`);
        const normalized = text.trim().replace(',', '.');
        const weight = Number(normalized);

        if (!Number.isFinite(weight)) {
            await this.whatsapp.sendText(jid, INVALID_OPTION);
            await this.whatsapp.sendText(jid, WEIGHT_QUESTION);
            return;
        }

        if (weight <= 0 || weight > 350 || weight < 20) {
            await this.whatsapp.sendText(jid, INVALID_OPTION); // Alterar essa mensagem depois
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
        this.logger.log(`TODO waiting_height — phone=${phone}, text=${text}`);
        const normalized = text.trim().replace(',', '.');
        const height = Number(normalized);

        if (!Number.isFinite(height)) {
            await this.whatsapp.sendText(jid, INVALID_OPTION);
            await this.whatsapp.sendText(jid, HEIGHT_QUESTION);
            return;
        }

        if (height <= 0 || height > 250 || height < 100) {
            await this.whatsapp.sendText(jid, INVALID_OPTION); // Alterar essa mensagem depois
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
        this.logger.log(`TODO waiting_age — phone=${phone}, text=${text}`);
        const age = Number(text.trim());
        if (!Number.isInteger(age) || age < 13 || age > 90) {
            await this.whatsapp.sendText(jid, INVALID_OPTION); // Alterar essa mensagem depois
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
        const normalized = text.trim().toUpperCase();
        let gender: Gender;

        if (normalized === 'M') gender = 'MALE';
        else if (normalized === 'F') gender = 'FEMALE';
        else {
            await this.whatsapp.sendText(jid, INVALID_OPTION); // Alterar essa mensagem depois
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
        const normalized = text.trim();
        let activityLevel: ActivityLevel;
        const user = await this.users.findByPhone(phone);
        if (!user) {
            return;
        }

        if (!user.gender || !user.weight || !user.height || !user.age || !user.goal) {
            this.logger.error(`Onboarding incompleto pra ${phone}`);
            return;
        }
        
        switch (normalized) {
            case "1": activityLevel = 'SEDENTARY';
                break;
            case "2": activityLevel = 'LIGHT';
                break;
            case "3": activityLevel = 'MODERATE';
                break;
            case "4": activityLevel = 'INTENSE';
                break;
            case "5": activityLevel = 'VERY_INTENSE';
                break;
            default:
                await this.whatsapp.sendText(jid, INVALID_OPTION);
                return await this.whatsapp.sendText(jid, ACTIVITY_QUESTION);
        }

        const goals = calcGoals({
            age: user.age,
            gender: user.gender,
            goal: user.goal,
            height: user.height,
            weight: user.weight,
            activityLevel                  
        });

        await this.users.update(phone, {
            activity_level: activityLevel,
            ...goals,
            onboarding_step: null,
        });
        await this.whatsapp.sendText(jid, welcomeMessage(goals));
    }
}
