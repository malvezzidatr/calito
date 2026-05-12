import { MealExtraction } from '../ai/meal.prompt';

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;
type MealTypeEnum = typeof MEAL_TYPES[number];

export class InvalidMealExtractionError extends Error {
  constructor(reason: string) {
    super(`Invalid meal extraction: ${reason}`);
    this.name = 'InvalidMealExtractionError';
  }
}

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

export function validateMealExtraction(raw: unknown): MealExtraction {
  if (raw === null || typeof raw !== 'object') {
    throw new InvalidMealExtractionError('payload is not an object');
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.description !== 'string' || r.description.trim() === '') {
    throw new InvalidMealExtractionError('description must be a non-empty string');
  }

  for (const field of ['calories', 'protein', 'carbs', 'fat'] as const) {
    if (!isFiniteNonNegative(r[field])) {
      throw new InvalidMealExtractionError(
        `${field} must be a non-negative finite number (got ${JSON.stringify(r[field])})`,
      );
    }
  }

  if (r.meal_type !== null && !MEAL_TYPES.includes(r.meal_type as MealTypeEnum)) {
    throw new InvalidMealExtractionError(
      `meal_type must be one of ${MEAL_TYPES.join('|')} or null (got ${JSON.stringify(r.meal_type)})`,
    );
  }

  return {
    description: r.description.trim(),
    calories: r.calories as number,
    protein: r.protein as number,
    carbs: r.carbs as number,
    fat: r.fat as number,
    meal_type: r.meal_type as MealExtraction['meal_type'],
  };
}
