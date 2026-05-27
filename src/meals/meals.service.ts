import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MealType, User } from '@prisma/client';
import { MealsRepository } from './meals.repository';
import { AiService } from '../ai/ai.service';
import { UsersRepository } from '../users/users.repository';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { FoodsService } from '../foods/foods.service';
import { MEAL_EXTRACTION_PROMPT, MealExtraction, MealExtractionResult, buildEditUserMessage, isMealClarification } from './utils/meal.prompt';
import { MEAL_PARSER_PROMPT, MealParserResult, isMealParserClarification, buildParserEditMessage } from './utils/meal.parser.prompt';
import { validateMealParserResult } from './utils/meal.parser.validation';
import { describeFromFoods, stripMealVerbs } from './utils/meal.text';
import { ParsedMessagesRepository } from './parsed-messages.repository';
import { normalize } from '../foods/utils/food.matcher';
import { pickPraise, pickGoalAwarePraise, pickDailyResumePraise, subtractMeal, pickWeeklyResumePraise } from './utils/meal.praise';
import { formatMealConfirmation, formatDailyResume, DailyGoals, formatWeeklyResume, formatMacroResume, formatDeleteConfirmation, formatEditConfirmation, formatMealList, formatMealTime, formatDeleteNotFound, formatDeleteAmbiguous, formatDeleteTimeNotFound, formatEditNotFound, formatEditAmbiguous, formatEditTimeNotFound, formatDateLabel } from './utils/meal.format';
import {
    DELETE_REFERENCE_PARSE_FAILED,
    EDIT_REFERENCE_PARSE_FAILED,
    EMPTY_DELETE_MESSAGE,
    EMPTY_EDIT_MESSAGE,
    MACRO_NOT_RECOGNIZED,
    MEAL_CALC_FAILED,
    MEAL_EDIT_CALC_FAILED,
    MEAL_EDIT_PARSE_FAILED,
    MEAL_PARSE_FAILED,
    MEAL_TECH_ERROR_DELETE,
    MEAL_TECH_ERROR_EDIT,
    MEAL_TECH_ERROR_REGISTER,
    VAGUE_EDIT_MESSAGE,
} from './messages/meals.messages';
import { isMealReferenceClarification, MEAL_REFERENCE_PROMPT, MealReferenceResult } from './utils/meal-reference.prompt';
import { validateMealReference } from './utils/meal-reference.validation';
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
        private readonly foodsService: FoodsService,
        private readonly config: ConfigService,
        private readonly parsedMessagesRepository: ParsedMessagesRepository,
    ) {}

    private useLocalCalculator(): boolean {
        return this.config.get<string>('USE_LOCAL_CALCULATOR') === 'true';
    }

    async register(phone: string, text: string, jid: string) {
        if (this.useLocalCalculator()) {
            return this.registerLocal(phone, text, jid);
        }
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
                await this.whatsappService.sendText(jid, MEAL_PARSE_FAILED);
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
                await this.whatsappService.sendText(jid, MEAL_TECH_ERROR_REGISTER);
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
                await this.whatsappService.sendText(jid, MACRO_NOT_RECOGNIZED);
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

    async deleteMeal(phone: string, text: string, jid: string) {
        await this.withUser(phone, async (user) => {
            const reference = await this.extractMealReference(text);
            if (reference === null) {
                await this.whatsappService.sendText(jid, DELETE_REFERENCE_PARSE_FAILED);
                return;
            }
            if (isMealReferenceClarification(reference)) {
                await this.whatsappService.sendText(jid, reference.needs_clarification);
                return;
            }

            const targetDate = startOfDaysAgo(new Date(), reference.days_offset);
            const dateLabel = formatDateLabel(reference.days_offset, targetDate);
            const matches = await this.mealsRepository.findDailyByUserAndType(user.id, targetDate, reference.meal_type);

            if (matches.length === 0) {
                await this.whatsappService.sendText(jid, formatDeleteNotFound(reference.meal_type, dateLabel));
                return;
            }

            if (reference.time !== null) {
                const exact = matches.find((m) => formatMealTime(m.created_at) === reference.time);
                if (!exact) {
                    await this.whatsappService.sendText(jid, formatDeleteTimeNotFound(reference.meal_type, reference.time, matches, dateLabel));
                    return;
                }
                await this.performDelete(exact, user.id, jid, dateLabel);
                return;
            }

            if (matches.length === 1) {
                await this.performDelete(matches[0], user.id, jid, dateLabel);
                return;
            }

            await this.whatsappService.sendText(jid, formatDeleteAmbiguous(reference.meal_type, matches, dateLabel));
        });
    }

    private async performDelete(meal: { id: string; meal_type: MealType; description: string; calories: number }, user_id: string, jid: string, dateLabel: string = 'hoje') {
        try {
            await this.mealsRepository.deleteById(meal.id);
        } catch (err) {
            this.logger.error(`Falha ao apagar refeição ${meal.id} do user ${user_id}: ${(err as Error).message}`);
            await this.whatsappService.sendText(jid, MEAL_TECH_ERROR_DELETE);
            return;
        }
        await this.whatsappService.sendText(jid, formatDeleteConfirmation(meal.meal_type, meal.description, meal.calories, dateLabel));
    }

    private async extractMealReference(text: string): Promise<MealReferenceResult | null> {
        try {
            const reply = await this.aiService.chat(
                [{ role: 'user', content: text }],
                { responseFormat: 'json', systemPrompt: MEAL_REFERENCE_PROMPT, temperature: 0.1 },
            );
            return validateMealReference(JSON.parse(reply));
        } catch (err) {
            this.logger.warn(`Falha ao extrair referência de refeição: ${(err as Error).message}`);
            return null;
        }
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
                await this.whatsappService.sendText(jid, MEAL_TECH_ERROR_DELETE);
                return;
            }

            await this.whatsappService.sendText(jid, formatDeleteConfirmation(lastMeal.meal_type, lastMeal.description, lastMeal.calories));
        });
    }

    async editMeal(phone: string, text: string, jid: string) {
        if (this.useLocalCalculator()) {
            return this.editMealLocal(phone, text, jid);
        }
        await this.withUser(phone, async (user) => {
            const target = await this.resolveEditTarget(user.id, text, jid);
            if (!target) return;

            let result: MealExtractionResult;
            try {
                const reply = await this.aiService.chat(
                    [{ role: 'user', content: buildEditUserMessage(target.description, text) }],
                    { responseFormat: 'json', systemPrompt: MEAL_EXTRACTION_PROMPT, temperature: 0.2 },
                );
                result = validateMealExtraction(JSON.parse(reply));
            } catch (err) {
                this.logger.warn(`Falha ao re-extrair refeição ${target.id}: ${(err as Error).message}`);
                await this.whatsappService.sendText(jid, MEAL_EDIT_PARSE_FAILED);
                return;
            }

            if (isMealClarification(result)) {
                await this.whatsappService.sendText(jid, result.needs_clarification);
                return;
            }

            const extraction: MealExtraction = result;

            if (this.isSameDescription(extraction.description, target.description)) {
                await this.whatsappService.sendText(jid, VAGUE_EDIT_MESSAGE);
                return;
            }

            const mealType = extraction.meal_type ?? target.meal_type;

            try {
                await this.mealsRepository.updateById(target.id, {
                    meal_type: mealType,
                    description: extraction.description,
                    calories: extraction.calories,
                    protein: extraction.protein,
                    carbs: extraction.carbs,
                    fat: extraction.fat,
                });
            } catch (err) {
                this.logger.error(`Falha ao atualizar refeição ${target.id} do user ${user.id}: ${(err as Error).message}`);
                await this.whatsappService.sendText(jid, MEAL_TECH_ERROR_EDIT);
                return;
            }

            await this.whatsappService.sendText(jid, formatEditConfirmation(mealType, extraction));
        });
    }

    private async editMealLocal(phone: string, text: string, jid: string) {
        await this.withUser(phone, async (user) => {
            const target = await this.resolveEditTarget(user.id, text, jid);
            if (!target) return;

            const parsed = await this.runParser(buildParserEditMessage(target.description, text));
            if (parsed === null) {
                await this.whatsappService.sendText(jid, MEAL_EDIT_PARSE_FAILED);
                return;
            }
            if (isMealParserClarification(parsed)) {
                await this.whatsappService.sendText(jid, parsed.needs_clarification);
                return;
            }

            const calc = await this.foodsService.calculateWithFallback(parsed.foods);

            if (calc.matched.length === 0 && calc.estimated.length === 0) {
                this.logger.warn(`[local] all items failed on edit for meal=${target.id} foods=${JSON.stringify(parsed.foods.map((f) => f.food))}`);
                await this.whatsappService.sendText(jid, MEAL_EDIT_CALC_FAILED);
                return;
            }

            const mealType = parsed.meal_type ?? target.meal_type;
            const description = describeFromFoods(parsed.foods);
            const extraction: MealExtraction = {
                description,
                calories: calc.totals.kcal,
                protein: calc.totals.p,
                carbs:   calc.totals.c,
                fat:     calc.totals.g,
                meal_type: mealType,
            };

            try {
                await this.mealsRepository.updateById(target.id, {
                    meal_type: mealType,
                    description,
                    calories: extraction.calories,
                    protein:  extraction.protein,
                    carbs:    extraction.carbs,
                    fat:      extraction.fat,
                });
            } catch (err) {
                this.logger.error(`[local] Falha ao atualizar refeição ${target.id} do user ${user.id}: ${(err as Error).message}`);
                await this.whatsappService.sendText(jid, MEAL_TECH_ERROR_EDIT);
                return;
            }

            await this.whatsappService.sendText(jid, formatEditConfirmation(mealType, extraction));
        });
    }

    private async resolveEditTarget(user_id: string, text: string, jid: string): Promise<{ id: string; meal_type: MealType; description: string; calories: number; created_at: Date } | null> {
        const reference = await this.extractMealReference(text);
        if (reference === null) {
            await this.whatsappService.sendText(jid, EDIT_REFERENCE_PARSE_FAILED);
            return null;
        }
        if (isMealReferenceClarification(reference)) {
            await this.whatsappService.sendText(jid, reference.needs_clarification);
            return null;
        }

        const targetDate = startOfDaysAgo(new Date(), reference.days_offset);
        const dateLabel = formatDateLabel(reference.days_offset, targetDate);
        const matches = await this.mealsRepository.findDailyByUserAndType(user_id, targetDate, reference.meal_type);

        if (matches.length === 0) {
            await this.whatsappService.sendText(jid, formatEditNotFound(reference.meal_type, dateLabel));
            return null;
        }

        if (reference.time !== null) {
            const exact = matches.find((m) => formatMealTime(m.created_at) === reference.time);
            if (!exact) {
                await this.whatsappService.sendText(jid, formatEditTimeNotFound(reference.meal_type, reference.time, matches, dateLabel));
                return null;
            }
            return exact;
        }

        if (matches.length === 1) {
            return matches[0];
        }

        await this.whatsappService.sendText(jid, formatEditAmbiguous(reference.meal_type, matches, dateLabel));
        return null;
    }

    async editLast(phone: string, text: string, jid: string) {
        if (this.useLocalCalculator()) {
            return this.editLastLocal(phone, text, jid);
        }
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
                await this.whatsappService.sendText(jid, MEAL_EDIT_PARSE_FAILED);
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
                await this.whatsappService.sendText(jid, MEAL_TECH_ERROR_EDIT);
                return;
            }

            await this.whatsappService.sendText(jid, formatEditConfirmation(mealType, extraction));
        });
    }

    private async registerLocal(phone: string, text: string, jid: string) {
        await this.withUser(phone, async (user) => {
            const cacheKey = normalize(text);
            const cached = cacheKey ? await this.lookupParsedCache(cacheKey) : null;
            const parsed: MealParserResult | null = cached ?? await this.runParser(text);

            if (parsed === null) {
                await this.whatsappService.sendText(jid, MEAL_PARSE_FAILED);
                return;
            }
            if (isMealParserClarification(parsed)) {
                await this.whatsappService.sendText(jid, parsed.needs_clarification);
                return;
            }

            if (!cached && cacheKey) {
                void this.saveParsedCache(cacheKey, parsed);
            } else if (cached) {
                this.logger.log(`[parser] cache-hit key="${cacheKey}"`);
            }

            const calc = await this.foodsService.calculateWithFallback(parsed.foods);

            if (calc.matched.length === 0 && calc.estimated.length === 0) {
                this.logger.warn(`[local] all items failed for user=${user.id} foods=${JSON.stringify(parsed.foods.map((f) => f.food))}`);
                await this.whatsappService.sendText(jid, MEAL_CALC_FAILED);
                return;
            }

            const mealType = parsed.meal_type ?? inferMealTypeByHour(new Date());
            const description = stripMealVerbs(text);
            const extraction: MealExtraction = {
                description,
                calories: calc.totals.kcal,
                protein: calc.totals.p,
                carbs:   calc.totals.c,
                fat:     calc.totals.g,
                meal_type: mealType,
            };

            try {
                await this.mealsRepository.create({
                    user_id: user.id,
                    meal_type: mealType,
                    description,
                    calories: extraction.calories,
                    protein:  extraction.protein,
                    carbs:    extraction.carbs,
                    fat:      extraction.fat,
                });
            } catch (err) {
                this.logger.error(`[local] Falha ao persistir refeição do user ${user.id}: ${(err as Error).message}`);
                await this.whatsappService.sendText(jid, MEAL_TECH_ERROR_REGISTER);
                return;
            }

            if (calc.estimated.length > 0) {
                this.logger.log(`[local] estimated=${calc.estimated.length} items source-mix user=${user.id}`);
            }

            const totalsAfter  = await this.mealsRepository.sumDailyByUser(user.id, new Date());
            const totalsBefore = subtractMeal(totalsAfter, extraction);

            let praise: string;
            if (user.calorie_goal == null && user.protein_goal == null) {
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

    private async editLastLocal(phone: string, text: string, jid: string) {
        await this.withUser(phone, async (user) => {
            const lastMeal = await this.mealsRepository.findLastByUser(user.id);
            if (!lastMeal) {
                await this.whatsappService.sendText(jid, EMPTY_EDIT_MESSAGE);
                return;
            }

            const parsed = await this.runParser(buildParserEditMessage(lastMeal.description, text));
            if (parsed === null) {
                await this.whatsappService.sendText(jid, MEAL_EDIT_PARSE_FAILED);
                return;
            }
            if (isMealParserClarification(parsed)) {
                await this.whatsappService.sendText(jid, parsed.needs_clarification);
                return;
            }

            const calc = await this.foodsService.calculateWithFallback(parsed.foods);

            if (calc.matched.length === 0 && calc.estimated.length === 0) {
                this.logger.warn(`[local] all items failed on edit for meal=${lastMeal.id} foods=${JSON.stringify(parsed.foods.map((f) => f.food))}`);
                await this.whatsappService.sendText(jid, MEAL_EDIT_CALC_FAILED);
                return;
            }

            const mealType = parsed.meal_type ?? lastMeal.meal_type;
            const description = describeFromFoods(parsed.foods);
            const extraction: MealExtraction = {
                description,
                calories: calc.totals.kcal,
                protein: calc.totals.p,
                carbs:   calc.totals.c,
                fat:     calc.totals.g,
                meal_type: mealType,
            };

            try {
                await this.mealsRepository.updateById(lastMeal.id, {
                    meal_type: mealType,
                    description,
                    calories: extraction.calories,
                    protein:  extraction.protein,
                    carbs:    extraction.carbs,
                    fat:      extraction.fat,
                });
            } catch (err) {
                this.logger.error(`[local] Falha ao atualizar refeição ${lastMeal.id} do user ${user.id}: ${(err as Error).message}`);
                await this.whatsappService.sendText(jid, MEAL_TECH_ERROR_EDIT);
                return;
            }

            await this.whatsappService.sendText(jid, formatEditConfirmation(mealType, extraction));
        });
    }

    private async runParser(content: string): Promise<MealParserResult | null> {
        try {
            const reply = await this.aiService.chat(
                [{ role: 'user', content }],
                { responseFormat: 'json', systemPrompt: MEAL_PARSER_PROMPT, temperature: 0.2 },
            );
            return validateMealParserResult(JSON.parse(reply));
        } catch (err) {
            this.logger.warn(`[local] parser falhou: ${(err as Error).message}`);
            return null;
        }
    }

    private async lookupParsedCache(cacheKey: string): Promise<MealParserResult | null> {
        try {
            const cached = await this.parsedMessagesRepository.findByText(cacheKey);
            if (!cached) return null;
            return validateMealParserResult({
                foods:     cached.foods,
                meal_type: cached.meal_type,
            });
        } catch (err) {
            this.logger.warn(`[parser] cache-lookup-fail: ${(err as Error).message}`);
            return null;
        }
    }

    private async saveParsedCache(cacheKey: string, parsed: MealParserResult): Promise<void> {
        if (isMealParserClarification(parsed)) return;
        try {
            await this.parsedMessagesRepository.upsert({
                normalized_text: cacheKey,
                foods:           parsed.foods,
                meal_type:       parsed.meal_type,
            });
        } catch (err) {
            this.logger.warn(`[parser] cache-upsert-fail: ${(err as Error).message}`);
        }
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
