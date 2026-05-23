import { Injectable, Logger } from '@nestjs/common';
import { User } from '@prisma/client';
import { MealsRepository } from './meals.repository';
import { AiService } from '../ai/ai.service';
import { UsersRepository } from '../users/users.repository';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { MEAL_EXTRACTION_PROMPT, MealExtraction, MealExtractionResult, buildEditUserMessage, isMealClarification } from './utils/meal.prompt';
import { pickPraise, pickGoalAwarePraise, pickDailyResumePraise, subtractMeal, pickWeeklyResumePraise } from './utils/meal.praise';
import { formatMealConfirmation, formatDailyResume, DailyGoals, formatWeeklyResume, formatMacroResume, formatDeleteConfirmation, EMPTY_DELETE_MESSAGE, formatEditConfirmation, EMPTY_EDIT_MESSAGE, VAGUE_EDIT_MESSAGE, formatMealList } from './utils/meal.format';
import { validateMealExtraction } from './utils/meal.validation';
import { startOfDaysAgo, startOfNextDay } from './utils/day-bounds';
import { buildWeeklySummary } from './utils/weekly.summary';
import { detectMacro } from './utils/macro.detect';
import { inferMealTypeByHour } from './utils/meal-type.infer';

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
        await this.withUser(phone, async (user) => {
            let result: MealExtractionResult;
            try {
                const reply = await this.aiService.chat(
                    [{ role: 'user', content: text }],
                    { responseFormat: 'json', systemPrompt: MEAL_EXTRACTION_PROMPT, temperature: 0.2 },
                );
                result = validateMealExtraction(JSON.parse(reply));
            } catch (err) {
                this.logger.warn(`Falha ao extrair refeição: ${(err as Error).message}`);
                await this.whatsappService.sendText(jid, 'Não consegui entender essa refeição 🤔 Pode mandar de novo com mais detalhe?');
                return;
            }

            if (isMealClarification(result)) {
                await this.whatsappService.sendText(jid, result.needs_clarification);
                return;
            }

            const extraction: MealExtraction = result;
            const mealType = extraction.meal_type ?? inferMealTypeByHour(new Date());

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
        });
    }

    async dailyResume(phone: string, jid: string) {
        await this.withUser(phone, async (user) => {
            const today = new Date();
            const [totals, meals] = await Promise.all([
                this.mealsRepository.sumDailyByUser(user.id, today),
                this.mealsRepository.findDailyByUser(user.id, today),
            ]);

            const praise = pickDailyResumePraise({
                totalCalories: totals.calories,
                calorieGoal: user.calorie_goal,
            });

            const message = formatDailyResume(
                today,
                meals,
                totals,
                {
                    calorie: user.calorie_goal,
                    protein: user.protein_goal,
                    carbs:   user.carbs_goal,
                    fat:     user.fat_goal,
                },
                praise,
            );

            await this.whatsappService.sendText(jid, message);
        });
    }

    async weeklyResume(phone: string, jid: string) {
        await this.withUser(phone, async (user) => {
            const today = new Date();
            const startInclusive = startOfDaysAgo(today, 6);
            const endExclusive   = startOfNextDay(today);

            const meals = await this.mealsRepository.findInRangeByUser(user.id, startInclusive, endExclusive);

            const goals: DailyGoals = {
                calorie: user.calorie_goal,
                protein: user.protein_goal,
                carbs:   user.carbs_goal,
                fat:     user.fat_goal,
            };

            const summary = buildWeeklySummary(meals, today, goals);

            const praise = pickWeeklyResumePraise({
                daysWithinGoal: summary.daysWithinGoal,
                totalDays: summary.days.length,
                hasAnyMeal: summary.days.some((d) => d.hasMeals),
                calorieGoal: user.calorie_goal,
            });

            const message = formatWeeklyResume(summary, goals, praise);
            await this.whatsappService.sendText(jid, message);
        });
    }

    async macroResume(phone: string, text: string, jid: string) {
        await this.withUser(phone, async (user) => {
            const macro = detectMacro(text);
            if (!macro) {
                await this.whatsappService.sendText(jid, 'Posso te mostrar calorias, proteína, carboidrato ou gordura. Qual deles? 🤔');
                return;
            }

            const today = new Date();
            const totals = await this.mealsRepository.sumDailyByUser(user.id, today);

            const goalsByMacro: Record<typeof macro, number | null> = {
                calorie: user.calorie_goal,
                protein: user.protein_goal,
                carbs:   user.carbs_goal,
                fat:     user.fat_goal,
            };
            const totalsByMacro: Record<typeof macro, number> = {
                calorie: totals.calories,
                protein: totals.protein,
                carbs:   totals.carbs,
                fat:     totals.fat,
            };

            const message = formatMacroResume(macro, totalsByMacro[macro], goalsByMacro[macro], today);
            await this.whatsappService.sendText(jid, message);
        });
    }

    async listMeals(phone: string, jid: string) {
        await this.withUser(phone, async (user) => {
            const today = new Date();
            const meals = await this.mealsRepository.listDailyByUser(user.id, today);
            const message = formatMealList(meals, today);
            await this.whatsappService.sendText(jid, message);
        });
    }

    async deleteLast(phone: string, jid: string) {
        await this.withUser(phone, async (user) => {
            const lastMeal = await this.mealsRepository.findLastByUser(user.id);
            if (!lastMeal) {
                await this.whatsappService.sendText(jid, EMPTY_DELETE_MESSAGE);
                return;
            }

            try {
                await this.mealsRepository.deleteById(lastMeal.id);
            } catch (err) {
                this.logger.error(`Falha ao apagar refeição ${lastMeal.id} do user ${user.id}: ${(err as Error).message}`);
                await this.whatsappService.sendText(jid, 'Tive um problema técnico ao apagar 😬 Pode tentar de novo daqui a pouquinho?');
                return;
            }

            await this.whatsappService.sendText(jid, formatDeleteConfirmation(lastMeal.meal_type, lastMeal.description, lastMeal.calories));
        });
    }

    async editLast(phone: string, text: string, jid: string) {
        await this.withUser(phone, async (user) => {
            const lastMeal = await this.mealsRepository.findLastByUser(user.id);
            if (!lastMeal) {
                await this.whatsappService.sendText(jid, EMPTY_EDIT_MESSAGE);
                return;
            }

            let result: MealExtractionResult;
            try {
                const reply = await this.aiService.chat(
                    [{ role: 'user', content: buildEditUserMessage(lastMeal.description, text) }],
                    { responseFormat: 'json', systemPrompt: MEAL_EXTRACTION_PROMPT, temperature: 0.2 },
                );
                result = validateMealExtraction(JSON.parse(reply));
            } catch (err) {
                this.logger.warn(`Falha ao re-extrair refeição ${lastMeal.id}: ${(err as Error).message}`);
                await this.whatsappService.sendText(jid, 'Não consegui entender essa correção 🤔 Pode mandar de novo com mais detalhe?');
                return;
            }

            if (isMealClarification(result)) {
                await this.whatsappService.sendText(jid, result.needs_clarification);
                return;
            }

            const extraction: MealExtraction = result;

            if (this.isSameDescription(extraction.description, lastMeal.description)) {
                await this.whatsappService.sendText(jid, VAGUE_EDIT_MESSAGE);
                return;
            }

            const mealType = extraction.meal_type ?? lastMeal.meal_type;

            try {
                await this.mealsRepository.updateById(lastMeal.id, {
                    meal_type: mealType,
                    description: extraction.description,
                    calories: extraction.calories,
                    protein: extraction.protein,
                    carbs: extraction.carbs,
                    fat: extraction.fat,
                });
            } catch (err) {
                this.logger.error(`Falha ao atualizar refeição ${lastMeal.id} do user ${user.id}: ${(err as Error).message}`);
                await this.whatsappService.sendText(jid, 'Tive um problema técnico ao corrigir 😬 Pode tentar de novo daqui a pouquinho?');
                return;
            }

            await this.whatsappService.sendText(jid, formatEditConfirmation(mealType, extraction));
        });
    }

    private async withUser(phone: string, fn: (user: User) => Promise<void>): Promise<void> {
        const user = await this.usersRepository.findByPhone(phone);
        if (!user) {
            this.logger.warn(`User não encontrado: ${phone}`);
            return;
        }
        await fn(user);
    }

    private isSameDescription(a: string, b: string): boolean {
        return a.trim().toLowerCase() === b.trim().toLowerCase();
    }
}
