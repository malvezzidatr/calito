import { Injectable, Logger } from '@nestjs/common';
import { UsersRepository } from 'src/users/users.repository';
import { OnboardingStep } from './utils/onboarding.constants';
import { WhatsappService } from 'src/whatsapp/whatsapp.service';
import { AiService } from 'src/ai/ai.service';
import {
  ACTIVITY_QUESTION, AGE_QUESTION, CONFIRM_INVALID, CONSENT_FAREWELL, CONSENT_INVALID,
  formatNutritionistGoalsConfirmation, formatNutritionistProfileConfirmation,
  GENDER_QUESTION, GOAL_IS_GAIN, GOAL_IS_LOSE, GOAL_IS_MAINTAIN, GOAL_QUESTION, HEIGHT_QUESTION,
  INVALID_OPTION, LGPD_MESSAGE, NUTRITIONIST_CHOICE_QUESTION, NUTRITIONIST_GOALS_PARSE_ERROR,
  NUTRITIONIST_GOALS_QUESTION, NUTRITIONIST_GOALS_REDO, NUTRITIONIST_PROFILE_PARSE_ERROR,
  NUTRITIONIST_PROFILE_QUESTION, NUTRITIONIST_PROFILE_REDO, nutritionistWelcomeMessage,
  WEIGHT_QUESTION, welcomeMessage,
} from './utils/onboarding.messages';
import { calcGoals } from './utils/nutrition.calculator';
import { parseDecimal, parseHeightCm, parseInteger } from './utils/numeric.parser';
import { matchActivity, matchGender, matchGoal } from './utils/profile.match';
import { isNutritionistGoalsClarification, NUTRITIONIST_GOALS_PROMPT, NutritionistGoalsResult } from './utils/nutritionist-goals.prompt';
import { validateNutritionistGoals } from './utils/nutritionist-goals.validation';
import { isNutritionistProfileClarification, NUTRITIONIST_PROFILE_PROMPT, NutritionistProfileResult } from './utils/nutritionist-profile.prompt';
import { validateNutritionistProfile } from './utils/nutritionist-profile.validation';
import { parseYesNo } from '../common/utils/yes-no.parser';
import { SubscriptionService } from 'src/subscription/subscription.service';

@Injectable()
export class OnboardingService {
    private readonly logger = new Logger(OnboardingService.name);
    private readonly handlers: Record<OnboardingStep, (phone: string, text: string, jid: string) => Promise<void>>;

    constructor(
        private readonly users: UsersRepository,
        private readonly whatsapp: WhatsappService,
        private readonly ai: AiService,
        private readonly subscription: SubscriptionService,
    ) {
        this.handlers = {
            [OnboardingStep.WaitingConsent]:                    this.handleWaitingConsent.bind(this),
            [OnboardingStep.WaitingNutritionistChoice]:         this.handleWaitingNutritionistChoice.bind(this),
            [OnboardingStep.WaitingNutritionistGoals]:          this.handleWaitingNutritionistGoals.bind(this),
            [OnboardingStep.WaitingNutritionistGoalsConfirm]:   this.handleWaitingNutritionistGoalsConfirm.bind(this),
            [OnboardingStep.WaitingNutritionistProfile]:        this.handleWaitingNutritionistProfile.bind(this),
            [OnboardingStep.WaitingNutritionistProfileConfirm]: this.handleWaitingNutritionistProfileConfirm.bind(this),
            [OnboardingStep.WaitingGoal]:                       this.handleWaitingGoal.bind(this),
            [OnboardingStep.WaitingWeight]:                     this.handleWaitingWeight.bind(this),
            [OnboardingStep.WaitingHeight]:                     this.handleWaitingHeight.bind(this),
            [OnboardingStep.WaitingAge]:                        this.handleWaitingAge.bind(this),
            [OnboardingStep.WaitingGender]:                     this.handleWaitingGender.bind(this),
            [OnboardingStep.WaitingActivity]:                   this.handleWaitingActivity.bind(this),
        };
    }

    async startNewUser(phone: string, jid: string): Promise<void> {
        await this.users.create({
            phone,
            onboarding_step: OnboardingStep.WaitingConsent,
        });
        await this.whatsapp.sendText(jid, LGPD_MESSAGE);
    }

    async handleStep(step: string, phone: string, text: string, jid: string): Promise<'handled' | 'unknown'> {
        const handler = this.handlers[step as OnboardingStep];
        if (!handler) {
            this.logger.warn(`Unknown onboarding step: ${step}`);
            return 'unknown';
        }
        await handler(phone, text, jid);
        return 'handled';
    }

    private async handleWaitingConsent(phone: string, text: string, jid: string) {
        const choice = parseYesNo(text);
        if (choice === 'yes') {
            await this.users.update(phone, {
                consent_given: true,
                consent_date: new Date(),
                onboarding_step: OnboardingStep.WaitingNutritionistChoice,
            });
            await this.whatsapp.sendText(jid, NUTRITIONIST_CHOICE_QUESTION);
            return;
        }
        if (choice === 'no') {
            await this.whatsapp.sendText(jid, CONSENT_FAREWELL);
            return;
        }
        await this.whatsapp.sendText(jid, CONSENT_INVALID);
    }

