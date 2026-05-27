import { MealExtractionResult } from './meal.prompt';
import { InvalidMealExtractionError } from '../exceptions/meals.errors';

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;
type MealTypeEnum = typeof MEAL_TYPES[number];

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
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

  for (const field of ['calories', 'protein', 'carbs', 'fat'] as const) {
    if (!isFiniteNonNegative(raw[field])) {
      throw new InvalidMealExtractionError(
        `${field} must be a non-negative finite number (got ${JSON.stringify(raw[field])})`,
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
