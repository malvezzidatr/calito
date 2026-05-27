import { MealReferenceResult } from './meal-reference.prompt';
import { InvalidMealReferenceError } from '../exceptions/meals.errors';

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;
type MealTypeEnum = typeof MEAL_TYPES[number];

const HOUR_MINUTE_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function validateMealReference(rawInput: unknown): MealReferenceResult {
  if (rawInput === null || typeof rawInput !== 'object') {
    throw new InvalidMealReferenceError('payload is not an object');
  }
  const raw = rawInput as Record<string, unknown>;

  if (typeof raw.needs_clarification === 'string' && raw.needs_clarification.trim() !== '') {
    return { needs_clarification: raw.needs_clarification.trim() };
  }

  if (!MEAL_TYPES.includes(raw.meal_type as MealTypeEnum)) {
    throw new InvalidMealReferenceError(
      `meal_type must be one of ${MEAL_TYPES.join('|')} (got ${JSON.stringify(raw.meal_type)})`,
    );
  }

  let time: string | null = null;
  if (raw.time !== null && raw.time !== undefined) {
    if (typeof raw.time !== 'string' || !HOUR_MINUTE_PATTERN.test(raw.time)) {
      throw new InvalidMealReferenceError(
        `time must be 'HH:MM' 24h or null (got ${JSON.stringify(raw.time)})`,
      );
    }
    time = raw.time;
  }

  const offsetRaw = raw.days_offset ?? 0;
  if (typeof offsetRaw !== 'number' || !Number.isInteger(offsetRaw) || offsetRaw < 0 || offsetRaw > 90) {
    throw new InvalidMealReferenceError(
      `days_offset must be an integer in [0, 90] (got ${JSON.stringify(raw.days_offset)})`,
    );
  }

  return {
    meal_type:   raw.meal_type as MealTypeEnum,
    time,
    days_offset: offsetRaw,
  };
}