    private async handleWaitingNutritionistChoice(phone: string, text: string, jid: string) {
        const choice = parseYesNo(text);
        if (choice === 'yes') {
            await this.users.update(phone, { onboarding_step: OnboardingStep.WaitingNutritionistGoals });
            await this.whatsapp.sendText(jid, NUTRITIONIST_GOALS_QUESTION);
            return;
        }
        if (choice === 'no') {
            await this.users.update(phone, { onboarding_step: OnboardingStep.WaitingGoal });
            await this.whatsapp.sendText(jid, GOAL_QUESTION);
            return;
        }
        await this.whatsapp.sendText(jid, CONFIRM_INVALID);
    }

    private async handleWaitingNutritionistGoals(phone: string, text: string, jid: string) {
        const result = await this.extractNutritionistGoals(text);
        if (result === null) {
            await this.whatsapp.sendText(jid, NUTRITIONIST_GOALS_PARSE_ERROR);
            return;
        }
        if (isNutritionistGoalsClarification(result)) {
            await this.whatsapp.sendText(jid, result.needs_clarification);
            return;
        }

        await this.users.update(phone, {
            calorie_goal: result.calorie,
            protein_goal: result.protein,
            carbs_goal:   result.carbs,
            fat_goal:     result.fat,
            onboarding_step: OnboardingStep.WaitingNutritionistGoalsConfirm,
        });
        await this.whatsapp.sendText(jid, formatNutritionistGoalsConfirmation(result));
    }

    private async handleWaitingNutritionistGoalsConfirm(phone: string, text: string, jid: string) {
        const choice = parseYesNo(text);
        if (choice === 'yes') {
            await this.users.update(phone, { onboarding_step: OnboardingStep.WaitingNutritionistProfile });
            await this.whatsapp.sendText(jid, NUTRITIONIST_PROFILE_QUESTION);
            return;
        }
        if (choice === 'no') {
            await this.users.update(phone, {
                calorie_goal: null,
                protein_goal: null,
                carbs_goal:   null,
                fat_goal:     null,
                onboarding_step: OnboardingStep.WaitingNutritionistGoals,
            });
            await this.whatsapp.sendText(jid, NUTRITIONIST_GOALS_REDO);
            return;
        }
        await this.whatsapp.sendText(jid, CONFIRM_INVALID);
    }

    private async handleWaitingNutritionistProfile(phone: string, text: string, jid: string) {
        const result = await this.extractNutritionistProfile(text);
        if (result === null) {
            await this.whatsapp.sendText(jid, NUTRITIONIST_PROFILE_PARSE_ERROR);
            return;
        }
        if (isNutritionistProfileClarification(result)) {
            await this.whatsapp.sendText(jid, result.needs_clarification);
            return;
        }

        await this.users.update(phone, {
            weight: result.weight,
            height: result.height,
            age:    result.age,
            gender: result.gender,
            onboarding_step: OnboardingStep.WaitingNutritionistProfileConfirm,
        });
        await this.whatsapp.sendText(jid, formatNutritionistProfileConfirmation(result));
    }

    private async handleWaitingNutritionistProfileConfirm(phone: string, text: string, jid: string) {
        const choice = parseYesNo(text);
        if (choice === 'yes') {
            const user = await this.users.findByPhone(phone);
            if (!user || user.calorie_goal == null || user.protein_goal == null || user.carbs_goal == null || user.fat_goal == null) {
                this.logger.error(`Onboarding por nutri incompleto pra ${phone}`);
                return;
            }
            await this.users.update(phone, { onboarding_step: null });
            await this.whatsapp.sendText(jid, nutritionistWelcomeMessage({
                calorie: user.calorie_goal,
                protein: user.protein_goal,
                carbs:   user.carbs_goal,
                fat:     user.fat_goal,
            }));
            await this.subscription.sendPaywall(jid);
            return;
        }
        if (choice === 'no') {
            await this.users.update(phone, {
                weight: null,
                height: null,
                age:    null,
                gender: null,
                onboarding_step: OnboardingStep.WaitingNutritionistProfile,
            });
            await this.whatsapp.sendText(jid, NUTRITIONIST_PROFILE_REDO);
            return;
        }
        await this.whatsapp.sendText(jid, CONFIRM_INVALID);
    }

    private async extractNutritionistGoals(text: string): Promise<NutritionistGoalsResult | null> {
        try {
            const reply = await this.ai.chat(
                [{ role: 'user', content: text }],
                { responseFormat: 'json', systemPrompt: NUTRITIONIST_GOALS_PROMPT, temperature: 0.1 },
            );
            return validateNutritionistGoals(JSON.parse(reply));
        } catch (err) {
            this.logger.warn(`Falha ao extrair metas da nutri: ${(err as Error).message}`);
            return null;
        }
    }

    private async extractNutritionistProfile(text: string): Promise<NutritionistProfileResult | null> {
        try {
            const reply = await this.ai.chat(
                [{ role: 'user', content: text }],
                { responseFormat: 'json', systemPrompt: NUTRITIONIST_PROFILE_PROMPT, temperature: 0.1 },
            );
            return validateNutritionistProfile(JSON.parse(reply));
        } catch (err) {
            this.logger.warn(`Falha ao extrair perfil da nutri: ${(err as Error).message}`);
            return null;
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
        await this.subscription.sendPaywall(jid);
    }
}
