import { MealType } from '@prisma/client';
import { MealExtraction } from '../ai/meal.prompt';

const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Café',
  LUNCH:     'Almoço',
  DINNER:    'Jantar',
  SNACK:     'Lanche',
};

export function formatMealConfirmation(mealType: MealType, extraction: MealExtraction, praise: string): string {
  const label = MEAL_LABELS[mealType];
  return [
    `✓ ${label} — ${extraction.calories}kcal`,
    `🥩 P: ${extraction.protein}g`,
    `🍚 C: ${extraction.carbs}g`,
    `🧈 G: ${extraction.fat}g`,
    praise,
  ].join('\n');
}
