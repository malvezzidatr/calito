import { MealReferenceResult } from './meal-reference.prompt';

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;
type MealTypeEnum = typeof MEAL_TYPES[number];

const HOUR_MINUTE_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class InvalidMealReferenceError extends Error {
  constructor(reason: string) {
    super(`Invalid meal reference: ${reason}`);
    this.name = 'InvalidMealReferenceError';
  }
}

export function validateMealReference(raw: unknown): MealReferenceResult {
  if (raw === null || typeof raw !== 'object') {
    throw new InvalidMealReferenceError('payload is not an object');
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.needs_clarification === 'string' && r.needs_clarification.trim() !== '') {
    return { needs_clarification: r.needs_clarification.trim() };
  }

  if (!MEAL_TYPES.includes(r.meal_type as MealTypeEnum)) {
    throw new InvalidMealReferenceError(
      `meal_type must be one of ${MEAL_TYPES.join('|')} (got ${JSON.stringify(r.meal_type)})`,
    );
  }

  let time: string | null = null;
  if (r.time !== null && r.time !== undefined) {
    if (typeof r.time !== 'string' || !HOUR_MINUTE_PATTERN.test(r.time)) {
      throw new InvalidMealReferenceError(
        `time must be 'HH:MM' 24h or null (got ${JSON.stringify(r.time)})`,
      );
    }
    time = r.time;
  }

  const offsetRaw = r.days_offset ?? 0;
  if (typeof offsetRaw !== 'number' || !Number.isInteger(offsetRaw) || offsetRaw < 0 || offsetRaw > 90) {
    throw new InvalidMealReferenceError(
      `days_offset must be an integer in [0, 90] (got ${JSON.stringify(r.days_offset)})`,
    );
  }

  return {
    meal_type:   r.meal_type as MealTypeEnum,
    time,
    days_offset: offsetRaw,
  };
}
