import { FoodEstimate } from './food.estimate.prompt';

const RANGES = {
  calories: { min: 0, max: 2000 },
  protein:  { min: 0, max: 200  },
  carbs:    { min: 0, max: 200  },
  fat:      { min: 0, max: 200  },
} as const;

const FIELDS = ['calories', 'protein', 'carbs', 'fat'] as const;

export class InvalidFoodEstimateError extends Error {
  constructor(reason: string) {
    super(`Invalid food estimate: ${reason}`);
    this.name = 'InvalidFoodEstimateError';
  }
}

function isFiniteInRange(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

export function isZeroEstimate(estimate: FoodEstimate): boolean {
  return estimate.calories === 0 && estimate.protein === 0 && estimate.carbs === 0 && estimate.fat === 0;
}

export function validateFoodEstimate(rawInput: unknown): FoodEstimate {
  if (rawInput === null || typeof rawInput !== 'object') {
    throw new InvalidFoodEstimateError('payload is not an object');
  }
  const raw = rawInput as Record<string, unknown>;

  for (const field of FIELDS) {
    const { min, max } = RANGES[field];
    if (!isFiniteInRange(raw[field], min, max)) {
      throw new InvalidFoodEstimateError(
        `${field} must be a finite number in [${min}, ${max}] (got ${JSON.stringify(raw[field])})`,
      );
    }
  }

  return {
    calories: raw.calories as number,
    protein:  raw.protein  as number,
    carbs:    raw.carbs    as number,
    fat:      raw.fat      as number,
  };
}
