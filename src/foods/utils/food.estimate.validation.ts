import { FoodEstimate } from './food.estimate.prompt';

const RANGES = {
  kcal:    { min: 0, max: 2000 },
  protein: { min: 0, max: 200  },
  carbs:   { min: 0, max: 200  },
  fat:     { min: 0, max: 200  },
} as const;

const FIELDS = ['kcal', 'protein', 'carbs', 'fat'] as const;

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
  return estimate.kcal === 0 && estimate.protein === 0 && estimate.carbs === 0 && estimate.fat === 0;
}

export function validateFoodEstimate(raw: unknown): FoodEstimate {
  if (raw === null || typeof raw !== 'object') {
    throw new InvalidFoodEstimateError('payload is not an object');
  }
  const r = raw as Record<string, unknown>;

  for (const field of FIELDS) {
    const { min, max } = RANGES[field];
    if (!isFiniteInRange(r[field], min, max)) {
      throw new InvalidFoodEstimateError(
        `${field} must be a finite number in [${min}, ${max}] (got ${JSON.stringify(r[field])})`,
      );
    }
  }

  return {
    kcal:    r.kcal    as number,
    protein: r.protein as number,
    carbs:   r.carbs   as number,
    fat:     r.fat     as number,
  };
}
