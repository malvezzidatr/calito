import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { FoodCategory, FoodEntry } from './utils/food.types';
import { validateFoodCatalog } from './utils/food.validation';
import { matchFood, MatchResult } from './utils/food.matcher';
import { calculateMacros, CalculationItem, CalculationResult } from './utils/food.calculator';

@Injectable()
export class FoodsService implements OnModuleInit {
  private readonly logger = new Logger(FoodsService.name);
  private readonly catalog: Map<string, FoodEntry> = new Map();

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
}
