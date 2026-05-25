import { Unit } from '../../foods/utils/food.types';
import { MealParserResult, MealType, ParsedFood } from './meal.parser.prompt';

const VALID_UNITS = Object.values(Unit);
const VALID_MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

export class InvalidMealParserError extends Error {
  constructor(reason: string) {
    super(`Invalid meal parser output: ${reason}`);
    this.name = 'InvalidMealParserError';
  }
}

function isPositiveFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function validateParsedFood(raw: unknown, index: number): ParsedFood {
  if (raw === null || typeof raw !== 'object') {
    throw new InvalidMealParserError(`foods[${index}] must be an object`);
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.food !== 'string' || r.food.trim() === '') {
    throw new InvalidMealParserError(`foods[${index}].food must be a non-empty string (got ${JSON.stringify(r.food)})`);
  }

  if (!isPositiveFinite(r.quantity)) {
    throw new InvalidMealParserError(`foods[${index}].quantity must be a positive finite number (got ${JSON.stringify(r.quantity)})`);
  }

  if (!VALID_UNITS.includes(r.unit as Unit)) {
    throw new InvalidMealParserError(
      `foods[${index}].unit must be one of ${VALID_UNITS.join('|')} (got ${JSON.stringify(r.unit)})`,
    );
  }

  return {
    food:     r.food.trim().toLowerCase(),
    quantity: r.quantity,
    unit:     r.unit as Unit,
  };
}

export function validateMealParserResult(raw: unknown): MealParserResult {
  if (raw === null || typeof raw !== 'object') {
    throw new InvalidMealParserError('payload is not an object');
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.needs_clarification === 'string' && r.needs_clarification.trim() !== '') {
    return { needs_clarification: r.needs_clarification.trim() };
  }

  if (!Array.isArray(r.foods)) {
    throw new InvalidMealParserError(`foods must be an array (got ${JSON.stringify(r.foods)})`);
  }
  if (r.foods.length === 0) {
    throw new InvalidMealParserError('foods must have at least one item');
  }

  const foods = r.foods.map((item, index) => validateParsedFood(item, index));

  let mealType: MealType | null = null;
  if (r.meal_type !== null && r.meal_type !== undefined) {
    if (!VALID_MEAL_TYPES.includes(r.meal_type as MealType)) {
      throw new InvalidMealParserError(
        `meal_type must be one of ${VALID_MEAL_TYPES.join('|')} or null (got ${JSON.stringify(r.meal_type)})`,
      );
    }
    mealType = r.meal_type as MealType;
  }

  return { foods, meal_type: mealType };
}
