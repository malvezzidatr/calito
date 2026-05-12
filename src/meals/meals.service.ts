import { Injectable, Logger } from '@nestjs/common';
import { MealsRepository } from './meals.repository';
import { AiService } from '../ai/ai.service';
import { UsersRepository } from '../users/users.repository';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { MEAL_EXTRACTION_PROMPT, MealExtraction } from '../ai/meal.prompt';
import { MealType } from '@prisma/client';
import { pickPraise, pickGoalAwarePraise, subtractMeal } from './meal.praise';
import { formatMealConfirmation } from './meal.format';
import { validateMealExtraction } from './meal.validation';

@Injectable()
export class MealsService {
    private readonly logger = new Logger(MealsService.name);

    constructor(
        private readonly mealsRepository: MealsRepository,
        private readonly aiService: AiService,
        private readonly usersRepository: UsersRepository,
        private readonly whatsappService: WhatsappService,
    ) {}

    async register(phone: string, text: string, jid: string) {
        let extraction: MealExtraction;
        const user = await this.usersRepository.findByPhone(phone);
        if (!user) {
            this.logger.warn(`User não encontrado: ${phone}`);
            return;
        }

        try {
            const reply = await this.aiService.chat(
                [{ role: 'user', content: text }],
                { responseFormat: 'json', systemPrompt: MEAL_EXTRACTION_PROMPT, temperature: 0.2 },
            );
            extraction = validateMealExtraction(JSON.parse(reply));
        } catch (err) {
            this.logger.warn(`Falha ao extrair refeição: ${(err as Error).message}`);
            await this.whatsappService.sendText(jid, 'Não consegui entender essa refeição 🤔 Pode mandar de novo com mais detalhe?');
            return;
        }

        const mealType = extraction.meal_type ?? this.inferMealTypeByHour(new Date());

        try {
            await this.mealsRepository.create({
                user_id: user.id,
                meal_type: mealType,
                description: extraction.description,
                calories: extraction.calories,
                protein: extraction.protein,
                carbs: extraction.carbs,
                fat: extraction.fat,
            });
        } catch (err) {
            this.logger.error(`Falha ao persistir refeição do user ${user.id}: ${(err as Error).message}`);
            await this.whatsappService.sendText(jid, 'Tive um problema técnico ao registrar 😬 Pode tentar de novo daqui a pouquinho?');
            return;
        }

        const totalsAfter  = await this.mealsRepository.sumDailyByUser(user.id, new Date());
        const totalsBefore = subtractMeal(totalsAfter, extraction);

        let praise: string;
        if (user.calorie_goal == null && user.protein_goal == null) {
            this.logger.warn(`User ${user.id} sem goals — fallback`);
            praise = pickPraise(extraction);
        } else {
            praise = pickGoalAwarePraise({
                totalsBefore,
                totalsAfter,
                goals: { calorie: user.calorie_goal, protein: user.protein_goal },
                extraction,
            });
        }

        const message = formatMealConfirmation(mealType, extraction, praise);
        await this.whatsappService.sendText(jid, message);
    }

    private inferMealTypeByHour(now: Date): MealType {
        const h = now.getHours();
        if (h >= 5 && h < 11) return 'BREAKFAST';
        if (h >= 11 && h < 15) return 'LUNCH';
        if (h >= 18 && h < 23) return 'DINNER';
        return 'SNACK';
    }
}
