import { Injectable, Logger } from '@nestjs/common';
import { MealsRepository } from './meals.repository';
import { AiService } from '../ai/ai.service';
import { UsersRepository } from '../users/users.repository';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { MEAL_EXTRACTION_PROMPT, MealExtraction } from '../ai/meal.prompt';
import { MealType } from '@prisma/client';

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
            extraction = JSON.parse(reply);
        } catch (err) {
            this.logger.warn(`Falha ao extrair refeição: ${(err as Error).message}`);
            await this.whatsappService.sendText(jid, 'Não consegui entender essa refeição 🤔 Pode mandar de novo com mais detalhe?');
            return;
        }
        
        const mealType = extraction.meal_type ?? this.inferMealTypeByHour(new Date());

        await this.mealsRepository.create({
            user_id: user.id,
            meal_type: mealType,
            description: extraction.description,
            calories: extraction.calories,
            protein: extraction.protein,
            carbs: extraction.carbs,
            fat: extraction.fat,
        });

        const message = formatMealConfirmation(mealType, extraction);
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

const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Café',
  LUNCH:     'Almoço',
  DINNER:    'Jantar',
  SNACK:     'Lanche',
};

const PROTEIN_PRAISES = [
  'Bastante proteína nessa, mandou bem! 🥩',
  'Boa! Seus músculos agradecem 💪',
  'Refeição proteica, top! 🔥',
  'Show, proteína no talo 💪🥩',
];

const CARB_PRAISES = [
  'Energia no talo! Bora gastar essa gasolina 🚀',
  'Carboidrato pra mover, anotado 🍚',
  'Boa pra antes do treino! 💪',
  'Combustível pro dia, mandou bem 🔥',
];

const BALANCED_PRAISES = [
  'Refeição equilibrada, mandou bem! 💪',
  'Show! Macros bem distribuídos 🎯',
  'Tá afiado! Boa combinação 🔥',
  'Boa, tudo no lugar 👌',
  'Mandou bem, anotado 📝',
];

const HEAVY_PRAISES = [
  'Anotado! Hoje foi mais reforçado 👀',
  'Beleza, registrei tudo 📝',
  'Refeição mais densa, anotei 👌',
  'Registrado! Fica de olho na meta do dia 🎯',
  'Anotado, refeição cheia 📝',
];

const HEAVY_THRESHOLD = 700;

export function pickPraise(extraction: MealExtraction): string {
  const totalKcal = extraction.calories || 1;

  let pool: readonly string[];
  if (totalKcal >= HEAVY_THRESHOLD) {
    pool = HEAVY_PRAISES;
  } else {
    const proteinPct = (extraction.protein * 4) / totalKcal;
    const carbsPct = (extraction.carbs * 4) / totalKcal;
    if (proteinPct >= 0.40) pool = PROTEIN_PRAISES;
    else if (carbsPct >= 0.55) pool = CARB_PRAISES;
    else pool = BALANCED_PRAISES;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

export function formatMealConfirmation(mealType: MealType, extraction: MealExtraction): string {
  const label = MEAL_LABELS[mealType];
  return [
    `✓ ${label} — ${extraction.calories}kcal`,
    `🥩 P: ${extraction.protein}g`,
    `🍚 C: ${extraction.carbs}g`,
    `🧈 G: ${extraction.fat}g`,
    pickPraise(extraction),
  ].join('\n');
}
