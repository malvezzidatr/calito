import { NutritionistGoalsResult } from './nutritionist-goals.prompt';
import { InvalidNutritionistGoalsError } from '../exceptions/onboarding.errors';

const RANGES = {
  calorie: { min: 800, max: 5000 },
  protein: { min: 30,  max: 400  },
  carbs:   { min: 30,  max: 700  },
  fat:     { min: 20,  max: 300  },
} as const;

function isFiniteInRange(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

export function validateNutritionistGoals(rawInput: unknown): NutritionistGoalsResult {
  if (rawInput === null || typeof rawInput !== 'object') {
    throw new InvalidNutritionistGoalsError('payload is not an object');
  }
  const raw = rawInput as Record<string, unknown>;

  if (typeof raw.needs_clarification === 'string' && raw.needs_clarification.trim() !== '') {
    return { needs_clarification: raw.needs_clarification.trim() };
  }

  for (const field of ['calorie', 'protein', 'carbs', 'fat'] as const) {
    const { min, max } = RANGES[field];
    if (!isFiniteInRange(raw[field], min, max)) {
      throw new InvalidNutritionistGoalsError(
        `${field} must be a finite number in [${min}, ${max}] (got ${JSON.stringify(raw[field])})`,
      );
    }
  }

  return {
    calorie: Math.round(raw.calorie as number),
    protein: Math.round(raw.protein as number),
    carbs:   Math.round(raw.carbs   as number),
    fat:     Math.round(raw.fat     as number),
  };
}
