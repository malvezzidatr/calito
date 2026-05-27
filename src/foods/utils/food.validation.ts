import { FoodCategory, FoodEntry, Nutrition, Unit } from './food.types';

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VALID_CATEGORIES = Object.values(FoodCategory);
const VALID_UNITS = Object.values(Unit);
const NUTRITION_FIELDS = ['calories', 'protein', 'carbs', 'fat'] as const;

export class InvalidFoodEntryError extends Error {
  constructor(reason: string) {
    super(`Invalid food entry: ${reason}`);
    this.name = 'InvalidFoodEntryError';
  }
}

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

function isPositiveFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function isLowercase(s: string): boolean {
  return s === s.toLowerCase();
}

function validateNutrition(rawInput: unknown, path: string): Nutrition {
  if (rawInput === null || typeof rawInput !== 'object') {
    throw new InvalidFoodEntryError(`${path} must be an object`);
  }
  const raw = rawInput as Record<string, unknown>;
  for (const field of NUTRITION_FIELDS) {
    if (!isFiniteNonNegative(raw[field])) {
      throw new InvalidFoodEntryError(
        `${path}.${field} must be a non-negative finite number (got ${JSON.stringify(raw[field])})`,
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

export function validateFoodEntry(rawInput: unknown): FoodEntry {
  if (rawInput === null || typeof rawInput !== 'object') {
    throw new InvalidFoodEntryError('payload is not an object');
  }
  const raw = rawInput as Record<string, unknown>;

  if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) {
    throw new InvalidFoodEntryError(`id must be a kebab-case lowercase slug (got ${JSON.stringify(raw.id)})`);
  }
  const id = raw.id;

  if (typeof raw.name !== 'string' || raw.name.trim() === '') {
    throw new InvalidFoodEntryError(`${id}.name must be a non-empty string`);
  }

  if (!Array.isArray(raw.aliases)) {
    throw new InvalidFoodEntryError(`${id}.aliases must be an array`);
  }
  if (raw.aliases.length < 2) {
    throw new InvalidFoodEntryError(`${id}.aliases must have at least 2 entries`);
  }
  for (const alias of raw.aliases) {
    if (typeof alias !== 'string' || alias.trim() === '') {
      throw new InvalidFoodEntryError(`${id}.aliases must contain non-empty strings (got ${JSON.stringify(alias)})`);
    }
    if (!isLowercase(alias)) {
      throw new InvalidFoodEntryError(`${id}.aliases must be lowercase (got ${JSON.stringify(alias)})`);
    }
  }

  if (!VALID_CATEGORIES.includes(raw.category as FoodCategory)) {
    throw new InvalidFoodEntryError(
      `${id}.category must be one of ${VALID_CATEGORIES.join('|')} (got ${JSON.stringify(raw.category)})`,
    );
  }

  if (!VALID_UNITS.includes(raw.default_unit as Unit)) {
    throw new InvalidFoodEntryError(
      `${id}.default_unit must be one of ${VALID_UNITS.join('|')} (got ${JSON.stringify(raw.default_unit)})`,
    );
  }

  const per100g = validateNutrition(raw.per_100g, `${id}.per_100g`);

  if (raw.units === null || typeof raw.units !== 'object') {
    throw new InvalidFoodEntryError(`${id}.units must be an object`);
  }
  const unitsRaw = raw.units as Record<string, unknown>;
  const unitKeys = Object.keys(unitsRaw);
  if (unitKeys.length === 0) {
    throw new InvalidFoodEntryError(`${id}.units must have at least one entry`);
  }

  const units: Partial<Record<Unit, { grams: number }>> = {};
  for (const key of unitKeys) {
    if (!VALID_UNITS.includes(key as Unit)) {
      throw new InvalidFoodEntryError(
        `${id}.units key must be one of ${VALID_UNITS.join('|')} (got ${JSON.stringify(key)})`,
      );
    }
    const conv = unitsRaw[key];
    if (conv === null || typeof conv !== 'object') {
      throw new InvalidFoodEntryError(`${id}.units.${key} must be an object`);
    }
    const grams = (conv as Record<string, unknown>).grams;
    if (!isPositiveFinite(grams)) {
      throw new InvalidFoodEntryError(
        `${id}.units.${key}.grams must be a positive finite number (got ${JSON.stringify(grams)})`,
      );
    }
    units[key as Unit] = { grams };
  }

  if (!(raw.default_unit as string in units)) {
    throw new InvalidFoodEntryError(
      `${id}.default_unit "${raw.default_unit}" must exist in units (got keys: ${unitKeys.join(',')})`,
    );
  }

  return {
    id,
    name:         raw.name.trim(),
    aliases:      (raw.aliases as string[]).map((alias) => alias.trim()),
    category:     raw.category as FoodCategory,
    default_unit: raw.default_unit as Unit,
    per_100g:     per100g,
    units,
  };
}

export function validateFoodCatalog(rawInput: unknown): FoodEntry[] {
  if (!Array.isArray(rawInput)) {
    throw new InvalidFoodEntryError('catalog must be an array');
  }
  const entries = rawInput.map(validateFoodEntry);

  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) {
      throw new InvalidFoodEntryError(`duplicate id "${entry.id}"`);
    }
    ids.add(entry.id);
  }

  return entries;
}
