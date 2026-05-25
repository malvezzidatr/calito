import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { FoodCategory, FoodEntry } from './utils/food.types';
import { validateFoodCatalog } from './utils/food.validation';
import { matchFood, MatchResult } from './utils/food.matcher';
import { calculateMacros, CalculationItem, CalculationResult } from './utils/food.calculator';
import { FoodEstimator, EstimateRunResult } from './food.estimator';
import { Nutrition } from './utils/food.types';

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
    const path = join(__dirname, 'data', 'foods.json');
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    const entries = validateFoodCatalog(parsed);

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
      kcal: local.totals.kcal,
      p:    local.totals.p,
      c:    local.totals.c,
      g:    local.totals.g,
    };
    for (const item of fallback.estimated) {
      totals.kcal += item.macros_contribution.kcal;
      totals.p    += item.macros_contribution.p;
      totals.c    += item.macros_contribution.c;
      totals.g    += item.macros_contribution.g;
    }

    return {
      totals: roundFinal(totals),
      matched:   local.matched,
      unmatched: local.unmatched,
      estimated: fallback.estimated,
      failed:    fallback.failed,
    };
  }
}

function roundFinal(n: Nutrition): Nutrition {
  return {
    kcal: Math.round(n.kcal),
    p:    Math.round(n.p),
    c:    Math.round(n.c),
    g:    n.g < 5 ? Math.round(n.g * 10) / 10 : Math.round(n.g),
  };
}
