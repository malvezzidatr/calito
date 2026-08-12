import { MealExtractionResult } from './meal.prompt';
import { InvalidMealExtractionError } from '../exceptions/meals.errors';

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;
type MealTypeEnum = typeof MEAL_TYPES[number];

// Teto plausível pra uma refeição inteira (soma de vários itens) — CS-127.
// Sem isso, uma alucinação do LLM (ex.: calories: 1e15) passava direto e
// era persistida em Meal, além do cache global (EstimatedFood/ParsedMessageCache).
const MAX_MEAL_CALORIES = 20_000;
const MAX_MEAL_MACRO_GRAMS = 2_000;

function isFiniteInRange(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

export function validateMealExtraction(rawInput: unknown): MealExtractionResult {
  if (rawInput === null || typeof rawInput !== 'object') {
    throw new InvalidMealExtractionError('payload is not an object');
  }
  const raw = rawInput as Record<string, unknown>;

  if (typeof raw.needs_clarification === 'string' && raw.needs_clarification.trim() !== '') {
    return { needs_clarification: raw.needs_clarification.trim() };
  }

  if (typeof raw.description !== 'string' || raw.description.trim() === '') {
    throw new InvalidMealExtractionError('description must be a non-empty string');
  }

  const max: Record<'calories' | 'protein' | 'carbs' | 'fat', number> = {
    calories: MAX_MEAL_CALORIES,
    protein: MAX_MEAL_MACRO_GRAMS,
    carbs: MAX_MEAL_MACRO_GRAMS,
    fat: MAX_MEAL_MACRO_GRAMS,
  };

  for (const field of ['calories', 'protein', 'carbs', 'fat'] as const) {
    if (!isFiniteInRange(raw[field], 0, max[field])) {
      throw new InvalidMealExtractionError(
        `${field} must be a finite number in [0, ${max[field]}] (got ${JSON.stringify(raw[field])})`,
      );
    }
  }

  if (raw.meal_type !== null && !MEAL_TYPES.includes(raw.meal_type as MealTypeEnum)) {
    throw new InvalidMealExtractionError(
      `meal_type must be one of ${MEAL_TYPES.join('|')} or null (got ${JSON.stringify(raw.meal_type)})`,
    );
  }

  return {
    description: raw.description.trim(),
    calories:    raw.calories as number,
    protein:     raw.protein  as number,
    carbs:       raw.carbs    as number,
    fat:         raw.fat      as number,
    meal_type:   raw.meal_type as 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | null,
  };
}
