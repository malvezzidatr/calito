import { Unit } from '../../foods/utils/food.types';
import { MealParserResult, MealType, ParsedFood } from './meal.parser.prompt';
import { InvalidMealParserError } from '../exceptions/meals.errors';

const VALID_UNITS = Object.values(Unit);
const VALID_MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

function isPositiveFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function validateParsedFood(rawInput: unknown, index: number): ParsedFood {
  if (rawInput === null || typeof rawInput !== 'object') {
    throw new InvalidMealParserError(`foods[${index}] must be an object`);
  }
  const raw = rawInput as Record<string, unknown>;

  if (typeof raw.food !== 'string' || raw.food.trim() === '') {
    throw new InvalidMealParserError(`foods[${index}].food must be a non-empty string (got ${JSON.stringify(raw.food)})`);
  }

  if (!isPositiveFinite(raw.quantity)) {
    throw new InvalidMealParserError(`foods[${index}].quantity must be a positive finite number (got ${JSON.stringify(raw.quantity)})`);
  }

  if (!VALID_UNITS.includes(raw.unit as Unit)) {
    throw new InvalidMealParserError(
      `foods[${index}].unit must be one of ${VALID_UNITS.join('|')} (got ${JSON.stringify(raw.unit)})`,
    );
  }

  return {
    food:     raw.food.trim().toLowerCase(),
    quantity: raw.quantity,
    unit:     raw.unit as Unit,
  };
}

export function validateMealParserResult(rawInput: unknown): MealParserResult {
  if (rawInput === null || typeof rawInput !== 'object') {
    throw new InvalidMealParserError('payload is not an object');
  }
  const raw = rawInput as Record<string, unknown>;

  if (typeof raw.needs_clarification === 'string' && raw.needs_clarification.trim() !== '') {
    return { needs_clarification: raw.needs_clarification.trim() };
  }

  if (!Array.isArray(raw.foods)) {
    throw new InvalidMealParserError(`foods must be an array (got ${JSON.stringify(raw.foods)})`);
  }
  if (raw.foods.length === 0) {
    throw new InvalidMealParserError('foods must have at least one item');
  }

  const foods = raw.foods.map((item, index) => validateParsedFood(item, index));

  let mealType: MealType | null = null;
  if (raw.meal_type !== null && raw.meal_type !== undefined) {
    if (!VALID_MEAL_TYPES.includes(raw.meal_type as MealType)) {
      throw new InvalidMealParserError(
        `meal_type must be one of ${VALID_MEAL_TYPES.join('|')} or null (got ${JSON.stringify(raw.meal_type)})`,
      );
    }
    mealType = raw.meal_type as MealType;
  }

  return { foods, meal_type: mealType };
}
