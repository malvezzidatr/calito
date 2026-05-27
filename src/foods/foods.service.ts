import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FoodCategory, FoodEntry } from './utils/food.types';
import { validateFoodCatalog } from './utils/food.validation';
import { matchFood, MatchResult } from './utils/food.matcher';
import { calculateMacros, CalculationItem, CalculationResult, roundNutrition } from './utils/food.calculator';
import { FoodEstimator, EstimateRunResult } from './food.estimator';
import { Nutrition } from './utils/food.types';
import foodsData from './data/foods.json';

export type CalculationWithFallbackResult = CalculationResult & {
  estimated: EstimateRunResult['estimated'];
  failed:    EstimateRunResult['failed'];
};

@Injectable()
export class FoodsService implements OnModuleInit {
  private readonly logger = new Logger(FoodsService.name);
  private readonly catalog: Map<string, FoodEntry> = new Map();

  constructor(private readonly estimator: FoodEstimator) {}

  onModuleInit() {
    const entries = validateFoodCatalog(foodsData);

    for (const entry of entries) {
      this.catalog.set(entry.id, entry);
    }

    this.logger.log(`Catálogo carregado: ${entries.length} alimentos`);
  }

  getById(id: string): FoodEntry | null {
    return this.catalog.get(id) ?? null;
  }

  getAll(): FoodEntry[] {
    return Array.from(this.catalog.values());
  }

  getByCategory(category: FoodCategory): FoodEntry[] {
    return this.getAll().filter((entry) => entry.category === category);
  }

  size(): number {
    return this.catalog.size;
  }

  match(input: string): MatchResult | null {
    return matchFood(input, this.getAll());
  }

  calculate(items: CalculationItem[]): CalculationResult {
    return calculateMacros(items, this.getAll());
  }

  async calculateWithFallback(items: CalculationItem[]): Promise<CalculationWithFallbackResult> {
    const local = this.calculate(items);
    const fallback = await this.estimator.estimate(local.unmatched);

    const totals: Nutrition = {
      calories: local.totals.calories,
      protein:  local.totals.protein,
      carbs:    local.totals.carbs,
      fat:      local.totals.fat,
    };
    for (const item of fallback.estimated) {
      totals.calories += item.macros_contribution.calories;
      totals.protein  += item.macros_contribution.protein;
      totals.carbs    += item.macros_contribution.carbs;
      totals.fat      += item.macros_contribution.fat;
    }

    return {
      totals: roundNutrition(totals),
      matched:   local.matched,
      unmatched: local.unmatched,
      estimated: fallback.estimated,
      failed:    fallback.failed,
    };
  }
}
