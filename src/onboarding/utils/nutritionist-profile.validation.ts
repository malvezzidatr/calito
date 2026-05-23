import { NutritionistProfileResult } from './nutritionist-profile.prompt';

const RANGES = {
  weight: { min: 20,  max: 350 },
  height: { min: 100, max: 250 },
  age:    { min: 13,  max: 90  },
} as const;

const GENDERS = ['MALE', 'FEMALE'] as const;
type GenderEnum = typeof GENDERS[number];

export class InvalidNutritionistProfileError extends Error {
  constructor(reason: string) {
    super(`Invalid nutritionist profile: ${reason}`);
    this.name = 'InvalidNutritionistProfileError';
  }
}

function isFiniteInRange(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

export function validateNutritionistProfile(raw: unknown): NutritionistProfileResult {
  if (raw === null || typeof raw !== 'object') {
    throw new InvalidNutritionistProfileError('payload is not an object');
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.needs_clarification === 'string' && r.needs_clarification.trim() !== '') {
    return { needs_clarification: r.needs_clarification.trim() };
  }

  for (const field of ['weight', 'height'] as const) {
    const { min, max } = RANGES[field];
    if (!isFiniteInRange(r[field], min, max)) {
      throw new InvalidNutritionistProfileError(
        `${field} must be a finite number in [${min}, ${max}] (got ${JSON.stringify(r[field])})`,
      );
    }
  }

  const ageValue = r.age;
  const { min: ageMin, max: ageMax } = RANGES.age;
  if (!isFiniteInRange(ageValue, ageMin, ageMax) || !Number.isInteger(ageValue)) {
    throw new InvalidNutritionistProfileError(
      `age must be an integer in [${ageMin}, ${ageMax}] (got ${JSON.stringify(ageValue)})`,
    );
  }

  if (!GENDERS.includes(r.gender as GenderEnum)) {
    throw new InvalidNutritionistProfileError(
      `gender must be one of ${GENDERS.join('|')} (got ${JSON.stringify(r.gender)})`,
    );
  }

  return {
    weight: r.weight as number,
    height: Math.round(r.height as number),
    age:    r.age    as number,
    gender: r.gender as GenderEnum,
  };
}
