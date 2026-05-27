import { FoodEntry, Nutrition, Unit } from './food.types';
import { matchFood } from './food.matcher';

export type CalculationItem = {
  food: string;
  quantity: number;
  unit: string;
};

export type MatchedItem = {
  input: CalculationItem;
  food: FoodEntry;
  matched_alias: string;
  grams: number;
  macros: Nutrition;
};

export type UnmatchedReason = 'food_not_found' | 'unit_not_supported';

export type UnmatchedItem = {
  input: CalculationItem;
  reason: UnmatchedReason;
};

export type CalculationResult = {
  totals: Nutrition;
  matched: MatchedItem[];
  unmatched: UnmatchedItem[];
};

const EMPTY_NUTRITION: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0 };

function addNutrition(accumulated: Nutrition, nutrition: Nutrition): Nutrition {
  return {
    calories: accumulated.calories + nutrition.calories,
    protein:  accumulated.protein  + nutrition.protein,
    carbs:    accumulated.carbs    + nutrition.carbs,
    fat:      accumulated.fat      + nutrition.fat,
  };
}

function scaleNutrition(per100g: Nutrition, grams: number): Nutrition {
  const factor = grams / 100;
  return {
    calories: per100g.calories * factor,
    protein:  per100g.protein  * factor,
    carbs:    per100g.carbs    * factor,
    fat:      per100g.fat      * factor,
  };
}

export function roundNutrition(nutrition: Nutrition): Nutrition {
  return {
    calories: Math.round(nutrition.calories),
    protein:  Math.round(nutrition.protein),
    carbs:    Math.round(nutrition.carbs),
    fat:      nutrition.fat < 5 ? Math.round(nutrition.fat * 10) / 10 : Math.round(nutrition.fat),
  };
}

export function calculateMacros(items: CalculationItem[], catalog: FoodEntry[]): CalculationResult {
  const matched:   MatchedItem[]   = [];
  const unmatched: UnmatchedItem[] = [];
  let runningTotals: Nutrition = EMPTY_NUTRITION;

  for (const item of items) {
    const matchResult = matchFood(item.food, catalog);
    if (!matchResult) {
      unmatched.push({ input: item, reason: 'food_not_found' });
      continue;
    }

    const conversion = matchResult.food.units[item.unit as Unit];
    if (!conversion) {
      unmatched.push({ input: item, reason: 'unit_not_supported' });
      continue;
    }

    const grams  = item.quantity * conversion.grams;
    const macros = scaleNutrition(matchResult.food.per_100g, grams);

    matched.push({
      input:         item,
      food:          matchResult.food,
      matched_alias: matchResult.matched_alias,
      grams,
      macros,
    });

    runningTotals = addNutrition(runningTotals, macros);
  }

  return {
    totals: roundNutrition(runningTotals),
    matched,
    unmatched,
  };
}
