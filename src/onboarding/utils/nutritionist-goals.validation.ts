import { NutritionistGoalsResult } from './nutritionist-goals.prompt';

const RANGES = {
  calorie: { min: 800,  max: 5000 },
  protein: { min: 30,   max: 400  },
  carbs:   { min: 30,   max: 700  },
  fat:     { min: 20,   max: 300  },
} as const;

export class InvalidNutritionistGoalsError extends Error {
  constructor(reason: string) {
    super(`Invalid nutritionist goals: ${reason}`);
    this.name = 'InvalidNutritionistGoalsError';
  }
}

function isFiniteInRange(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

export function validateNutritionistGoals(raw: unknown): NutritionistGoalsResult {
  if (raw === null || typeof raw !== 'object') {
    throw new InvalidNutritionistGoalsError('payload is not an object');
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.needs_clarification === 'string' && r.needs_clarification.trim() !== '') {
    return { needs_clarification: r.needs_clarification.trim() };
  }

  for (const field of ['calorie', 'protein', 'carbs', 'fat'] as const) {
    const { min, max } = RANGES[field];
    if (!isFiniteInRange(r[field], min, max)) {
      throw new InvalidNutritionistGoalsError(
        `${field} must be a finite number in [${min}, ${max}] (got ${JSON.stringify(r[field])})`,
      );
    }
  }

  return {
    calorie: Math.round(r.calorie as number),
    protein: Math.round(r.protein as number),
    carbs:   Math.round(r.carbs   as number),
    fat:     Math.round(r.fat     as number),
  };
}
