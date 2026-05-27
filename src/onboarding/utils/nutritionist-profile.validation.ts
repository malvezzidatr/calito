import { NutritionistProfileResult } from './nutritionist-profile.prompt';
import { InvalidNutritionistProfileError } from '../exceptions/onboarding.errors';

const RANGES = {
  weight: { min: 20,  max: 350 },
  height: { min: 100, max: 250 },
  age:    { min: 13,  max: 90  },
} as const;

const GENDERS = ['MALE', 'FEMALE'] as const;
type GenderEnum = typeof GENDERS[number];

function isFiniteInRange(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

export function validateNutritionistProfile(rawInput: unknown): NutritionistProfileResult {
  if (rawInput === null || typeof rawInput !== 'object') {
    throw new InvalidNutritionistProfileError('payload is not an object');
  }
  const raw = rawInput as Record<string, unknown>;

  if (typeof raw.needs_clarification === 'string' && raw.needs_clarification.trim() !== '') {
    return { needs_clarification: raw.needs_clarification.trim() };
  }

  for (const field of ['weight', 'height'] as const) {
    const { min, max } = RANGES[field];
    if (!isFiniteInRange(raw[field], min, max)) {
      throw new InvalidNutritionistProfileError(
        `${field} must be a finite number in [${min}, ${max}] (got ${JSON.stringify(raw[field])})`,
      );
    }
  }

  const ageValue = raw.age;
  const { min: ageMin, max: ageMax } = RANGES.age;
  if (!isFiniteInRange(ageValue, ageMin, ageMax) || !Number.isInteger(ageValue)) {
    throw new InvalidNutritionistProfileError(
      `age must be an integer in [${ageMin}, ${ageMax}] (got ${JSON.stringify(ageValue)})`,
    );
  }

  if (!GENDERS.includes(raw.gender as GenderEnum)) {
    throw new InvalidNutritionistProfileError(
      `gender must be one of ${GENDERS.join('|')} (got ${JSON.stringify(raw.gender)})`,
    );
  }

  return {
    weight: raw.weight as number,
    height: Math.round(raw.height as number),
    age:    raw.age    as number,
    gender: raw.gender as GenderEnum,
  };
}
